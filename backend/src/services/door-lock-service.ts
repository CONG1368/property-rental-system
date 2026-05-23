import { Op } from 'sequelize';
import DoorLock from '../models/DoorLock.js';
import DoorLockPassword from '../models/DoorLockPassword.js';
import DoorLockKey from '../models/DoorLockKey.js';
import DoorLockLog from '../models/DoorLockLog.js';
import { getDoorLockProvider } from './door-lock-provider.js';

// ====== 门锁设备 ======

export async function getLockList(params: {
  page: number; pageSize: number;
  keyword?: string; category?: string; propertyId?: number; status?: string;
}) {
  const { page, pageSize, keyword, category, propertyId, status } = params;
  const where: any = {};
  if (keyword) {
    where[Op.or] = [
      { name: { [Op.like]: `%${keyword}%` } },
      { sn: { [Op.like]: `%${keyword}%` } },
    ];
  }
  if (category) where.category = category;
  if (propertyId) where.propertyId = propertyId;
  if (status) where.status = status;

  const { count, rows } = await DoorLock.findAndCountAll({
    where,
    limit: pageSize,
    offset: (page - 1) * pageSize,
    order: [['createdAt', 'DESC']],
    include: [{ association: 'property', attributes: ['id', 'name', 'address'] }],
  });
  return { total: count, list: rows, page, pageSize };
}

export async function getLockById(id: number) {
  const lock = await DoorLock.findByPk(id, {
    include: [
      { association: 'property', attributes: ['id', 'name', 'address', 'status'] },
      { association: 'passwords', attributes: ['id', 'passwordType', 'purpose', 'isActive'] },
      { association: 'keys', attributes: ['id', 'keyCode', 'keyStatus'] },
    ],
  });
  return lock;
}

export async function createLock(data: any) {
  return await DoorLock.create(data);
}

export async function updateLock(id: number, data: any) {
  const lock = await DoorLock.findByPk(id);
  if (!lock) return null;
  return await lock.update(data);
}

export async function deleteLock(id: number) {
  const lock = await DoorLock.findByPk(id);
  if (!lock) return null;
  await lock.destroy();
  return true;
}

// ====== 远程开锁（仅智能门锁） ======

export async function remoteOpen(id: number, operatorId: number, operatorName: string) {
  const lock = await DoorLock.findByPk(id);
  if (!lock) throw new Error('门锁不存在');
  if (lock.category !== '智能门锁') throw new Error('传统门锁不支持远程开锁');

  const provider = getDoorLockProvider();
  const result = await provider.remoteOpen(lock.deviceId || '');

  await DoorLockLog.create({
    lockId: id,
    operationType: '远程开锁',
    operatorId,
    operatorName,
    operatorType: '管理员',
    result: result.success ? '成功' : '失败',
    detail: result.message,
  } as any);

  return result;
}

// ====== 查询门锁状态（仅智能门锁） ======

export async function getLockStatus(id: number) {
  const lock = await DoorLock.findByPk(id);
  if (!lock) throw new Error('门锁不存在');
  if (lock.category !== '智能门锁') {
    return { online: false, battery: null, message: '传统门锁无在线状态' };
  }
  const provider = getDoorLockProvider();
  const status = await provider.getDeviceStatus(lock.deviceId || '');
  await lock.update({
    status: status.online ? '在线' : '离线',
    battery: status.battery ?? lock.battery,
    lastOnlineAt: status.lastOnlineAt ? new Date(status.lastOnlineAt) : lock.lastOnlineAt,
  });
  return status;
}

// ====== 密码管理（仅智能门锁） ======

export async function getPasswords(lockId: number) {
  return await DoorLockPassword.findAll({
    where: { lockId },
    order: [['createdAt', 'DESC']],
  });
}

export async function createPassword(lockId: number, data: {
  password: string; passwordType: string; purpose: string;
  startTime?: string; endTime?: string; maxUseCount?: number;
  tenantId?: number; createdBy?: number; notes?: string;
}) {
  const lock = await DoorLock.findByPk(lockId);
  if (!lock) throw new Error('门锁不存在');
  if (lock.category !== '智能门锁') throw new Error('传统门锁不支持密码管理');

  const provider = getDoorLockProvider();
  const remotePwdId = await provider.createPassword(lock.deviceId || '', data.password, {
    passwordType: data.passwordType,
    startTime: data.startTime,
    endTime: data.endTime,
    maxUseCount: data.maxUseCount,
  });

  const pwd = await DoorLockPassword.create({
    lockId, password: data.password,
    passwordType: data.passwordType as any,
    purpose: data.purpose as any,
    startTime: data.startTime ? new Date(data.startTime) : null,
    endTime: data.endTime ? new Date(data.endTime) : null,
    maxUseCount: data.maxUseCount || 0,
    tenantId: data.tenantId || null,
    createdBy: data.createdBy || null,
    notes: data.notes || '',
  } as any);

  return pwd;
}

