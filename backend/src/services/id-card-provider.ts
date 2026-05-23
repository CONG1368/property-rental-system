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

// Provider 抽象接口
export interface IdCardReaderProvider {
  readCard(deviceId: string): Promise<IdCardData>;
  getDeviceStatus(deviceId: string): Promise<DeviceStatus>;
}

// Mock 实现
class MockIdCardProvider implements IdCardReaderProvider {
  private logPath = 'logs/id-card-provider.jsonl';

  private log(entry: object) {
    const dir = 'logs';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(this.logPath, JSON.stringify({ ...entry, timestamp: new Date().toISOString() }) + '\n');
  }

  async readCard(deviceId: string): Promise<IdCardData> {
    // 模拟读卡延迟 300ms
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
      photoBase64: '', // Mock 不提供照片
    };
    this.log({ action: 'readCard', deviceId, result: 'success', idNumber: data.idNumber });
    return data;
  }

  async getDeviceStatus(deviceId: string): Promise<DeviceStatus> {
    await new Promise(r => setTimeout(r, 100));
    const status: DeviceStatus = {
      online: true,
      firmwareVersion: 'V2.3.1',
      lastReadAt: new Date().toISOString(),
    };
    this.log({ action: 'getDeviceStatus', deviceId, result: 'success' });
    return status;
  }
}

let provider: IdCardReaderProvider | null = null;

export function getIdCardProvider(): IdCardReaderProvider {
  if (!provider) {
    provider = new MockIdCardProvider();
  }
  return provider;
}
