import Voucher from '../models/Voucher.js';
import VoucherEntry from '../models/VoucherEntry.js';
import ChartOfAccount from '../models/ChartOfAccount.js';
import Bill from '../models/Bill.js';
import { Op } from 'sequelize';
import dayjs from 'dayjs';

export async function generateBalanceSheet(bookId: number, period: string) {
  const accounts = await ChartOfAccount.findAll({
    where: { bookId, type: { [Op.in]: ['资产', '负债', '所有者权益'] } },
  });

  const assets: any[] = [];
  const liabilities: any[] = [];
  const equity: any[] = [];

  for (const account of accounts) {
    const entries = await VoucherEntry.findAll({
      where: { accountId: account.id },
      include: [{ model: Voucher, as: 'voucher', where: { period }, attributes: [] }],
    });
    const balance = entries.reduce(
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

export async function generateIncomeStatement(bookId: number, period: string) {
  const accounts = await ChartOfAccount.findAll({
    where: { bookId, type: { [Op.in]: ['收入', '费用'] } },
  });

  const revenue: any[] = [];
  const costs: any[] = [];

  for (const account of accounts) {
    const entries = await VoucherEntry.findAll({
      where: { accountId: account.id },
      include: [{ model: Voucher, as: 'voucher', where: { period }, attributes: [] }],
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
