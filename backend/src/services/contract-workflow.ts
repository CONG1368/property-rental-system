import Contract from '../models/Contract.js';
import ContractLog from '../models/ContractLog.js';
import Approval from '../models/Approval.js';
import { transitionRoomStatus } from './room-status-workflow.js';
import { broadcast } from '../websocket/index.js';

const VALID_TRANSITIONS: Record<string, string[]> = {
  '起草中': ['审批中'],
  '审批中': ['已驳回', '已签订'],
  '已驳回': ['起草中', '审批中'],
  '已签订': ['执行中'],
  '执行中': ['到期提醒', '已终止'],
  '到期提醒': ['执行中', '已到期'],
  '已到期': ['已终止'],
};

export async function transitionContract(
  contractId: number,
  newStatus: string,
  operatorId: number,
  notes?: string
): Promise<void> {
  const contract = await Contract.findByPk(contractId);
  if (!contract) throw new Error('合同不存在');

  const allowed = VALID_TRANSITIONS[contract.status] || [];
  if (!allowed.includes(newStatus)) {
    throw new Error(`不能从"${contract.status}"转换到"${newStatus}"，允许的状态: ${allowed.join(', ')}`);
  }

  const oldStatus = contract.status;
  await contract.update({ status: newStatus } as any);

  await ContractLog.create({
    contractId,
    action: 'status_change',
    oldStatus,
    newStatus,
    operatorId,
    notes: notes || '',
  });

  console.log(`[Contract] ${contract.contractNo}: ${oldStatus} → ${newStatus}`);

  // 广播合同状态变更事件
  broadcast('contract:status-changed', {
    contractId,
    contractNo: (contract as any).contractNo,
    oldStatus,
    newStatus,
    propertyId: (contract as any).propertyId,
    tenantId: (contract as any).tenantId,
    timestamp: Date.now(),
  });
}

export async function setExpiringContracts(): Promise<number> {
  const days = [90, 60, 30, 15, 7];
  let count = 0;

  for (const day of days) {
    const targetDate = new Date(Date.now() + day * 24 * 60 * 60 * 1000);
    const targetDateStr = targetDate.toISOString().split('T')[0];

    const contracts = await Contract.findAll({
      where: { status: '执行中', endDate: targetDateStr },
    });

    for (const contract of contracts) {
      await contract.update({ status: '到期提醒' });
      // 联动房源状态 → 退租中
      try {
        await transitionRoomStatus((contract as any).propertyId, '退租中', 1, {
          action: 'system',
          notes: `合同 ${(contract as any).contractNo} 已到期，系统自动更新房源状态`,
          linkedContractId: contract.id,
        });
      } catch { /* 联动失败不中断主流程 */ }
      count++;
    }
  }

  return count;
}
