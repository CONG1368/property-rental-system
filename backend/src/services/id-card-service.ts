import IdCardReader from '../models/IdCardReader.js';
import IdCardReadLog from '../models/IdCardReadLog.js';
import Tenant from '../models/Tenant.js';
import { getIdCardProvider, IdCardData } from './id-card-provider.js';
export { getIdCardProvider };
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
  warnings?: string[];
  error?: string;
}> {
  try {
    const reader = await IdCardReader.findByPk(readerId);
    if (!reader) return { success: false, error: '设备不存在' };

    const provider = getIdCardProvider();
    const cardData = await provider.readCard((reader as any).port || readerId.toString());

    // 校验
    const warnings: string[] = [];
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

    return { success: true, data: cardData, warnings: warnings.length > 0 ? warnings : undefined };
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
