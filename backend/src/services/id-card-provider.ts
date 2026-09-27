import fs from 'fs';
import path from 'path';

export interface IdCardData {
  name: string; gender: string; ethnicity: string; birthDate: string; address: string;
  idNumber: string; issuingAuthority: string; validFrom: string; validTo: string; photoBase64: string;
}

export interface DeviceStatus {
  online: boolean; firmwareVersion: string; lastReadAt: string | null;
}

// 读卡 Provider 模式：mock=演示/模拟；real=真实读卡器（华视 CVR-100U，走 32 位桥子进程）
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

// 真实读卡器 Provider —— 华视 CVR-100U（32 位 SDK，新版含 GetPeople* 结构化 API）。
// 关键约束：应用是 64 位进程，而华视 Termb.dll 是 32 位，进程内 FFI 无法加载（架构不符）。
// 方案 X：spawn 一个 32 位 Python(card_bridge.py, ctypes) 子进程加载 Termb.dll 读卡，
//         结果以 UTF-8 JSON 写 stdout，64 位主进程读取。绕开位宽限制。
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
    if (!fs.existsSync(bridgePath)) {
      throw new Error('未找到读卡桥脚本 card_bridge.py（路径：' + bridgePath + '）。请把华视 CVR-100U 二次开发包复制到 id_card_dll_dir，含 Termb.dll / sdtapi.dll / license.dat / card_bridge.py');
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
    // 华视 SDK GetPeopleIDCode 缓冲区结尾常带 NUL(\0)，必须剔除——否则内联进 SQL 会截断语句
    const idNumber = String(wz.idNumber || '').replace(/[\u0000-\u001f\u007f]/g, '').trim();
    if (!idNumber) { this.log({ action: 'readCard', deviceId, result: 'fail', mock: false, error: '为空身份证号' }); throw new Error('未读取到身份证信息'); }

    // 8 位日期（如 20000204）规范化为 YYYY-MM-DD，兼容 SDK GetStartDate/GetEndDate 返回格式
    const normDate = (s: string): string => {
      const v = String(s || '').trim();
      return /^\d{8}$/.test(v) ? `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}` : v;
    };
    const range = String(wz.dateRange || '').trim();
    const rp = range.split('-');
    const data: IdCardData = {
      name: String(wz.name || '').trim(), gender: String(wz.gender || '').trim(),
      ethnicity: String(wz.nation || '').trim(), birthDate: normDate(wz.birth),
      address: String(wz.address || wz.newAddress || '').trim(), idNumber,
      issuingAuthority: String(wz.department || '').trim(),
      // validFrom/validTo 优先取 GetStartDate/GetEndDate，缺省时回退 dateRange 拆分
      validFrom: normDate(wz.validFrom) || normDate(rp[0]),
      validTo: normDate(wz.validTo) || normDate(rp[1]),
      photoBase64: String(wz.photoBase64 || '').trim(),
    };
    this.log({ action: 'readCard', deviceId, result: 'success', mock: false, idNumber });
    return data;
  }

  async getDeviceStatus(deviceId: string): Promise<DeviceStatus> {
    this.log({ action: 'getDeviceStatus', deviceId, result: 'real' });
    return { online: true, firmwareVersion: '华视 CVR-100U（32位桥）', lastReadAt: null };
  }
}

// 解析华视 SDK 目录：优先应用旁 runtime/idcard（生产由此分发），否则仓库 runtime/idcard
function resolveDllDir(): string {
  const execDir = path.dirname(process.execPath);
  const cands = [
    path.join(execDir, 'resources', 'runtime', 'idcard'),
    path.join(execDir, 'runtime', 'idcard'),
    path.join(process.cwd(), 'runtime', 'idcard'),
    path.join(process.cwd(), '..', 'runtime', 'idcard'),
  ];
  for (const c of cands) { if (fs.existsSync(c)) return c; }
  return path.join(process.cwd(), 'runtime', 'idcard');
}
function resolvePythonX86(): string {
  const execDir = path.dirname(process.execPath);
  const cands = [
    path.join(execDir, 'resources', 'runtime', 'python-x86', 'python.exe'),
    path.join(execDir, 'runtime', 'python-x86', 'python.exe'),
    path.join(process.cwd(), 'runtime', 'python-x86', 'python.exe'),
    path.join(process.cwd(), '..', 'runtime', 'python-x86', 'python.exe'),
  ];
  for (const c of cands) { if (fs.existsSync(c)) return c; }
  return path.join(execDir, 'runtime', 'python-x86', 'python.exe');
}

const providerCache: Partial<Record<IdCardProviderMode, IdCardReaderProvider | null>> = { mock: null, real: null };

export function createProvider(mode: IdCardProviderMode): IdCardReaderProvider {
  if (!providerCache[mode]) {
    providerCache[mode] = mode === 'real' ? new RealIdCardProvider() : new MockIdCardProvider();
  }
  return providerCache[mode]!;
}

export function getIdCardProvider(): IdCardReaderProvider {
  return createProvider('mock');
}