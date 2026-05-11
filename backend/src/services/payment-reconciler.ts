import Bill from '../models/Bill.js';
import PaymentRecord from '../models/PaymentRecord.js';
import Contract from '../models/Contract.js';
import { Op } from 'sequelize';
import { generateRentVoucher } from './voucher-generator.js';
import { calculateCreditScore } from './credit-scorer.js';

export async function reconcilePayment(
  billId: number,
  amount: number,
  channel: string,
  transactionNo: string,
  userId: number
): Promise<void> {
  const bill = await Bill.findByPk(billId, {
    include: [{ model: Contract, as: 'contract' }],
  });
  if (!bill) throw new Error('账单不存在');

  // 创建收款记录
  await PaymentRecord.create({
    billId,
    amount,
    channel,
    transactionNo,
    paidAt: new Date(),
    createdBy: userId,
  });

  // 更新账单状态
  const totalPaid = await PaymentRecord.sum('amount', { where: { billId } });
  const billTotal = Number(bill.totalAmount);
  let status: string;
  if (totalPaid >= billTotal) {
    status = '已缴';
    bill.set('paidDate', new Date());
  } else if (totalPaid > 0) {
    status = '部分缴';
  } else {
    status = '未缴';
  }
  await bill.update({ status, paymentChannel: channel });

  // 如果全额付清，自动生成财务凭证
  if (status === '已缴') {
    await generateRentVoucher(billId, userId);
  }

  // 更新租客信用评分
  const contract = (bill as any).contract;
  if (contract?.tenantId) {
    await calculateCreditScore(contract.tenantId);
  }

  console.log(`[Payment] Reconciled bill ${bill.billNo}: ${amount} via ${channel}`);
}
