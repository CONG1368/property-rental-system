import { Router, Request, Response, NextFunction } from 'express';
import { generateBalanceSheet, generateIncomeStatement, generateCashFlow, expandDateRange } from '../services/report-engine.js';
import { getReportCatalog } from '../services/report-registry.js';
import AccountBook from '../models/AccountBook.js';
import Bill from '../models/Bill.js';
import Tenant from '../models/Tenant.js';
import Contract from '../models/Contract.js';
import Property from '../models/Property.js';
import Expense from '../models/Expense.js';
import MeterReading from '../models/MeterReading.js';
import Budget from '../models/Budget.js';
import ChartOfAccount from '../models/ChartOfAccount.js';
import WorkOrder from '../models/WorkOrder.js';
import FacilityMaintenance from '../models/FacilityMaintenance.js';
import { Op } from 'sequelize';

const router = Router();

async function getDefaultBookId(): Promise<number> {
  const book = await AccountBook.findOne({ order: [['id', 'ASC']] });
  return (book?.id || 1) as number;
}

// 报表级授权：以 report-registry 的 roles 为唯一权威
// 挂载于 /reports 下，req.query.type 用于自定义报表；req.path 为 /xxx（无 /reports 前缀）
function resolveReportDef(req: Request): { roles: string[] } | null {
  const typeParam = String(req.query.type || '');
  const pathKey = req.path.replace(/^\/+/, '').split('/')[0];
  const cat = getReportCatalog();
  if (typeParam) {
    // 自定义报表：按 params.type 精确匹配
    const def = cat.find((d: any) => d.params?.type === typeParam);
    if (def) return def;
  }
  if (pathKey && pathKey !== 'custom') {
    // 专用端点：按 endpoint 末段匹配（如 /balance-sheet、/occupancy-report）
    const def = cat.find((d: any) => d.endpoint && d.endpoint.replace(/^\/reports\//, '') === pathKey);
    if (def) return def;
  }
  return null;
}
async function reportAuthz(req: Request, res: Response, next: NextFunction) {
  try {
    const def = resolveReportDef(req);
    const role = (req as any).role || '';
    if (!def) return res.status(403).json({ code: 403, message: '报表未定义或无权访问' });
    const allowed = !!def.roles.includes(role);
    if (!allowed) return res.status(403).json({ code: 403, message: '权限不足' });
    next();
  } catch { return res.status(500).json({ code: 500, message: '报表权限校验失败' }); }
}

/** 解析请求中的日期范围或周期参数 */
function parsePeriodParams(req: Request) {
  const startDate = req.query.startDate as string | undefined;
  const endDate = req.query.endDate as string | undefined;
  const period = (req.query.period as string) || new Date().toISOString().slice(0, 7);
  const periodType = (req.query.periodType as string) || 'month';
  return { startDate, endDate, period, periodType };
}

// GET /reports/registry — 统一报表目录（前端据此渲染，含角色/推荐）
router.get('/registry', async (_req: Request, res: Response) => {
  try { res.json({ code: 200, data: { list: getReportCatalog() } }); }
  catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// 数据报表端点按报表类型做细粒度授权（registry 已先行，不受限）
router.use(reportAuthz);

// GET /reports/balance-sheet
router.get('/balance-sheet', async (_req: Request, res: Response) => {
  try {
    const bookId = await getDefaultBookId();
    const { startDate, endDate, period, periodType } = parsePeriodParams(_req);
    const data = await generateBalanceSheet(bookId, period, periodType, startDate, endDate);
    res.json({ code: 200, data: { ...data, period, periodType, startDate, endDate } });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message || '生成资产负债表失败' });
  }
});

// GET /reports/income-statement
router.get('/income-statement', async (_req: Request, res: Response) => {
  try {
    const bookId = await getDefaultBookId();
    const { startDate, endDate, period, periodType } = parsePeriodParams(_req);
    const data = await generateIncomeStatement(bookId, period, periodType, startDate, endDate);
    res.json({ code: 200, data: { ...data, period, periodType, startDate, endDate } });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message || '生成利润表失败' });
  }
});

// GET /reports/cash-flow
router.get('/cash-flow', async (_req: Request, res: Response) => {
  try {
    const bookId = await getDefaultBookId();
    const { startDate, endDate, period, periodType } = parsePeriodParams(_req);
    const data = await generateCashFlow(bookId, period, periodType, startDate, endDate);
    res.json({ code: 200, data: { ...data, period, periodType, startDate, endDate } });
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
    const occColumns = ['业态', '总数', '已出租', '入住率'];
    const occRows = byType.map((t: any) => ({ '业态': t.type, '总数': t.total, '已出租': t.occupied, '入住率': t.rate + '%' }));
    res.json({ code: 200, data: { rows: occRows, columns: occColumns, total, occupied, rate: total > 0 ? Math.round((occupied / total) * 10000) / 100 : 0, byType } });
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
    const agingColumns = ['账龄区间', '笔数', '金额'];
    const agingRows = aging.map((a: any) => ({ '账龄区间': a.label, '笔数': a.count, '金额': a.amount }));
    res.json({ code: 200, data: { rows: agingRows, columns: agingColumns, aging, totalOverdue, totalAmount } });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message || '生成账龄分析失败' }); }
});

