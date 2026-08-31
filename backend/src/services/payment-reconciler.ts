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
    notes: '',
  } as any);

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
  await bill.update({ status, paymentChannel: channel } as any);

  // 如果全额付清，自动生成财务凭证
  // 注意：凭证生成属于**后置副作用**，失败不得回滚/中断支付对账——
  // 否则支付平台收到 5xx 会重复回调，造成重复收款记录。
  if (status === '已缴') {
    try {
      await generateRentVoucher(billId, userId);
    } catch (err: any) {
      console.error(`[Payment] 账单 ${billId} 凭证生成失败（不影响收款）:`, err?.message || err);
    }
  }

  // 更新租客信用评分（同样是后置副作用，失败仅告警）
  const contract = (bill as any).contract;
  if (contract?.tenantId) {
    try {
      await calculateCreditScore(contract.tenantId);
    } catch (err: any) {
      console.error(`[Payment] 租客 ${contract.tenantId} 信用评分刷新失败（不影响收款）:`, err?.message || err);
    }
  }

  console.log(`[Payment] Reconciled bill ${bill.billNo}: ${amount} via ${channel}`);
}
