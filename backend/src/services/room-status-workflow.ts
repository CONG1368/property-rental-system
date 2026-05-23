import Property from '../models/Property.js';
import RoomStatusLog from '../models/RoomStatusLog.js';
import { broadcast } from '../websocket/index.js';

// 房态流转规则：每个状态允许转换到的目标状态列表
const VALID_TRANSITIONS: Record<string, string[]> = {
  '空置':   ['已锁定', '已预订', '已出租', '维修中', '已冻结'],
  '已锁定': ['空置', '已预订'],
  '已预订': ['空置', '已出租'],
  '已出租': ['退租中', '已冻结'],
  '退租中': ['待保洁', '已出租', '已冻结'],
  '待保洁': ['待验收', '维修中'],
  '待验收': ['空置', '待保洁', '维修中'],
  '维修中': ['空置', '待保洁', '已出租'],
  '已冻结': ['空置', '维修中'],
};

// 所有有效的房源状态
export const ROOM_STATUSES = Object.keys(VALID_TRANSITIONS);

export function getValidTransitions(status: string): string[] {
  return VALID_TRANSITIONS[status] || [];
}

export async function transitionRoomStatus(
  propertyId: number,
  newStatus: string,
  operatorId: number,
  options?: {
    action?: 'manual' | 'contract_link' | 'batch' | 'system';
    notes?: string;
    linkedContractId?: number;
    linkedTenantId?: number;
  }
): Promise<{ property: any; oldStatus: string }> {
  const property = await Property.findByPk(propertyId);
  if (!property) throw new Error('房源不存在');

  const oldStatus = property.status;

  // 验证状态流转合法性
  const allowed = VALID_TRANSITIONS[oldStatus] || [];
  if (!allowed.includes(newStatus)) {
    throw new Error(`不能从"${oldStatus}"转换到"${newStatus}"，允许的状态: ${allowed.join('、')}`);
  }

  // 执行状态变更
  await property.update({ status: newStatus } as any);

  // 写入房态变更日志
  await RoomStatusLog.create({
    propertyId,
    oldStatus,
    newStatus,
    action: options?.action || 'manual',
    operatorId,
    notes: options?.notes || '',
    linkedContractId: options?.linkedContractId || null,
    linkedTenantId: options?.linkedTenantId || null,
  });

  console.log(`[RoomStatus] 房源#${propertyId} (${property.name}): ${oldStatus} → ${newStatus}`);

  // 广播房态变更事件，通知所有客户端实时刷新
  broadcast('room:status-changed', {
    propertyId,
    propertyName: property.name,
    oldStatus,
    newStatus,
    action: options?.action || 'manual',
    timestamp: Date.now(),
  });

  return { property, oldStatus };
}
