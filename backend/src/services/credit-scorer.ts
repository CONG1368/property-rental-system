import Tenant from '../models/Tenant.js';
import Contract from '../models/Contract.js';
import Bill from '../models/Bill.js';
import { Op } from 'sequelize';

export async function calculateCreditScore(tenantId: number): Promise<{ score: number; grade: string }> {
  const tenant = await Tenant.findByPk(tenantId);
  if (!tenant) throw new Error('租客不存在');

  const contracts = await Contract.findAll({ where: { tenantId } });
  if (contracts.length === 0) return { score: 60, grade: 'C' };

  // 统计所有合同下的账单
  const contractIds = contracts.map((c: any) => c.id);
  const allBills = await Bill.findAll({
    where: { contractId: { [Op.in]: contractIds } },
  });

  const totalBills = allBills.length;
  if (totalBills === 0) return { score: 60, grade: 'C' };

  const paidOnTime = allBills.filter((b: any) => b.status === '已缴').length;
  const overdue = allBills.filter((b: any) => b.status === '逾期').length;

  // 按时缴费 40%
  const paymentScore = Math.round((paidOnTime / totalBills) * 40);

  // 合同履约 25%（有活跃合同满分）
  const activeContracts = contracts.filter((c: any) => c.status === '执行中').length;
  const contractScore = activeContracts > 0 ? 25 : 15;

  // 配合度 20%（基础分 + 合同历史）
  const cooperationScore = Math.min(20, 10 + contracts.length * 2);

  // 逾期扣分 15%（反向）
  const latePenalty = Math.min(15, Math.round((overdue / totalBills) * 15));

  const score = Math.max(0, Math.min(100, paymentScore + contractScore + cooperationScore - latePenalty));
  const grade = score >= 80 ? 'A' : score >= 60 ? 'B' : score >= 40 ? 'C' : 'D';

  await tenant.update({ creditScore: score, creditGrade: grade });
  return { score, grade };
}
