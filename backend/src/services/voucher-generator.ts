import Voucher from '../models/Voucher.js';
import VoucherEntry from '../models/VoucherEntry.js';
import Bill from '../models/Bill.js';
import dayjs from 'dayjs';

// 收租收入 → 自动生成凭证
export async function generateRentVoucher(billId: number, userId: number): Promise<void> {
  const bill = await Bill.findByPk(billId);
  if (!bill || bill.status !== '已缴') return;

  const period = dayjs(bill.paidDate || new Date()).format('YYYY-MM');
  const voucherNo = `SK-${bill.billNo}`;

  const existing = await Voucher.findOne({ where: { voucherNo } });
  if (existing) return;

  const voucher = await Voucher.create({
    bookId: 1,
    voucherNo,
    date: bill.paidDate || new Date(),
    period,
    type: '收',
    summary: `收租-${bill.billNo}`,
    status: '已过账',
    createdBy: userId,
  });

  // 借: 银行存款  贷: 租金收入
  await VoucherEntry.create({
    voucherId: voucher.id,
    accountId: 1001,   // 银行存款
    summary: `收到租金-${bill.billNo}`,
    debitAmount: Number(bill.totalAmount),
    creditAmount: 0,
    billId: bill.id,
  });
  await VoucherEntry.create({
    voucherId: voucher.id,
    accountId: 6001,   // 租金收入
    summary: `租金收入-${bill.billNo}`,
    debitAmount: 0,
    creditAmount: Number(bill.totalAmount),
    billId: bill.id,
  });

  console.log(`[Voucher] Created voucher ${voucherNo}`);
}

// 费用审批通过 → 自动生成凭证
export async function generateExpenseVoucher(expenseId: number, userId: number): Promise<void> {
  const Expense = (await import('../models/Expense.js')).default;
  const expense = await Expense.findByPk(expenseId);
  if (!expense || expense.status !== '已批准') return;

  const period = dayjs(new Date()).format('YYYY-MM');
  const voucherNo = `FK-${expenseId}`;
  const existing = await Voucher.findOne({ where: { voucherNo } });
  if (existing) return;

  const voucher = await Voucher.create({
    bookId: 1,
    voucherNo,
    date: new Date(),
    period,
    type: '付',
    summary: `费用支出-${expense.category}`,
    status: '已过账',
    createdBy: userId,
  });

  await VoucherEntry.create({
    voucherId: voucher.id,
    accountId: 5001,   // 管理费用
    summary: `${expense.category}费`,
    debitAmount: Number(expense.amount),
    creditAmount: 0,
  });
  await VoucherEntry.create({
    voucherId: voucher.id,
    accountId: 1001,   // 银行存款
    summary: `支付${expense.category}费`,
    debitAmount: 0,
    creditAmount: Number(expense.amount),
  });

  console.log(`[Voucher] Created expense voucher ${voucherNo}`);
}
