import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logDir = path.resolve(__dirname, '../../logs');

// 确保日志目录存在
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

function writeLog(action: string, detail: Record<string, any>) {
  const entry = { timestamp: new Date().toISOString(), action, ...detail };
  fs.appendFileSync(
    path.join(logDir, 'door-lock-provider.jsonl'),
    JSON.stringify(entry) + '\n',
  );
}

// ====== 类型定义 ======

export interface DeviceStatus {
  online: boolean;
  battery: number | null;
  lastOnlineAt: string | null;
  firmwareVersion: string | null;
}

export interface OpenResult {
  success: boolean;
  message: string;
  timestamp: string;
}

export interface PwdOptions {
  passwordType: string;
  startTime?: string;
  endTime?: string;
  maxUseCount?: number;
}

export interface RemoteLog {
  operationType: string;
  operatorName: string;
  operatorType: string;
  result: string;
  detail: string;
  timestamp: string;
}

// ====== Provider 接口 ======

export interface DoorLockProvider {
  getDeviceStatus(deviceId: string): Promise<DeviceStatus>;
  remoteOpen(deviceId: string): Promise<OpenResult>;
  createPassword(deviceId: string, pwd: string, opts: PwdOptions): Promise<string>;
  revokePassword(deviceId: string, passwordId: string): Promise<void>;
  syncLogs(deviceId: string, since: Date): Promise<RemoteLog[]>;
}

// ====== Mock Provider ======

export class MockDoorLockProvider implements DoorLockProvider {
  async getDeviceStatus(deviceId: string): Promise<DeviceStatus> {
    writeLog('getDeviceStatus', { deviceId });
    return {
      online: true,
      battery: Math.floor(Math.random() * 40) + 60,
      lastOnlineAt: new Date().toISOString(),
      firmwareVersion: 'v2.3.1',
    };
  }

  async remoteOpen(deviceId: string): Promise<OpenResult> {
    writeLog('remoteOpen', { deviceId });
    await sleep(300);
    return { success: true, message: '远程开锁成功', timestamp: new Date().toISOString() };
  }

  async createPassword(deviceId: string, pwd: string, opts: PwdOptions): Promise<string> {
    writeLog('createPassword', { deviceId, pwd, opts });
    await sleep(200);
    return 'mock-pwd-id-' + Date.now();
  }

  async revokePassword(deviceId: string, passwordId: string): Promise<void> {
    writeLog('revokePassword', { deviceId, passwordId });
    await sleep(200);
  }

  async syncLogs(deviceId: string, since: Date): Promise<RemoteLog[]> {
    writeLog('syncLogs', { deviceId, since: since.toISOString() });
    return [
      {
        operationType: '密码开锁',
        operatorName: '张三',
        operatorType: '租客',
        result: '成功',
        detail: '密码开锁',
        timestamp: new Date().toISOString(),
      },
      {
        operationType: '指纹开锁',
        operatorName: '李四',
        operatorType: '租客',
        result: '成功',
        detail: '指纹开锁',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
      },
    ];
  }
}

// ====== Provider 工厂 ======

let provider: DoorLockProvider | null = null;

export function getDoorLockProvider(): DoorLockProvider {
  if (!provider) {
    // 从系统配置读取 provider 类型，默认 mock
    provider = new MockDoorLockProvider();
  }
  return provider;
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
