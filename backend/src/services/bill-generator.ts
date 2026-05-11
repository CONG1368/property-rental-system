import { Op } from 'sequelize';
import Contract from '../models/Contract.js';
import Bill from '../models/Bill.js';
import dayjs from 'dayjs';

export async function generateBills(): Promise<number> {
  const today = dayjs().format('YYYY-MM-DD');
  const activeContracts = await Contract.findAll({
    where: { status: '执行中' },
  });

  let generated = 0;
  for (const contract of activeContracts) {
    const lastBill = await Bill.findOne({
      where: { contractId: contract.id },
      order: [['createdAt', 'DESC']],
    });

    let nextDueDate: string;
    if (!lastBill) {
      nextDueDate = contract.startDate;
    } else {
      const cycle = contract.paymentCycle;
      const lastDate = dayjs(lastBill.dueDate || lastBill.createdAt);
      const months = cycle === '月' ? 1 : cycle === '季' ? 3 : 12;
      nextDueDate = lastDate.add(months, 'month').format('YYYY-MM-DD');
    }

    // Only generate if next bill date is within the current month
    const nextMonth = dayjs().add(1, 'month').format('YYYY-MM');
    if (nextDueDate.startsWith(nextMonth)) {
      continue; // Too early, skip
    }

    const currentPeriod = dayjs(nextDueDate).format('YYYY-MM');
    const existing = await Bill.findOne({
      where: { contractId: contract.id, period: currentPeriod },
    });
    if (existing) continue;

    const billNo = `BL-${contract.contractNo}-${currentPeriod}`;
    await Bill.create({
      contractId: contract.id,
      billNo,
      period: currentPeriod,
      rentAmount: contract.rentAmount,
      utilityAmount: 0,
      otherAmount: 0,
      totalAmount: Number(contract.rentAmount),
      dueDate: nextDueDate,
      status: '未缴',
    });
    generated++;
  }

  console.log(`[BillGen] Generated ${generated} bills`);
  return generated;
}
