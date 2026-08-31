import Contract from '../models/Contract.js';
import { Op } from 'sequelize';

// 推荐租金 = 面积 × 单价
export function quoteRent(area: number, unitPrice: number): number {
  return Math.round((area * unitPrice) * 100) / 100;
}

// 批量调价：对指定合同按百分比调整月租金
export async function batchAdjustContracts(contractIds: number[], rate: number): Promise<number> {
  if (!contractIds || !contractIds.length) return 0;
  const ids = contractIds;
  const contracts = await Contract.findAll({ where: { id: { [Op.in]: ids } } });
  let n = 0;
  for (const c of contracts) {
    const newRent = Math.round(Number(c.get('rentAmount') || 0) * (1 + rate / 100) * 100) / 100;
    await c.update({ rentAmount: newRent } as any);
    n++;
  }
  return n;
}
