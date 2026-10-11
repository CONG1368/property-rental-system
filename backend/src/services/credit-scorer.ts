import Tenant from '../models/Tenant.js';
import Contract from '../models/Contract.js';
import Bill from '../models/Bill.js';
import { Op } from 'sequelize';
import { getCreditRule, computeCreditScore } from './business-config.js';

/**
 * 信用评分（审计第 4 项：权重与等级线不再写死，读 system_configs.credit_rule）。
 * 默认规则 ＝ 改造前写死的算法：按时缴费 40 + 在租 25/15 + 配合度 ≤20 − 逾期 ≤15，等级线 80/60/40，初始分 60。
 */
export async function calculateCreditScore(tenantId: number): Promise<{ score: number; grade: string }> {
  const tenant = await Tenant.findByPk(tenantId);
  if (!tenant) throw new Error('租客不存在');

  const contracts = await Contract.findAll({ where: { tenantId } });
  const contractIds = contracts.map((c: any) => c.id);
  const allBills = contractIds.length > 0
    ? await Bill.findAll({ where: { contractId: { [Op.in]: contractIds } } })
    : [];

  const rule = await getCreditRule();

  // 没有合同或没有账单时给初始分，且**不写回租客档案**（与原实现一致：无可评分依据时不改动信用分）
  if (contracts.length === 0 || allBills.length === 0) {
    return computeCreditScore({ contractsCount: 0, activeContracts: 0, totalBills: 0, paidOnTime: 0, overdue: 0 }, rule);
  }

  const result = computeCreditScore({
    contractsCount: contracts.length,
    activeContracts: contracts.filter((c: any) => c.status === '执行中').length,
    totalBills: allBills.length,
    paidOnTime: allBills.filter((b: any) => b.status === '已缴').length,
    overdue: allBills.filter((b: any) => b.status === '逾期').length,
  }, rule);

  await tenant.update({ creditScore: result.score, creditGrade: result.grade });
  return result;
}
