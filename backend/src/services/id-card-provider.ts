import fs from 'fs';
import path from 'path';

// 运行时惰性填充（保留；real 读卡用桥子进程，不再进程内 FFI）
let iconv: any = null;

export interface IdCardData {
  name: string; gender: string; ethnicity: string; birthDate: string; address: string;
  idNumber: string; issuingAuthority: string; validFrom: string; validTo: string; photoBase64: string;
}

export interface DeviceStatus {
  online: boolean; firmwareVersion: string; lastReadAt: string | null;
}

export type IdCardProviderMode = 'mock' | 'real';

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
      name: '张伟', gender: '男', ethnicity: '汉族', birthDate: '1990-01-15',
      address: '北京市朝阳区建国路88号', idNumber: '110105199001151234',
      issuingAuthority: '北京市公安局朝阳分局', validFrom: '2020-03-15', validTo: '2040-03-15', photoBase64: '',
    };
    this.log({ action: 'readCard', deviceId, result: 'success', mock: true, idNumber: data.idNumber });
    return data;
  }
  async getDeviceStatus(deviceId: string): Promise<DeviceStatus> {
    await new Promise(r => setTimeout(r, 100));
    this.log({ action: 'getDeviceStatus', deviceId, result: 'success', mock: true });
    return { online: true, firmwareVersion: 'V2.3.1（模拟）', lastReadAt: new Date().toISOString() };
  }
}

// 真实读卡器 Provider —— 华视 CVR-100U（32 位 SDK）。
// 关键约束：应用是 64 位进程，而华视 Termb.dll 是 32 位，进程内 FFI(koffi) 无法加载（架构不符）。
// 方案 X：spawn 一个 32 位 Python(card_bridge.py, ctypes) 子进程加载 Termb.dll 读卡，
//         把结果以 UTF-8 JSON 写 stdout，64 位主进程读取。绕开位宽限制。
// 实测：Termb.dll 仅导出 CVR_InitComm/Authenticate/Read_Content/CloseComm（无 GetPeople*），
//        读卡成功后 DLL 在所在目录生成 wz.txt(9 行 GBK 文字) + zp.bmp(相片)，由桥解析。
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

  async readCard(deviceId: string): Promise<IdCardData> {
    const dllDir = ((await this.cfg('id_card_dll_dir', '')) || resolveDllDir());
    const pythonX86 = ((await this.cfg('id_card_python_x86', '')) || resolvePythonX86());
    const port = Number(await this.cfg('id_card_port', '1001')) || 1001;
    const bridgePath = path.join(dllDir, 'card_bridge.py');
    const dllPath = path.join(dllDir, 'Termb.dll');
    if (!fs.existsSync(bridgePath)) {
      throw new Error('未找到读卡桥脚本 card_bridge.py（路径：' + bridgePath + '）。请把华视 CVR-100U 二次开发包复制到 id_card_dll_dir，含 Termb.dll / sdtapi.dll / WltRS.dll / card_bridge.py');
    }
    if (!fs.existsSync(dllPath)) {
      throw new Error('未找到华视读卡器动态库 Termb.dll（路径：' + dllPath + '）。请确认 id_card_dll_dir 配置正确、且已放入 Termb.dll');
    }

    const { spawn } = await import('node:child_process');
    let out = ''; let err = '';
    const child = spawn(pythonX86, [bridgePath, '--port=' + port], {
      cwd: dllDir, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
    const done = new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => { child.kill(); reject(new Error('读卡超时（30s）')); }, 30000);
      child.stdout.on('data', (d: string) => { out += d; });
      child.stderr.on('data', (d: string) => { err += d; });
      child.on('error', (e: any) => { clearTimeout(timer); reject(new Error('启动读卡桥失败：' + e.message)); });
      child.on('close', () => { clearTimeout(timer); resolve(out); });
    });
    const stdoutText = await done;

    let result: any;
    try { result = JSON.parse(stdoutText.trim().split('\n').pop()!); }
    catch (e) { this.log({ action: 'readCard', deviceId, result: 'parse-fail', mock: false, err, raw: stdoutText.slice(0, 200) }); throw new Error('读卡桥输出解析失败：' + err.slice(0, 200)); }
    if (!result?.ok) {
      this.log({ action: 'readCard', deviceId, result: 'fail', mock: false, error: result?.error });
      throw new Error(result?.error || '读卡失败');
    }
    const wz = result.data || {};
    const idNumber = String(wz.idNumber || '').trim();
    if (!idNumber) { this.log({ action: 'readCard', deviceId, result: 'fail', mock: false, error: '为空身份证号' }); throw new Error('未读取到身份证信息'); }

    const data: IdCardData = {
      name: String(wz.name || '').trim(), gender: String(wz.gender || '').trim(),
      ethnicity: String(wz.nation || '').trim(), birthDate: String(wz.birth || '').trim(),
      address: String(wz.address || wz.newAddress || '').trim(), idNumber,
      issuingAuthority: String(wz.department || '').trim(),
      validFrom: splitDateRange(wz.dateRange)[0], validTo: splitDateRange(wz.dateRange)[1],
      photoBase64: readZpBmp(dllDir, (await this.cfg('id_card_photo', '1')) !== '0'),
    };
    this.log({ action: 'readCard', deviceId, result: 'success', mock: false, idNumber });
    return data;
  }

  async getDeviceStatus(deviceId: string): Promise<DeviceStatus> {
    this.log({ action: 'getDeviceStatus', deviceId, result: 'real' });
    return { online: true, firmwareVersion: '华视 CVR-100U（32位桥）', lastReadAt: null };
  }
}