export async function updatePassword(pwdId: number, data: {
  isActive?: boolean; endTime?: string; notes?: string;
}) {
  const pwd = await DoorLockPassword.findByPk(pwdId);
  if (!pwd) throw new Error('密码不存在');

  const lock = await DoorLock.findByPk(pwd.lockId);
  if (data.isActive === false && lock) {
    // 禁用密码 → 同步调用 IoT 平台失效
    const provider = getDoorLockProvider();
    await provider.revokePassword(lock.deviceId || '', String(pwdId));
  }

  await pwd.update(data as any);
  return pwd;
}

export async function deletePassword(pwdId: number) {
  const pwd = await DoorLockPassword.findByPk(pwdId);
  if (!pwd) throw new Error('密码不存在');

  const lock = await DoorLock.findByPk(pwd.lockId);
  if (lock) {
    const provider = getDoorLockProvider();
    await provider.revokePassword(lock.deviceId || '', String(pwdId));
  }

  await pwd.destroy();
  return true;
}

// ====== 钥匙管理（仅传统门锁） ======

export async function getKeys(lockId: number, status?: string) {
  const where: any = { lockId };
  if (status) where.keyStatus = status;
  return await DoorLockKey.findAll({ where, order: [['createdAt', 'DESC']] });
}

export async function createKey(lockId: number, data: {
  keyCode: string; createdBy?: number;
}) {
  const lock = await DoorLock.findByPk(lockId);
  if (!lock) throw new Error('门锁不存在');
  if (lock.category !== '传统门锁') throw new Error('智能门锁不支持钥匙管理');

  const key = await DoorLockKey.create({
    lockId, keyCode: data.keyCode,
    keyStatus: '在库', createdBy: data.createdBy || null,
  } as any);

  // 更新门锁钥匙总数
  const keyCount = await DoorLockKey.count({ where: { lockId } });
  await lock.update({ totalKeyCount: keyCount });

  return key;
}

export async function lendKey(keyId: number, data: {
  holderType: string; holderName: string; holderPhone?: string;
  expectedReturnTime?: string; lendReason?: string;
}, operatorId: number, operatorName: string) {
  const key = await DoorLockKey.findByPk(keyId);
  if (!key) throw new Error('钥匙不存在');
  if (key.keyStatus !== '在库') throw new Error('钥匙当前不可借出（状态：' + key.keyStatus + '）');

  await key.update({
    keyStatus: '借出',
    holderType: data.holderType as any,
    holderName: data.holderName,
    holderPhone: data.holderPhone || '',
    lendTime: new Date(),
    expectedReturnTime: data.expectedReturnTime ? new Date(data.expectedReturnTime) : null,
    lendReason: data.lendReason || '',
  } as any);

  // 记录日志
  await DoorLockLog.create({
    lockId: key.lockId,
    operationType: '钥匙借出',
    operatorId, operatorName,
    operatorType: '管理员',
    result: '成功',
    detail: `借出钥匙 ${key.keyCode} 给 ${data.holderName}（${data.holderType}）`,
  } as any);

  return key;
}

export async function returnKey(keyId: number, operatorId: number, operatorName: string) {
  const key = await DoorLockKey.findByPk(keyId);
  if (!key) throw new Error('钥匙不存在');
  if (key.keyStatus !== '借出') throw new Error('钥匙当前状态不是借出');

  await key.update({
    keyStatus: '在库',
    holderType: '',
    holderName: null,
    holderPhone: null,
    returnTime: new Date(),
    lendReason: null,
  } as any);

  await DoorLockLog.create({
    lockId: key.lockId,
    operationType: '钥匙归还',
    operatorId, operatorName,
    operatorType: '管理员',
    result: '成功',
    detail: `归还钥匙 ${key.keyCode}`,
  } as any);

  return key;
}

export async function updateKeyStatus(keyId: number, data: {
  keyStatus: string; operatorId: number; operatorName: string;
}) {
  const key = await DoorLockKey.findByPk(keyId);
  if (!key) throw new Error('钥匙不存在');

  const statusMap: Record<string, string> = {
    '丢失': '钥匙丢失',
    '作废': '钥匙作废',
  };
  const logType = statusMap[data.keyStatus] || data.keyStatus;

  await key.update({ keyStatus: data.keyStatus as any } as any);

  await DoorLockLog.create({
    lockId: key.lockId,
    operationType: logType,
    operatorId: data.operatorId,
    operatorName: data.operatorName,
    operatorType: '管理员',
    result: '成功',
    detail: `钥匙 ${key.keyCode} 状态变更为 ${data.keyStatus}`,
  } as any);

  return key;
}

// ====== 日志查询 ======

export async function getLogs(lockId: number, params: {
  page: number; pageSize: number; operationType?: string;
}) {
  const { page, pageSize, operationType } = params;
  const where: any = { lockId };
  if (operationType) where.operationType = operationType;

  const { count, rows } = await DoorLockLog.findAndCountAll({
    where,
    limit: pageSize,
    offset: (page - 1) * pageSize,
    order: [['createdAt', 'DESC']],
  });
  return { total: count, list: rows, page, pageSize };
}
