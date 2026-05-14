import { Router, Request, Response } from 'express';
import { generateBalanceSheet, generateIncomeStatement, generateCashFlow } from '../services/report-engine.js';
import AccountBook from '../models/AccountBook.js';
import Bill from '../models/Bill.js';
import Tenant from '../models/Tenant.js';
import Contract from '../models/Contract.js';
import Property from '../models/Property.js';
import Expense from '../models/Expense.js';
import { Op } from 'sequelize';

const router = Router();

async function getDefaultBookId(): Promise<number> {
  const book = await AccountBook.findOne({ order: [['id', 'ASC']] });
  return (book?.id || 1) as number;
}

// GET /reports/balance-sheet
router.get('/balance-sheet', async (_req: Request, res: Response) => {
  try {
    const bookId = await getDefaultBookId();
    const period = (_req.query.period as string) || new Date().toISOString().slice(0, 7);
    const periodType = (_req.query.periodType as string) || 'month';
    const data = await generateBalanceSheet(bookId, period, periodType);
    res.json({ code: 200, data: { ...data, period, periodType } });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message || '生成资产负债表失败' });
  }
});

// GET /reports/income-statement
router.get('/income-statement', async (_req: Request, res: Response) => {
  try {
    const bookId = await getDefaultBookId();
    const period = (_req.query.period as string) || new Date().toISOString().slice(0, 7);
    const periodType = (_req.query.periodType as string) || 'month';
    const data = await generateIncomeStatement(bookId, period, periodType);
    res.json({ code: 200, data: { ...data, period, periodType } });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message || '生成利润表失败' });
  }
});

// GET /reports/cash-flow
router.get('/cash-flow', async (_req: Request, res: Response) => {
  try {
    const bookId = await getDefaultBookId();
    const period = (_req.query.period as string) || new Date().toISOString().slice(0, 7);
    const periodType = (_req.query.periodType as string) || 'month';
    const data = await generateCashFlow(bookId, period, periodType);
    res.json({ code: 200, data: { ...data, period, periodType } });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message || '生成现金流量表失败' });
  }
});

// GET /reports/occupancy-report — 入驻率报表
router.get('/occupancy-report', async (_req: Request, res: Response) => {
  try {
    const total = await Property.count();
    const occupied = await Property.count({ where: { status: '已出租' } });
    const byType: any[] = [];
    const types = ['商铺', '写字楼', '公寓', '厂房'] as const;
    for (const t of types) {
      const tTotal = await Property.count({ where: { type: t } });
      const tOccupied = await Property.count({ where: { type: t, status: '已出租' } });
      if (tTotal > 0) byType.push({ type: t, total: tTotal, occupied: tOccupied, rate: Math.round((tOccupied / tTotal) * 10000) / 100 });
    }
    res.json({ code: 200, data: { total, occupied, rate: total > 0 ? Math.round((occupied / total) * 10000) / 100 : 0, byType } });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message || '生成入驻率报表失败' }); }
});

// GET /reports/aging-report — 账龄分析报表
router.get('/aging-report', async (_req: Request, res: Response) => {
  try {
    const now = new Date();
    const overdueBills = await Bill.findAll({
      where: { status: { [Op.in]: ['逾期', '部分缴'] } },
      attributes: ['dueDate', 'totalAmount'],
      raw: true,
    });
    let bucket30 = 0, bucket60 = 0, bucket90 = 0, bucket180 = 0, count30 = 0, count60 = 0, count90 = 0, count180 = 0;
    overdueBills.forEach((b: any) => {
      const days = Math.floor((now.getTime() - new Date(b.dueDate).getTime()) / 86400000);
      if (days <= 30) { bucket30 += Number(b.totalAmount); count30++; }
      else if (days <= 60) { bucket60 += Number(b.totalAmount); count60++; }
      else if (days <= 90) { bucket90 += Number(b.totalAmount); count90++; }
      else { bucket180 += Number(b.totalAmount); count180++; }
    });
    const aging = [
      { label: '1-30天', amount: bucket30, count: count30 },
      { label: '31-60天', amount: bucket60, count: count60 },
      { label: '61-90天', amount: bucket90, count: count90 },
      { label: '90天以上', amount: bucket180, count: count180 },
    ];
    const totalOverdue = overdueBills.length;
    const totalAmount = overdueBills.reduce((s, b) => s + Number(b.totalAmount), 0);
    res.json({ code: 200, data: { aging, totalOverdue, totalAmount } });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message || '生成账龄分析失败' }); }
});

