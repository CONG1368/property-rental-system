import Voucher from '../models/Voucher.js';
import VoucherEntry from '../models/VoucherEntry.js';
import ChartOfAccount from '../models/ChartOfAccount.js';
import Bill from '../models/Bill.js';
import { Op } from 'sequelize';
import dayjs from 'dayjs';

/** 将 period + periodType 展开为 YYYY-MM 月份列表 */
export function expandPeriods(period: string, periodType: string): string[] {
  switch (periodType) {
    case 'year': {
      const months: string[] = [];
      for (let m = 1; m <= 12; m++) months.push(`${period}-${String(m).padStart(2, '0')}`);
      return months;
    }
    case 'half-year': {
      // period 格式: "2025-1" (上半年) 或 "2025-2" (下半年)
      const [y, h] = period.split('-');
      const start = (Number(h) - 1) * 6 + 1;
      const months: string[] = [];
      for (let m = start; m < start + 6; m++) months.push(`${y}-${String(m).padStart(2, '0')}`);
      return months;
    }
    case 'quarter': {
      // period 格式: "2025-1" (Q1) ~ "2025-4" (Q4)
      const [y, q] = period.split('-');
      const start = (Number(q) - 1) * 3 + 1;
      const months: string[] = [];
      for (let m = start; m < start + 3; m++) months.push(`${y}-${String(m).padStart(2, '0')}`);
      return months;
    }
    default: // month
      return [period];
  }
}

export async function generateBalanceSheet(bookId: number, period: string, periodType = 'month') {
  const periods = expandPeriods(period, periodType);
  const accounts = await ChartOfAccount.findAll({
    where: { bookId, type: { [Op.in]: ['资产', '负债', '所有者权益'] } },
  });

  const assets: any[] = [];
  const liabilities: any[] = [];
  const equity: any[] = [];

  for (const account of accounts) {
    let balance = 0;
    // 资产负债表为时点报表：取截止最后一个月份的累计余额
    // 所有期间都纳入计算
    const entries = await VoucherEntry.findAll({
      where: { accountId: account.id },
      include: [{ model: Voucher, as: 'voucher', where: { period: { [Op.in]: periods } }, attributes: [] }],
    });
    balance = entries.reduce(
      (s: number, e: any) => s + Number(e.debitAmount) - Number(e.creditAmount),
      0
    );
    const item = { code: account.code, name: account.name, balance: Math.abs(balance) };
    if (account.type === '资产') assets.push(item);
    else if (account.type === '负债') liabilities.push(item);
    else equity.push(item);
  }

  return { assets, liabilities, equity };
}

export async function generateIncomeStatement(bookId: number, period: string, periodType = 'month') {
  const periods = expandPeriods(period, periodType);
  const accounts = await ChartOfAccount.findAll({
    where: { bookId, type: { [Op.in]: ['收入', '费用'] } },
  });

  const revenue: any[] = [];
  const costs: any[] = [];

  for (const account of accounts) {
    const entries = await VoucherEntry.findAll({
      where: { accountId: account.id },
      include: [{ model: Voucher, as: 'voucher', where: { period: { [Op.in]: periods } }, attributes: [] }],
    });
    const amount = entries.reduce(
      (s: number, e: any) => s + Number(e.creditAmount) - Number(e.debitAmount),
      0
    );
    const item = { code: account.code, name: account.name, amount: Math.abs(amount) };
    if (account.type === '收入') revenue.push(item);
    else costs.push(item);
  }

  const totalRevenue = revenue.reduce((s: number, r: any) => s + r.amount, 0);
  const totalCost = costs.reduce((s: number, r: any) => s + r.amount, 0);
  const netProfit = totalRevenue - totalCost;

  return { revenue, costs, totalRevenue, totalCost, netProfit };
}

export async function generateCashFlow(bookId: number, period: string, periodType = 'month') {
  const periods = expandPeriods(period, periodType);
  const { sequelize } = await import('../config/database.js');

  // 经营活动流入：已缴账单汇总
  const placeholders = periods.map(() => '?').join(',');
  const paidBills = await sequelize.query(
    `SELECT totalAmount FROM bills WHERE status = '已缴' AND substr(paidDate,1,7) IN (${placeholders})`,
    { replacements: periods, type: 'SELECT' as any }
  ) as any[];
  const operatingInflow = paidBills.reduce((s: number, b: any) => s + Number(b.totalAmount), 0);

  // 经营活动流出：费用付款
  const voucherEntries = await VoucherEntry.findAll({
    include: [{ model: Voucher, as: 'voucher', where: { period: { [Op.in]: periods }, type: '付' }, attributes: [] }],
    attributes: ['creditAmount'],
    raw: true,
  });
  const operatingOutflow = voucherEntries.reduce((s: number, e: any) => s + Number(e.creditAmount), 0);

  // 投资活动（简化：固定资产相关）
  const assetAccounts = await ChartOfAccount.findAll({
    where: { bookId, name: { [Op.like]: '%固定资产%' } },
    attributes: ['id'],
    raw: true,
  });
  const assetIds = assetAccounts.map((a) => a.id);
  let investingOutflow = 0;
  if (assetIds.length > 0) {
    const assetEntries = await VoucherEntry.findAll({
      where: { accountId: { [Op.in]: assetIds } },
      include: [{ model: Voucher, as: 'voucher', where: { period: { [Op.in]: periods } }, attributes: [] }],
      attributes: ['debitAmount'],
      raw: true,
    });
    investingOutflow = assetEntries.reduce((s: number, e: any) => s + Number(e.debitAmount), 0);
  }

  // 筹资活动（简化）
  const financingInflow = 0;
  const financingOutflow = 0;

  const operating = operatingInflow - operatingOutflow;
  const investing = -investingOutflow;
  const financing = financingInflow - financingOutflow;

  return {
    operating: [
      { code: 'OP01', name: '销售商品、提供劳务收到的现金', amount: operatingInflow },
      { code: 'OP02', name: '购买商品、接受劳务支付的现金', amount: -operatingOutflow },
    ],
    investing: [
      { code: 'IV01', name: '购建固定资产支付的现金', amount: investing },
    ],
    financing: [
      { code: 'FI01', name: '筹资活动现金净额', amount: financing },
    ],
    netCashFlow: operating + investing + financing,
  };
}