// GET /reports/custom — 支持多种自定义报表，支持自定义日期范围
router.get('/custom', async (req: Request, res: Response) => {
  try {
    const type = req.query.type as string || 'rent-summary';
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    const period = (req.query.period as string) || new Date().toISOString().slice(0, 7);

    // 计算查询所用的月份列表
    const periods = startDate && endDate ? expandDateRange(startDate, endDate) : [period];

    switch (type) {
      case 'rent-summary': {
        // 收租汇总表 — 支持日期范围或单月，可按项目/业态钻取
        let rsContractIds: number[] | undefined;
        const rsProjectId = req.query.projectId as string | undefined;
        const rsType = req.query.type as string | undefined;
        if (rsProjectId || rsType) {
          const propWhere: any = {};
          if (rsProjectId) propWhere.projectId = Number(rsProjectId);
          if (rsType) propWhere.type = rsType;
          const props = await Property.findAll({ where: propWhere, attributes: ['id'], raw: true });
          const pids = props.map(p => (p as any).id);
          const contracts = await Contract.findAll({ where: { propertyId: { [Op.in]: pids } }, attributes: ['id'], raw: true });
          rsContractIds = contracts.map(c => (c as any).id);
        }
        const bills = await Bill.findAll({
          where: { period: { [Op.in]: periods }, ...(rsContractIds ? { contractId: { [Op.in]: rsContractIds } } : {}) },
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
        res.json({ code: 200, data: { rows, columns, period, startDate, endDate } });
        break;
      }
      case 'arrears-detail': {
        // 欠费明细表 — 支持日期范围过滤 overdue bills 的 dueDate
        const where: any = { status: { [Op.in]: ['逾期', '部分缴'] } };
        if (startDate && endDate) {
          where.dueDate = { [Op.between]: [startDate + '-01', endDate + '-31'] };
        }
        const overdueBills = await Bill.findAll({
          where,
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
        res.json({ code: 200, data: { rows, columns, period, startDate, endDate } });
        break;
      }
      case 'cost-analysis': {
        // 成本分析表 — 支持日期范围或按月/年
        let start: string, end: string;
        if (startDate && endDate) {
          start = startDate + '-01';
          end = endDate + '-31';
        } else {
          const year = period.slice(0, 4);
          start = year + '-01-01';
          end = year + '-12-31';
        }
        const expenses = await Expense.findAll({
          where: { createdAt: { [Op.between]: [start, end] } as any },
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
        res.json({ code: 200, data: { rows, columns, period, startDate, endDate } });
        break;
      }
      case 'collection-rate': {
        // 收缴率经营分析 — 按账期聚合应收/实收/欠费/收缴率，支持项目/业态钻取 + 环比
        const projectId = req.query.projectId as string | undefined;
        const type = req.query.type as string | undefined;
        let contractIds: number[] | undefined;
        if (projectId || type) {
          const propWhere: any = {};
          if (projectId) propWhere.projectId = Number(projectId);
          if (type) propWhere.type = type;
          const props = await Property.findAll({ where: propWhere, attributes: ['id'], raw: true });
          const pids = props.map(p => (p as any).id);
          const contracts = await Contract.findAll({ where: { propertyId: { [Op.in]: pids } }, attributes: ['id'], raw: true });
          contractIds = contracts.map(c => (c as any).id);
        }
        const billWhere: any = { period: { [Op.in]: periods } };
        if (contractIds) billWhere.contractId = { [Op.in]: contractIds };
        const bills = await Bill.findAll({ where: billWhere, attributes: ['period', 'status', 'totalAmount'], raw: true });
        const monthMap: Record<string, { due: number; paid: number; count: number }> = {};
        periods.forEach(p => { monthMap[p] = { due: 0, paid: 0, count: 0 }; });
        bills.forEach((b: any) => { if (!monthMap[b.period]) monthMap[b.period] = { due: 0, paid: 0, count: 0 }; const m = monthMap[b.period]; m.due += Number(b.totalAmount); if (b.status === '已缴') m.paid += Number(b.totalAmount); m.count++; });
        const crRows = periods.map((p, i) => {
          const m = monthMap[p];
          const rate = m.due > 0 ? Math.round((m.paid / m.due) * 10000) / 100 : 0;
          const prev = i > 0 ? monthMap[periods[i - 1]] : null;
          const prevRate = prev && prev.due > 0 ? Math.round((prev.paid / prev.due) * 10000) / 100 : 0;
          return { '月份': p, '应收': m.due, '实收': m.paid, '欠费': m.due - m.paid, '收缴率': rate + '%', '环比': i > 0 ? (rate - prevRate).toFixed(1) + '%' : '-' };
        });
        res.json({ code: 200, data: { rows: crRows, columns: ['月份', '应收', '实收', '欠费', '收缴率', '环比'], period, startDate, endDate } });
        break;
      }
      case 'energy-analysis': {
        // 能耗（水电气）分析 — 按账期聚合用量/金额/未生成账单
        const meterReadings = await MeterReading.findAll({ where: { period: { [Op.in]: periods } }, attributes: ['period', 'type', 'usage', 'amount', 'billed'], raw: true });
        const enMap: Record<string, { water: number; elec: number; gas: number; amount: number; unbilled: number; count: number }> = {};
        periods.forEach(p => { enMap[p] = { water: 0, elec: 0, gas: 0, amount: 0, unbilled: 0, count: 0 }; });
        meterReadings.forEach((r: any) => { const m = enMap[r.period]; if (!m) return; if (r.type === '水') m.water += Number(r.usage || 0); else if (r.type === '电') m.elec += Number(r.usage || 0); else if (r.type === '燃气') m.gas += Number(r.usage || 0); m.amount += Number(r.amount || 0); if (r.billed === '未生成') m.unbilled += Number(r.amount || 0); m.count++; });
        const enRows = periods.map(p => { const m = enMap[p]; return { '月份': p, '水用量': m.water, '电用量': m.elec, '燃气用量': m.gas, '总金额': Math.round(m.amount * 100) / 100, '未生成账单': Math.round(m.unbilled * 100) / 100, '抄表数': m.count }; });
        res.json({ code: 200, data: { rows: enRows, columns: ['月份', '水用量', '电用量', '燃气用量', '总金额', '未生成账单', '抄表数'], period, startDate, endDate } });
        break;
      }
      case 'revenue-forecast': {
        // 收益预测 — 按业态聚合执行中合同月租金，估算月/年化收益
        const contracts = await Contract.findAll({ where: { status: '执行中' }, include: [{ model: Property, as: 'property', attributes: ['type'] }], raw: false });
        const revMap: Record<string, { count: number; rent: number }> = {};
        (contracts as any[]).forEach(c => { const t = c.property?.type || '其他'; if (!revMap[t]) revMap[t] = { count: 0, rent: 0 }; revMap[t].count++; revMap[t].rent += Number(c.rentAmount || 0); });
        const totalRent = Object.values(revMap).reduce((s, v) => s + v.rent, 0);
        const totalContracts = Object.values(revMap).reduce((s, v) => s + v.count, 0);
        const revRows = Object.entries(revMap).map(([type, v]) => ({ '业态': type, '在租合同': v.count, '月租金合计': Math.round(v.rent * 100) / 100, '年化租金': Math.round(v.rent * 12 * 100) / 100, '占比': totalRent > 0 ? Math.round((v.rent / totalRent) * 10000) / 100 : 0 }));
        res.json({ code: 200, data: { rows: revRows, columns: ['业态', '在租合同', '月租金合计', '年化租金', '占比'], totalMonthlyRent: Math.round(totalRent * 100) / 100, totalContracts, period, startDate, endDate } });
        break;
      }
      case 'work-order-cost': {
        // 工单/维保成本分析 — 按类型聚合数量/完工/成本 + 维保费用
        const wos = await WorkOrder.findAll({ attributes: ['type', 'status', 'cost'], raw: true });
        const typeMap: Record<string, { count: number; finished: number; cost: number }> = {};
        wos.forEach((w: any) => { const t = w.type || '其他'; if (!typeMap[t]) typeMap[t] = { count: 0, finished: 0, cost: 0 }; typeMap[t].count++; if (w.status === '已完工') typeMap[t].finished++; typeMap[t].cost += Number(w.cost || 0); });
        const mts = await FacilityMaintenance.findAll({ attributes: ['type', 'cost'], raw: true });
        let maintTotal = 0; let maintCount = 0;
        mts.forEach((m: any) => { maintTotal += Number(m.cost || 0); maintCount++; });
        const woRows = Object.entries(typeMap).map(([t, v]) => ({ '类型': '工单-' + t, '数量': v.count, '已完工': v.finished, '金额': Math.round(v.cost * 100) / 100 }));
        woRows.push({ '类型': '维保支出', '数量': maintCount, '已完工': maintCount, '金额': Math.round(maintTotal * 100) / 100 });
        res.json({ code: 200, data: { rows: woRows, columns: ['类型', '数量', '已完工', '金额'], period, startDate, endDate } });
        break;
      }
      case 'tenant-retention': {
        // 租户流失/续约率 — 合同状态/到期/平均租期概览
        const contracts = await Contract.findAll({ attributes: ['status', 'startDate', 'endDate'], raw: true });
        const now = Date.now();
        const exec = contracts.filter((c: any) => c.status === '执行中').length;
        const expired = contracts.filter((c: any) => c.status === '已到期' || c.status === '已终止').length;
        const expiring30 = contracts.filter((c: any) => c.status === '执行中' && c.endDate && (new Date(c.endDate).getTime() - now) > 0 && (new Date(c.endDate).getTime() - now) < 30 * 86400000).length;
        const months = contracts.filter((c: any) => c.status === '执行中' && c.startDate && c.endDate).map((c: any) => (new Date(c.endDate).getTime() - new Date(c.startDate).getTime()) / (30 * 86400000));
        const avgMonths = months.length ? Math.round(months.reduce((a: number, b: number) => a + b, 0) / months.length) : 0;
        res.json({ code: 200, data: { rows: [
          { '指标': '执行中合同', '数值': exec },
          { '指标': '已到期/已终止合同', '数值': expired },
          { '指标': '30天内到期合同', '数值': expiring30 },
          { '指标': '平均租期(月)', '数值': avgMonths },
        ], columns: ['指标', '数值'], period, startDate, endDate } });
        break;
      }
      case 'budget-vs-actual': {
        // 预算 vs 实际偏差
        const budgets = await Budget.findAll({ attributes: ['accountId', 'budgetAmount', 'actualAmount'], raw: true });
        const accounts = await ChartOfAccount.findAll({ attributes: ['id', 'name', 'code'], raw: true });
        const accMap: Record<string, any> = {}; accounts.forEach((a: any) => { accMap[a.id] = a; });
        const agg: Record<string, { budget: number; actual: number }> = {};
        budgets.forEach((b: any) => { const k = String(b.accountId); if (!agg[k]) agg[k] = { budget: 0, actual: 0 }; agg[k].budget += Number(b.budgetAmount || 0); agg[k].actual += Number(b.actualAmount || 0); });
        const rows = Object.entries(agg).map(([k, v]) => { const acc = accMap[k] || { name: '#' + k, code: '' }; const diff = v.budget - v.actual; return { '科目': acc.code ? acc.code + ' ' + acc.name : acc.name, '预算': Math.round(v.budget * 100) / 100, '实际': Math.round(v.actual * 100) / 100, '偏差': Math.round(diff * 100) / 100, '偏差率': v.budget > 0 ? Math.round((diff / v.budget) * 10000) / 100 : 0 }; });
        res.json({ code: 200, data: { rows, columns: ['科目', '预算', '实际', '偏差', '偏差率'], period, startDate, endDate } });
        break;
      }
      case 'cashflow-forecast': {
        // 现金流程预测：未来6个月 收入(月租金+月均物业费) - 支出(近6月月均费用) = 净现金流
        const now = new Date();
        const monthList: string[] = [];
        for (let i = 0; i < 6; i++) { const d = new Date(now.getFullYear(), now.getMonth() + i, 1); monthList.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')); }
        const contracts = await Contract.findAll({ where: { status: '执行中' }, attributes: ['rentAmount'], raw: true });
        const monthlyRent = contracts.reduce((s: number, c: any) => s + Number(c.rentAmount || 0), 0);
        // 近6月账单物业费月均
        const sixAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
        const recentBills = await Bill.findAll({ where: { createdAt: { [Op.gte]: sixAgo } }, attributes: ['propertyFee'], raw: true });
        const avgPropFee = recentBills.length ? recentBills.reduce((s: number, b: any) => s + Number(b.propertyFee || 0), 0) / recentBills.length : 0;
        // 近6月费用月均(支出)
        const recentExp = await Expense.findAll({ where: { createdAt: { [Op.gte]: sixAgo } }, attributes: ['amount'], raw: true });
        const avgExpense = recentExp.length ? recentExp.reduce((s: number, e: any) => s + Number(e.amount || 0), 0) / recentExp.length : 0;
        const monthlyIncome = Math.round((monthlyRent + avgPropFee) * 100) / 100;
        let running = 0;
        const rows = monthList.map((m) => {
          const income = monthlyIncome; const expense = Math.round(avgExpense * 100) / 100;
          running = Math.round((running + income - expense) * 100) / 100;
          return { '月份': m, '预计收入': income, '预计支出': expense, '净现金流': Math.round((income - expense) * 100) / 100, '累计净额': running };
        });
        res.json({ code: 200, data: { rows, columns: ['月份', '预计收入', '预计支出', '净现金流', '累计净额'], period, startDate, endDate } });
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
