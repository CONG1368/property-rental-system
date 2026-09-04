import fs from 'fs';

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

  async readCard(deviceId: string): Promise<IdCardData> {
    // 未集成厂商 SDK 时：明确报错，绝不返回模拟数据冒充真实读取。
    throw new Error('未接入真实读卡器 SDK：请安装读卡器厂商 SDK 并在 id_card_provider=real 下配置后使用');
  }

  async getDeviceStatus(deviceId: string): Promise<DeviceStatus> {
    this.log({ action: 'getDeviceStatus', deviceId, result: 'not_configured', mock: false });
    return { online: false, firmwareVersion: '（未接入 SDK）', lastReadAt: null };
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
