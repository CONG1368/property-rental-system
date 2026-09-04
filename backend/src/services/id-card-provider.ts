import fs from 'fs';
import path from 'path';

// 运行时惰性填充（只有 real 读卡才 import，避免 mock/CI 加载原生依赖）
let iconv: any = null;

// 读卡结果
export interface IdCardData {
  name: string;
  gender: string;
  ethnicity: string;
  birthDate: string;
  address: string;
  idNumber: string;
  issuingAuthority: string;
  validFrom: string;
  validTo: string;
  photoBase64: string;
}

export interface DeviceStatus {
  online: boolean;
  firmwareVersion: string;
  lastReadAt: string | null;
}

export type IdCardProviderMode = 'mock' | 'real';

// Provider 抽象接口
export interface IdCardReaderProvider {
  readCard(deviceId: string): Promise<IdCardData>;
  getDeviceStatus(deviceId: string): Promise<DeviceStatus>;
}

// Mock 实现（演示/模拟模式）：返回内置演示身份，绝不谎报真实读取
class MockIdCardProvider implements IdCardReaderProvider {
  private logPath = 'logs/id-card-provider.jsonl';

  private log(entry: object) {
    const dir = 'logs';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(this.logPath, JSON.stringify({ ...entry, timestamp: new Date().toISOString() }) + '\n');
  }

  async readCard(deviceId: string): Promise<IdCardData> {
    await new Promise(r => setTimeout(r, 300));
    const data: IdCardData = {
      name: '张伟',
      gender: '男',
      ethnicity: '汉族',
      birthDate: '1990-01-15',
      address: '北京市朝阳区建国路88号',
      idNumber: '110105199001151234',
      issuingAuthority: '北京市公安局朝阳分局',
      validFrom: '2020-03-15',
      validTo: '2040-03-15',
      photoBase64: '',
    };
    this.log({ action: 'readCard', deviceId, result: 'success', mock: true, idNumber: data.idNumber });
    return data;
  }

  async getDeviceStatus(deviceId: string): Promise<DeviceStatus> {
    await new Promise(r => setTimeout(r, 100));
    const status: DeviceStatus = {
      online: true,
      firmwareVersion: 'V2.3.1（模拟）',
      lastReadAt: new Date().toISOString(),
    };
    this.log({ action: 'getDeviceStatus', deviceId, result: 'success', mock: true });
    return status;
  }
}

// 真实读卡器 Provider —— 厂商 SDK 接入点（华视/新中新/普天/精伦/中控）
// TODO: 通过 node-ffi / child_process / pcsclite 调用厂商 DLL SDK。
class RealIdCardProvider implements IdCardReaderProvider {
  private logPath = 'logs/id-card-provider.jsonl';

  private log(entry: object) {
    const dir = 'logs';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(this.logPath, JSON.stringify({ ...entry, timestamp: new Date().toISOString() }) + '\n');
  }

  private async cfg(key: string, def: string): Promise<string> {
    try {
      const { default: SystemConfig } = await import('../models/SystemConfig.js');
      const row = await SystemConfig.findOne({ where: { configKey: key } });
      return ((row as any)?.configValue) || def;
    } catch { return def; }
  }

  private decodeGbk(buf: Buffer, len: number): string {
    try { return iconv.decode(buf.slice(0, len || 0), 'gbk').replace(/\0/g, '').trim(); }
    catch { return buf.slice(0, len || 0).toString('utf8').replace(/\0/g, '').trim(); }
  }

  async readCard(deviceId: string): Promise<IdCardData> {
    const koffi = (await import('koffi')).default;
    iconv = (await import('iconv-lite')).default;

    const dllDir = ((await this.cfg('id_card_dll_dir', '')) || path.join(process.cwd(), 'idcard'));
    const port = Number(await this.cfg('id_card_port', '3')) || 3;
    const dllPath = path.join(dllDir, 'termb.dll');
    if (!fs.existsSync(dllPath)) {
      throw new Error(`未找到华视读卡器动态库 termb.dll（路径：${dllPath}）。请把华视 CVR-100U 二次开发包的 termb.dll / sdtapi.dll / UnPack.dll 三个文件放入该目录，并在系统参数配置 id_card_dll_dir 与 id_card_port`);
    }

    let lib: any;
    try { lib = koffi.load(dllPath); }
    catch (e) {
      throw new Error(`加载 termb.dll 失败：${(e as Error).message}。若提示架构不符，说明需 64 位版 SDK（本应用为 64 位进程），请从华视官网获取 64 位二次开发包`);
    }

    const takeText = (name: string): string => {
      try {
        const fn = lib.func(`int ${name}(char*, int*)`);
        const buf = Buffer.alloc(256);
        const len = [0];
        fn(buf, len);
        return this.decodeGbk(buf, len[0] || 0);
      } catch { return ''; }
    };

    try {
      lib.func('int CVR_InitComm(int)')(port);
      lib.func('int CVR_Authenticate()')();
      lib.func('int CVR_Read_Content(int)')(1);
      const name = takeText('GetPeopleName');
      if (!name) {
        throw new Error('未读取到身份证信息：请确认身份证已放置在读卡器上、COM 口与驱动已正确安装');
      }
      const idNumber = takeText('GetPeopleIDCode');
      const data: IdCardData = {
        name,
        gender: takeText('GetPeopleSex'),
        ethnicity: takeText('GetPeopleNation'),
        birthDate: takeText('GetPeopleBirthday'),
        address: takeText('GetPeopleAddress'),
        idNumber,
        issuingAuthority: takeText('GetDepartment'),
        validFrom: takeText('GetStartDate'),
        validTo: takeText('GetEndDate'),
        photoBase64: '',
      };
      this.log({ action: 'readCard', deviceId, result: 'success', mock: false, idNumber });
      return data;
    } finally {
      try { lib.func('int CVR_CloseComm()')(); } catch { /* ignore */ }
    }
  }

  async getDeviceStatus(deviceId: string): Promise<DeviceStatus> {
    this.log({ action: 'getDeviceStatus', deviceId, result: 'real' });
    return { online: true, firmwareVersion: '华视 CVR-100（termb）', lastReadAt: null };
  }
}

const providerCache: Record<IdCardProviderMode, IdCardReaderProvider | null> = { mock: null, real: null };

/** 按模式创建/复用 Provider 实例。 */
export function createProvider(mode: IdCardProviderMode): IdCardReaderProvider {
  if (!providerCache[mode]) {
    providerCache[mode] = mode === 'real' ? new RealIdCardProvider() : new MockIdCardProvider();
  }
  return providerCache[mode]!;
}

export function getIdCardProvider(): IdCardReaderProvider {
  return createProvider('mock');
}