// 华视 wz.txt 有效期段形如 "2011.03.30-2021.03.30"（长期卡为"长期"）
function splitDateRange(r: string): [string, string] {
  const s = String(r || '').trim();
  if (/长期/.test(s)) return ['', '长期'];
  const m = s.split('-');
  if (m.length >= 2) return [m[0].replace(/\./g, '-'), m[1].replace(/\./g, '-')];
  return ['', ''];
}

// 读卡成功后 DLL 生成 zp.bmp；转 base64 供前端展示；无相片则空
function readZpBmp(dllDir: string, enabled: boolean): string {
  if (!enabled) return '';
  try {
    const p = [path.join(dllDir, 'zp.bmp'), path.join(process.cwd(), 'zp.bmp')].find(x => fs.existsSync(x));
    if (!p) return '';
    return 'data:image/bmp;base64,' + fs.readFileSync(p).toString('base64');
  } catch { return ''; }
}

// 解析华视 SDK 目录：优先应用旁 runtime/idcard（生产由此分发），否则仓库 runtime/idcard / 后端 idcard
function resolveDllDir(): string {
  const execDir = path.dirname(process.execPath);
  const cands = [
    path.join(execDir, 'runtime', 'idcard'),
    path.join(process.cwd(), 'runtime', 'idcard'),
    path.join(process.cwd(), 'idcard'),
    path.join(process.cwd(), '..', 'runtime', 'idcard'),
  ];
  for (const c of cands) { if (fs.existsSync(c)) return c; }
  return path.join(process.cwd(), 'runtime', 'idcard');
}
function resolvePythonX86(): string {
  const execDir = path.dirname(process.execPath);
  const cands = [
    path.join(execDir, 'runtime', 'python-x86', 'python.exe'),
    path.join(process.cwd(), 'runtime', 'python-x86', 'python.exe'),
    path.join(process.cwd(), '..', 'runtime', 'python-x86', 'python.exe'),
  ];
  for (const c of cands) { if (fs.existsSync(c)) return c; }
  return path.join(execDir, 'runtime', 'python-x86', 'python.exe');
}

const providerCache: Record<IdCardProviderMode, IdCardReaderProvider | null> = { mock: null, real: null };

export function createProvider(mode: IdCardProviderMode): IdCardReaderProvider {
  if (!providerCache[mode]) {
    providerCache[mode] = mode === 'real' ? new RealIdCardProvider() : new MockIdCardProvider();
  }
  return providerCache[mode]!;
}

export function getIdCardProvider(): IdCardReaderProvider {
  return createProvider('mock');
}
