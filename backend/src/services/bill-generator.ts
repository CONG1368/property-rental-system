import { Op } from 'sequelize';
import Contract from '../models/Contract.js';
import Bill from '../models/Bill.js';
import dayjs from 'dayjs';

export async function generateBills(): Promise<number> {
  const activeContracts = await Contract.findAll({
    where: { status: '执行中' },
  });

  const thisMonth = dayjs().format('YYYY-MM');
  let generated = 0;

  for (const contract of activeContracts) {
    const lastBill = await Bill.findOne({
      where: { contractId: contract.id },
      order: [['period', 'DESC']],
    });

    // 计算下一期账期
    let nextPeriod: string;
    if (!lastBill) {
      nextPeriod = dayjs(contract.startDate).format('YYYY-MM');
    } else {
      const cycle = (contract as any).paymentCycle;
      const months = cycle === '月' ? 1 : cycle === '季' ? 3 : 12;
      nextPeriod = dayjs(lastBill.period + '-01').add(months, 'month').format('YYYY-MM');
    }

    // 只生成本月及之前的账期（不提前生成未来账单）
    if (nextPeriod > thisMonth) continue;

    const existing = await Bill.findOne({
      where: { contractId: contract.id, period: nextPeriod },
    });
    if (existing) continue;

    // 从 billingConfig 读取费用配置
    const bc = (contract as any).billingConfig || {};
    const waterFee = Number(bc.waterFee || 0);
    const electricFee = Number(bc.electricFee || 0);
    const propertyFee = Number(bc.propertyFee || 0);
    const utilityAmount = waterFee + electricFee;
    const rentAmount = Number(contract.rentAmount);
    const totalAmount = rentAmount + waterFee + electricFee + propertyFee;

    // 到期日为账期月份第5天
    const dueDate = dayjs(nextPeriod + '-01').date(5).format('YYYY-MM-DD');

    const billNo = `BL-${contract.contractNo}-${nextPeriod}`;
    await Bill.create({
      contractId: contract.id,
      billNo,
      period: nextPeriod,
      rentAmount,
      waterFee,
      electricFee,
      utilityAmount,
      propertyFee,
      otherAmount: 0,
      lateFee: 0,
      totalAmount,
      dueDate: new Date(dueDate),
      status: '未缴',
    });
    generated++;
  }

  if (generated > 0) console.log(`[BillGen] Generated ${generated} bills`);
  return generated;
}