// GET /reports/custom — 支持多种自定义报表
router.get('/custom', async (req: Request, res: Response) => {
  try {
    const type = req.query.type as string || 'rent-summary';
    const period = (req.query.period as string) || new Date().toISOString().slice(0, 7);

    switch (type) {
      case 'rent-summary': {
        // 收租汇总表
        const bills = await Bill.findAll({
          where: { period },
          include: [
            { model: Contract, as: 'contract', include: [{ model: Property, as: 'property', attributes: ['name', 'type'] }] },
          ],
          raw: false,
        });
        const propertyTypeMap: Record<string, { due: number; collected: number; count: number }> = {};
        (bills as any[]).forEach((b) => {
          const pt = (b.contract as any)?.property?.type || '其他';
          if (!propertyTypeMap[pt]) propertyTypeMap[pt] = { due: 0, collected: 0, count: 0 };
          propertyTypeMap[pt].due += Number(b.totalAmount);
          if (b.status === '已缴') propertyTypeMap[pt].collected += Number(b.totalAmount);
          propertyTypeMap[pt].count++;
        });
        const columns = ['业态', '应收', '实收', '欠费', '收缴率', '户数'];
        const rows = Object.entries(propertyTypeMap).map(([type, v]) => ({
          '业态': type,
          '应收': v.due,
          '实收': v.collected,
          '欠费': v.due - v.collected,
          '收缴率': v.due > 0 ? Math.round((v.collected / v.due) * 10000) / 100 : 0,
          '户数': v.count,
        }));
        res.json({ code: 200, data: { rows, columns } });
        break;
      }
      case 'arrears-detail': {
        // 欠费明细表
        const overdueBills = await Bill.findAll({
          where: { status: { [Op.in]: ['逾期', '部分缴'] } },
          include: [
            { model: Contract, as: 'contract', include: [{ model: Tenant, as: 'tenant', attributes: ['name', 'phone'] }, { model: Property, as: 'property', attributes: ['name'] }] },
          ],
          order: [['dueDate', 'ASC']],
          limit: 200,
        });
        const columns = ['租客', '电话', '房源', '账期', '金额', '到期日', '逾期天数'];
        const rows = (overdueBills as any[]).map((b) => ({
          '租客': b.contract?.tenant?.name || '-',
          '电话': b.contract?.tenant?.phone || '-',
          '房源': b.contract?.property?.name || '-',
          '账期': b.period,
          '金额': Number(b.totalAmount),
          '到期日': b.dueDate,
          '逾期天数': Math.floor((Date.now() - new Date(b.dueDate).getTime()) / 86400000),
        }));
        res.json({ code: 200, data: { rows, columns } });
        break;
      }
      case 'cost-analysis': {
        // 成本分析表 — period 为 YYYY-MM 格式，取年份
        const year = period.slice(0, 4);
        const expenses = await Expense.findAll({
          where: { createdAt: { [Op.between]: [`${year}-01-01`, `${year}-12-31`] } as any },
          attributes: ['category', 'amount', 'status'],
          raw: true,
        });
        const categoryMap: Record<string, number> = {};
        expenses.forEach((e: any) => {
          if (!categoryMap[e.category]) categoryMap[e.category] = 0;
          categoryMap[e.category] += Number(e.amount);
        });
        const totalCost = Object.values(categoryMap).reduce((s, v) => s + v, 0);
        const columns = ['类别', '金额', '占比'];
        const rows = Object.entries(categoryMap).map(([name, amount]) => ({
          '类别': name,
          '金额': amount,
          '占比': totalCost > 0 ? Math.round((amount / totalCost) * 10000) / 100 : 0,
        }));
        res.json({ code: 200, data: { rows, columns } });
        break;
      }
      default:
        res.json({ code: 200, data: { rows: [], columns: [] } });
    }
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message || '生成自定义报表失败' });
  }
});

export default router;
