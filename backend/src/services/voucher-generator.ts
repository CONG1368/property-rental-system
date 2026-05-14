import Voucher from '../models/Voucher.js';
import VoucherEntry from '../models/VoucherEntry.js';
import Bill from '../models/Bill.js';
import ChartOfAccount from '../models/ChartOfAccount.js';
import dayjs from 'dayjs';

async function getAccountId(code: string): Promise<number> {
  const acct = await ChartOfAccount.findOne({ where: { code }, attributes: ['id'], raw: true });
  return (acct as any)?.id || 0;
}

// 收租收入 → 自动生成凭证（租金/物业费/水电费分拆）
export async function generateRentVoucher(billId: number, userId: number): Promise<void> {
  const bill = await Bill.findByPk(billId);
  if (!bill || bill.status !== '已缴') return;

  const period = dayjs(bill.paidDate || new Date()).format('YYYY-MM');
  const voucherNo = `SK-${bill.billNo}`;

  const existing = await Voucher.findOne({ where: { voucherNo } });
  if (existing) return;

  const bankId = await getAccountId('1002');       // 银行存款
  const rentIncomeId = await getAccountId('6001');  // 租金收入
  const propIncomeId = await getAccountId('6051');  // 物业费收入
  const otherIncomeId = await getAccountId('6099'); // 其他业务收入

  const voucher = await Voucher.create({
    bookId: 1, voucherNo,
    date: bill.paidDate || new Date(), period, type: '收',
    summary: `收租-${bill.billNo}`, status: '已过账', createdBy: userId,
  });

  const totalAmount = Number(bill.totalAmount);
  const rentAmt = Number(bill.rentAmount || 0);
  const propAmt = Number((bill as any).propertyFee || bill.otherAmount || 0);
  const waterAmt = Number((bill as any).waterFee || 0);
  const elecAmt = Number((bill as any).electricFee || 0);
  const utilitySum = waterAmt + elecAmt;

  // 借: 银行存款（全额）
  await VoucherEntry.create({ voucherId: voucher.id, accountId: bankId, summary: `收租-${bill.billNo}`, debitAmount: totalAmount, creditAmount: 0, billId: bill.id });

  // 贷: 租金收入
  if (rentAmt > 0) {
    await VoucherEntry.create({ voucherId: voucher.id, accountId: rentIncomeId, summary: `租金收入-${bill.billNo}`, debitAmount: 0, creditAmount: rentAmt, billId: bill.id });
  }
  // 贷: 物业费收入
  if (propAmt > 0) {
    await VoucherEntry.create({ voucherId: voucher.id, accountId: propIncomeId, summary: `物业费收入-${bill.billNo}`, debitAmount: 0, creditAmount: propAmt, billId: bill.id });
  }
  // 贷: 其他业务收入（水电费）
  if (utilitySum > 0) {
    await VoucherEntry.create({ voucherId: voucher.id, accountId: otherIncomeId, summary: `水电费收入-${bill.billNo}`, debitAmount: 0, creditAmount: utilitySum, billId: bill.id });
  }

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

  const bankId = await getAccountId('1002');  // 银行存款

  // 费用类别→科目code映射
  const expenseCodeMap: Record<string, string> = {
    '维修': '5002', '保洁': '5003', '安保': '5004', '绿化': '5005',
    '办公': '5006', '折旧': '5007', '其他': '5001',
  };
  const expenseCode = expenseCodeMap[expense.category] || '5001';
  const expenseAcctId = await getAccountId(expenseCode);

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

  // 借: 费用科目  贷: 银行存款
  await VoucherEntry.create({
    voucherId: voucher.id,
    accountId: expenseAcctId,
    summary: `${expense.category}费`,
    debitAmount: Number(expense.amount),
    creditAmount: 0,
  });
  await VoucherEntry.create({
    voucherId: voucher.id,
    accountId: bankId,
    summary: `支付${expense.category}费`,
    debitAmount: 0,
    creditAmount: Number(expense.amount),
  });

  console.log(`[Voucher] Created expense voucher ${voucherNo}`);
}
