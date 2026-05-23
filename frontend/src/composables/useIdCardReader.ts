import { ref } from 'vue';
import request from '@/api/request';

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

export interface IdCardReadResult {
  success: boolean;
  data?: IdCardData;
  warnings?: string[];
  error?: string;
}

export function useIdCardReader() {
  const reading = ref(false);
  const lastResult = ref<IdCardReadResult | null>(null);
  const devices = ref<any[]>([]);

  // 获取设备列表
  async function fetchDevices() {
    try {
      const res = await request.get('/id-card-readers', { params: { pageSize: 50 } });
      devices.value = res.data?.list || [];
      return devices.value;
    } catch { return []; }
  }

  // 触发读卡
  async function readCard(readerId: number): Promise<IdCardReadResult> {
    reading.value = true;
    try {
      const res = await request.post(`/id-card-readers/${readerId}/read`);
      const result: IdCardReadResult = {
        success: true,
        data: res.data,
        warnings: (res as any).warnings,
      };
      lastResult.value = result;
      return result;
    } catch (e: any) {
      const result: IdCardReadResult = {
        success: false,
        error: e?.response?.data?.message || '读卡失败',
      };
      lastResult.value = result;
      throw e;
    } finally {
      reading.value = false;
    }
  }

  // 获取第一台在线设备
  async function getFirstOnlineDevice() {
    if (devices.value.length === 0) await fetchDevices();
    return devices.value.find((d: any) => d.status === '在线') || devices.value[0] || null;
  }

  return { reading, lastResult, devices, fetchDevices, readCard, getFirstOnlineDevice };
}
