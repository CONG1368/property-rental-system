import IdCardReader from '../models/IdCardReader.js';
import IdCardReadLog from '../models/IdCardReadLog.js';
import Tenant from '../models/Tenant.js';
import SystemConfig from '../models/SystemConfig.js';
import { createProvider, IdCardData, IdCardProviderMode } from './id-card-provider.js';

// 确保读卡器配置项存在（内置，供系统参数中心展示/切换）—— 华视 CVR-100U 真实接入所需
const ID_CARD_CONFIGS: { key: string; value: string; desc: string }[] = [
  { key: 'id_card_provider', value: 'mock', desc: '身份证读卡器 Provider：mock=演示/模拟（返回内置演示数据），real=真实读卡器（需接入厂商 SDK）' },
  { key: 'id_card_dll_dir', value: '', desc: '真实读卡器 SDK 目录（放置华视 termb.dll / sdtapi.dll / UnPack.dll）；留空默认 <应用目录>/idcard' },
  { key: 'id_card_port', value: '3', desc: '真实读卡器 COM 口编号（华视 CVR-100U 为 USB 虚拟串口，如 COM3 填 3）' },
];
export async function ensureIdCardConfig(): Promise<void> {
  for (const c of ID_CARD_CONFIGS) {
    const row = await SystemConfig.findOne({ where: { configKey: c.key } });
    if (!row) {
      await SystemConfig.create({
        configKey: c.key,
        configValue: c.value,
        description: c.desc,
        configGroup: '系统',
        valueType: 'string',
        isSensitive: false,
        builtIn: true,
      } as any);
    }
  }
}

// 读卡 Provider 模式：system_configs.id_card_provider = 'mock'(默认) | 'real'
export async function getIdCardProviderMode(): Promise<IdCardProviderMode> {
  try {
    const row = await SystemConfig.findOne({ where: { configKey: 'id_card_provider' } });
    return ((row?.configValue as string) || 'mock') === 'real' ? 'real' : 'mock';
  } catch { return 'mock'; }
}

export function getIdCardProvider() {
  // 兼容旧调用：返回默认 mock provider（业务读取请走 readCard()，它会按模式选择）
  return createProvider('mock');
}
import { broadcast } from '../websocket/index.js';
import { Op } from 'sequelize';

// ISO 7064:1983 MOD 11-2 身份证校验位
export function validateIdNumber(idNumber: string): { valid: boolean; message: string } {
  if (!/^\d{17}[\dXx]$/.test(idNumber)) {
    return { valid: false, message: '身份证号格式不正确（需为18位）' };
  }
  const weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
  const checkMap = '10X98765432';
  let sum = 0;
  for (let i = 0; i < 17; i++) {
    sum += parseInt(idNumber[i]) * weights[i];
  }
  const expected = checkMap[sum % 11];
  if (idNumber[17].toUpperCase() !== expected) {
    return { valid: false, message: '身份证号校验位不正确' };
  }
  return { valid: true, message: '校验通过' };
}

// 检查身份证号是否重复
export async function checkDuplicateIdNumber(idNumber: string, excludeTenantId?: number): Promise<{ duplicate: boolean; tenant?: any }> {
  const where: any = { idNumber };
  if (excludeTenantId) where.id = { [Op.ne]: excludeTenantId };
  const existing = await Tenant.findOne({ where });
  if (existing) {
    return { duplicate: true, tenant: { id: (existing as any).id, name: (existing as any).name } };
  }
  return { duplicate: false };
}

// 计算年龄
export function checkAge(birthDate: string): { age: number; underage: boolean } {
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return { age, underage: age < 18 };
}

// 检查身份证是否过期
export function checkExpiry(validTo: string): { expired: boolean; daysLeft: number } {
  if (!validTo) return { expired: false, daysLeft: 9999 };
  // 长期有效的身份证 validTo 可能是 "长期" 或很远的日期
  if (validTo === '长期') return { expired: false, daysLeft: 9999 };
  const expiry = new Date(validTo);
  const today = new Date();
  const diff = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return { expired: diff < 0, daysLeft: diff };
}

// 身份证号脱敏（仅保留前3后4）
export function maskIdNumber(idNumber: string): string {
  if (idNumber.length !== 18) return '****';
  return idNumber.slice(0, 3) + '***********' + idNumber.slice(-4);
}

// 触发读卡
export async function readCard(readerId: number, operatorId: number): Promise<{
  success: boolean;
  data?: IdCardData;
  mock?: boolean;
  warnings?: string[];
  error?: string;
}> {
  try {
    const reader = await IdCardReader.findByPk(readerId);
    if (!reader) return { success: false, error: '设备不存在' };

    const mode = await getIdCardProviderMode();
    const provider = createProvider(mode);
    const cardData = await provider.readCard((reader as any).port || readerId.toString());

    // 校验
    const warnings: string[] = [];
    if (mode === 'mock') {
      // 演示/模拟：只提示这是模拟数据，不对假身份证做真实校验（否则会误报校验位/过期）
      warnings.push('当前为演示/模拟读卡（未接入真实读卡器 SDK），返回的是内置演示数据');
    } else {
      const validation = validateIdNumber(cardData.idNumber);
      if (!validation.valid) warnings.push(validation.message);

      const duplicate = await checkDuplicateIdNumber(cardData.idNumber);
      if (duplicate.duplicate) {
        warnings.push(`该身份证号已关联租客「${duplicate.tenant?.name}」`);
      }

      const ageCheck = checkAge(cardData.birthDate);
      if (ageCheck.underage) warnings.push(`年龄 ${ageCheck.age} 岁，未满18周岁`);

      const expiryCheck = checkExpiry(cardData.validTo);
      if (expiryCheck.expired) {
        warnings.push('身份证已过期');
      } else if (expiryCheck.daysLeft <= 90) {
        warnings.push(`身份证即将过期（剩余${expiryCheck.daysLeft}天）`);
      }
    }

    // 更新设备最后读卡时间
    await reader.update({ lastReadAt: new Date() } as any);

    // 写审计日志
    await IdCardReadLog.create({
      readerId,
      operatorId,
      method: '读卡器',
      result: '成功',
      idNumber: maskIdNumber(cardData.idNumber),
    } as any);

    // WebSocket 广播
    broadcast('id-card:read-success', {
      readerId,
      idNumber: maskIdNumber(cardData.idNumber),
      timestamp: Date.now(),
    });

    return { success: true, data: cardData, mock: mode === 'mock', warnings: warnings.length > 0 ? warnings : undefined };
  } catch (err: any) {
    // 写失败日志
    await IdCardReadLog.create({
      readerId,
      operatorId,
      method: '读卡器',
      result: '失败',
      errorMessage: err.message || '读卡失败',
    } as any);

    broadcast('id-card:read-failure', {
      readerId,
      errorMessage: err.message || '读卡失败',
      timestamp: Date.now(),
    });

    return { success: false, error: err.message || '读卡失败' };
  }
}

// 将读卡数据映射为租客表单字段
export function mapCardDataToTenantForm(data: IdCardData): Record<string, string> {
  return {
    name: data.name,
    idType: '身份证',
    idNumber: data.idNumber,
    gender: data.gender,
    birthDate: data.birthDate,
    ethnicity: data.ethnicity,
    idAddress: data.address,
    idIssuingAuthority: data.issuingAuthority,
    idValidFrom: data.validFrom,
    idValidTo: data.validTo,
    idPhoto: data.photoBase64,
  };
}
