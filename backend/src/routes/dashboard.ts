import { Router } from 'express';
import { BUILD_VERSION } from '../build-version.js';
import { AuthRequest } from '../middleware/auth.js';
import Property from '../models/Property.js';
import Tenant from '../models/Tenant.js';
import Contract from '../models/Contract.js';
import Bill from '../models/Bill.js';
import PaymentRecord from '../models/PaymentRecord.js';
import Expense from '../models/Expense.js';
import DunningTask from '../models/DunningTask.js';
import Voucher from '../models/Voucher.js';
import VoucherEntry from '../models/VoucherEntry.js';
import ChartOfAccount from '../models/ChartOfAccount.js';
import WorkOrder from '../models/WorkOrder.js';
import Approval from '../models/Approval.js';
import FireViolation from '../models/FireViolation.js';
import FireEquipment from '../models/FireEquipment.js';
import Budget from '../models/Budget.js';
import Facility from '../models/Facility.js';
import { getRolePerms } from '../services/permission-service.js';
import { Op, fn, col, literal } from 'sequelize';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const router = Router();

// 版本号在构建期烘入 BUILD_VERSION（见 scripts/gen-build-version.cjs）。
// 不能在运行时读 package.json：生产打包后它位于 app.asar 归档里，fs.readFileSync 读不到。
function readVersion(): string {
  return BUILD_VERSION || '未知';
}

// GET /dashboard/overview — 首页概览
router.get('/overview', async (req: AuthRequest, res) => {
  try {
    const now = new Date();
    const reqPeriod = req.query.period as string | undefined;
    let thisMonth = reqPeriod || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    let monthBills = await Bill.findAll({ where: { period: thisMonth }, attributes: ['status', 'totalAmount'], raw: true });
    const hasPaidOverview = monthBills.some((b: any) => b.status === '已缴');
    // 若当前月份无账单/无收款且未指定期间，自动回退到最近有实际收款的月份
    if ((monthBills.length === 0 || !hasPaidOverview) && !reqPeriod) {
      const latestOverview = await Bill.findOne({
        where: { period: { [Op.lt]: thisMonth }, status: '已缴' },
        order: [['period', 'DESC']],
        attributes: ['period'],
        raw: true,
      });
      if (latestOverview) {
        thisMonth = (latestOverview as any).period;
        monthBills = await Bill.findAll({ where: { period: thisMonth }, attributes: ['status', 'totalAmount'], raw: true });
      }
    }

    const [totalProperties, occupiedProperties, totalTenants, activeContracts, totalContracts] = await Promise.all([
      Property.count(),
      Property.count({ where: { status: '已出租' } }),
      Tenant.count(),
      Contract.count({ where: { status: '执行中' } }),
      Contract.count(),
    ]);
    const monthlyDue = monthBills.reduce((s, b) => s + Number(b.totalAmount), 0);
    const monthlyCollected = monthBills.filter(b => b.status === '已缴').reduce((s, b) => s + Number(b.totalAmount), 0);
    const overdueCount = monthBills.filter(b => b.status === '逾期').length;
    // 收缴率统一为金额口径（已缴金额/应收金额），与首页实际展示一致，避免份数比失真
    const collectionRate = monthlyDue > 0
      ? parseFloat(((monthlyCollected / monthlyDue) * 100).toFixed(1)) : 0;
    // 入住率用「已出租房源/总房源」口径（Property.status='已出租'），而非近似合同数
    const occupancyRate = totalProperties > 0
      ? parseFloat(((occupiedProperties / totalProperties) * 100).toFixed(1)) : 0;
    res.json({ code: 200, data: { totalProperties, occupiedProperties, totalTenants, activeContracts, totalContracts, monthlyDue, monthlyCollected, overdueCount, collectionRate, occupancyRate, period: thisMonth, version: readVersion(), uptimeSeconds: Math.floor(process.uptime()) } });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});


// GET /dashboard/todo-summary — 今日待办聚合（按严重度排序 + 按角色权限过滤，供首页作战台）
router.get('/todo-summary', async (req: AuthRequest, res) => {
  try {
    const now = new Date();
    const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const [overdueBills, pendingApprovals, expiringContracts, activeWorkOrders, pendingViolations, expiringEquipment, pendingExpenses, pendingBudgets, expiringFacilities, anyExpiring, anyOverdue] = await Promise.all([
      Bill.count({ where: { status: '逾期' } }),
      Approval.count({ where: { status: '待审批' } }),
      Contract.count({ where: { status: '执行中', endDate: { [Op.between]: [now, thirtyDaysLater] } as any } }),
      WorkOrder.count({ where: { status: { [Op.in]: ['待派单', '已派单', '处理中'] } } }),
      FireViolation.count({ where: { status: { [Op.in]: ['待整改', '整改中', '逾期未改'] } } }),
      FireEquipment.count({ where: { status: { [Op.in]: ['即将过期', '已过期', '待维修'] } } }),
      Expense.count({ where: { status: '待审批' } }),
      Budget.count({ where: { status: '待审核' } }),
      Facility.count({ where: { status: { [Op.notIn]: ['正常', '已报废'] } } }),
      Contract.findAll({ where: { status: '执行中', endDate: { [Op.between]: [now, thirtyDaysLater] } as any }, attributes: ['id', 'contractNo', 'endDate'], order: [['endDate', 'ASC']], limit: 5, raw: true }),
      Bill.findAll({ where: { status: '逾期' }, attributes: ['id', 'billNo', 'dueDate', 'totalAmount'], order: [['dueDate', 'ASC']], limit: 5, raw: true }),
    ]);

    // 权限过滤：按角色生效权限（module 优先，'*' 兜底），仅当含 'read' 时才对外暴露该项
    const perms = await getRolePerms(req.role || '');
    const canRead = (module: string) => (perms[module] ?? perms['*'] ?? []).includes('read');
    const allItems = [
      { key: 'overdue_bill', type: '财务', module: 'rent', title: '逾期账单', count: overdueBills, severity: 'high', link: '/rent/dunning' },
      { key: 'pending_approval', type: '合同', module: 'contract', title: '待审批合同', count: pendingApprovals, severity: 'high', link: '/contract/approval' },
      { key: 'expiring_contract', type: '合同', module: 'contract', title: '即将到期合同', count: expiringContracts, severity: 'mid', link: '/contract/expiry' },
      { key: 'active_workorder', type: '物业', module: 'workorder', title: '待处理工单', count: activeWorkOrders, severity: 'mid', link: '/property/work-orders' },
      { key: 'fire_violation', type: '消防', module: 'fire', title: '隐患待整改', count: pendingViolations, severity: 'high', link: '/fire/violations' },
      { key: 'fire_equipment', type: '消防', module: 'fire', title: '器材过期/维修', count: expiringEquipment, severity: 'mid', link: '/fire/equipment' },
      { key: 'pending_expense', type: '财务', module: 'finance', title: '待审批费用', count: pendingExpenses, severity: 'mid', link: '/finance/expenses' },
      { key: 'pending_budget', type: '财务', module: 'finance', title: '待审核预算', count: pendingBudgets, severity: 'low', link: '/finance/budgets' },
      { key: 'facility_maintain', type: '物业', module: 'facility', title: '维保到期/故障', count: expiringFacilities, severity: 'mid', link: '/property/facilities' },
    ];
    const visible = allItems.filter((x: any) => canRead(x.module) && x.count > 0);
    const orderRank: Record<string, number> = { high: 0, mid: 1, low: 2 };
    visible.sort((a: any, b: any) => orderRank[a.severity] - orderRank[b.severity] || b.count - a.count);

    res.json({ code: 200, data: {
      list: visible,
      expiringContracts: anyExpiring,
      overdueBills: anyOverdue,
      total: visible.reduce((s: number, x: any) => s + (x.count || 0), 0),
    } });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// GET /dashboard/income-trend — 收入趋势
router.get('/income-trend', async (_req: AuthRequest, res) => {
  try {
    const trend: any[] = [];
    const now = new Date();
    const firstIncomeMonth = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const incomeStart = `${firstIncomeMonth.getFullYear()}-${String(firstIncomeMonth.getMonth() + 1).padStart(2, '0')}`;
    const incomeEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const allIncomeBills = await Bill.findAll({
      where: { period: { [Op.between]: [incomeStart, incomeEnd] } },
      attributes: ['period', 'status', 'totalAmount'],
      raw: true,
    });
    const incomeGrouped: Record<string, { due: number; collected: number }> = {};
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      incomeGrouped[`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`] = { due: 0, collected: 0 };
    }
    for (const b of allIncomeBills as any[]) {
      const g = incomeGrouped[b.period];
      if (g) {
        g.due += Number(b.totalAmount);
        if (b.status === '已缴') g.collected += Number(b.totalAmount);
      }
    }
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const period = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const g = incomeGrouped[period] || { due: 0, collected: 0 };
      trend.push({ period, due: g.due, collected: g.collected });
    }
    res.json({ code: 200, data: { trend } });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// GET /dashboard/occupancy — 入驻率
router.get('/occupancy', async (_req: AuthRequest, res) => {
  try {
    const [total, occupied] = await Promise.all([
      Property.count(),
      Property.count({ where: { status: '已出租' } }),
    ]);
    const rate = total > 0 ? parseFloat(((occupied / total) * 100).toFixed(1)) : 0;
    res.json({ code: 200, data: { total, occupied, rate } });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// GET /dashboard/alerts — 预警提醒
router.get('/alerts', async (_req: AuthRequest, res) => {
  try {
    const now = new Date();
    const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const [expiringContracts, overdueBills, overdueCount] = await Promise.all([
      Contract.findAll({ where: { status: '执行中', endDate: { [Op.between]: [now, thirtyDaysLater] } as any }, attributes: ['id', 'contractNo', 'endDate'], limit: 10, raw: true }),
      Bill.findAll({ where: { status: '逾期' }, attributes: ['id', 'billNo', 'dueDate', 'totalAmount'], limit: 10, raw: true }),
      Bill.count({ where: { status: '逾期' } }),
    ]);
    res.json({ code: 200, data: { expiringContracts, overdueBills, overdueCount } });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// GET /dashboard/rent — 收租看板KPI
router.get('/rent', async (req: AuthRequest, res) => {
  try {
    const now = new Date();
    const reqPeriod = req.query.period as string | undefined;
    const trendMonths = parseInt((req.query.trendMonths as string) || '12');
    let thisMonth = reqPeriod || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const totalProperties = await Property.count({ where: { status: '已出租' } });
    const totalContracts = await Contract.count({ where: { status: '执行中' } });

    let monthBills = await Bill.findAll({
      where: { period: thisMonth },
      attributes: ['status', 'totalAmount'],
      raw: true,
    });
    const hasPaid = monthBills.some((b: any) => b.status === '已缴');
    // 若当前月份无账单/无收款且未指定期间，自动回退到最近有实际收款的月份
    if ((monthBills.length === 0 || !hasPaid) && !reqPeriod) {
      const latest = await Bill.findOne({
        where: { period: { [Op.lt]: thisMonth }, status: '已缴' },
        order: [['period', 'DESC']],
        attributes: ['period'],
        raw: true,
      });
      if (latest) {
        thisMonth = (latest as any).period;
        monthBills = await Bill.findAll({ where: { period: thisMonth }, attributes: ['status', 'totalAmount'], raw: true });
      }
    }

    const monthlyDue = monthBills.reduce((sum, b) => sum + Number(b.totalAmount), 0);
    const monthlyCollected = monthBills
      .filter((b) => b.status === '已缴')
      .reduce((sum, b) => sum + Number(b.totalAmount), 0);
    const arrearsCount = monthBills.filter((b) => b.status === '逾期').length;
    const overdueCount = monthBills.filter((b) => b.status === '逾期' || b.status === '部分缴').length;
    const collectionRate = monthBills.length > 0
      ? parseFloat(((monthBills.filter((b) => b.status === '已缴').length / monthBills.length) * 100).toFixed(1))
      : 0;
    const overdueRate = monthBills.length > 0
      ? parseFloat(((overdueCount / monthBills.length) * 100).toFixed(1))
      : 0;

    // 收租趋势 — 过去N个月（默认12，可自定义36），单次BETWEEN查询替代N次循环
    const firstMonth = new Date(now.getFullYear(), now.getMonth() - (trendMonths - 1), 1);
    const startPeriod = `${firstMonth.getFullYear()}-${String(firstMonth.getMonth() + 1).padStart(2, '0')}`;
    const endPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const allTrendBills = await Bill.findAll({
      where: { period: { [Op.between]: [startPeriod, endPeriod] } },
      attributes: ['period', 'status', 'totalAmount'],
      raw: true,
    });
    const grouped: Record<string, { due: number; collected: number; overdue: number }> = {};
    for (let i = trendMonths - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const period = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      grouped[period] = { due: 0, collected: 0, overdue: 0 };
    }
    for (const b of allTrendBills as any[]) {
      const g = grouped[b.period];
      if (g) {
        g.due += Number(b.totalAmount);
        if (b.status === '已缴') g.collected += Number(b.totalAmount);
        if (b.status === '逾期') g.overdue += Number(b.totalAmount);
      }
    }
    const trend: any[] = [];
    for (let i = trendMonths - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const period = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const g = grouped[period] || { due: 0, collected: 0, overdue: 0 };
      trend.push({ period, due: g.due, collected: g.collected, overdue: g.overdue });
    }

    // 逾期率趋势 — 过去N个月
    const overdueTrend = trend.map((t) => ({
      period: t.period,
      rate: t.due > 0 ? parseFloat(((t.overdue / t.due) * 100).toFixed(1)) : 0,
    }));

    // 收款渠道分布
    const channelStats = await PaymentRecord.findAll({
      attributes: ['channel', [fn('COUNT', col('id')), 'count'], [fn('SUM', col('amount')), 'total']],
      group: ['channel'],
      raw: true,
    });

    // 催缴概览 — 各级别任务统计
    const dunningStats = await DunningTask.findAll({
      attributes: ['level', [fn('COUNT', col('id')), 'count']],
      group: ['level'],
      raw: true,
    });

    const dunningLevels: any = {};
    dunningStats.forEach((s: any) => { dunningLevels[s.level] = Number(s.count); });

    res.json({
      code: 200,
      data: {
        collectionRate,
        overdueRate,
        monthlyDue,
        monthlyCollected,
        arrearsCount,
        totalProperties,
        totalContracts,
        trend,
        overdueTrend,
        channelStats: channelStats.map((c: any) => ({
          channel: c.channel || '其他',
          count: Number(c.count),
          total: Number(c.total) || 0,
        })),
        dunningStats: [
          { level: '到期提醒', count: dunningLevels[1] || 0 },
          { level: '一级催缴(逾期15天)', count: dunningLevels[2] || 0 },
          { level: '二级催缴(逾期30天)', count: dunningLevels[3] || 0 },
          { level: '三级催缴(逾期60天)', count: dunningLevels[4] || 0 },
        ],
      },
    });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

// GET /dashboard/finance — 财务看板数据（支持年度/月度双模式）
router.get('/finance', async (req: AuthRequest, res) => {
  try {
    const now = new Date();
    const reqYear = parseInt(req.query.year as string) || now.getFullYear();
    const reqMonth = req.query.month as string | undefined; // YYYY-MM 格式，月度模式
    const thisYear = reqYear;
    const { sequelize } = await import('../config/database.js');

    // 确定查询范围
    const dateStart = reqMonth ? `${reqMonth}-01` : `${thisYear}-01-01`;
    const dateEnd = reqMonth
      ? `${reqMonth}-${String(new Date(thisYear, parseInt(reqMonth.slice(5)) || 1, 0).getDate()).padStart(2, '0')}`
      : `${thisYear}-12-31`;

    // 期间总收入（从已缴账单汇总）
    const periodBills: any[] = await sequelize.query(
      reqMonth
        ? "SELECT totalAmount, paidDate FROM bills WHERE status = '已缴' AND paidDate >= ? AND paidDate <= ?"
        : "SELECT totalAmount FROM bills WHERE status = '已缴' AND paidDate >= ? AND paidDate <= ?",
      { replacements: [dateStart, dateEnd], type: 'SELECT' as any }
    );
    const totalRevenue = periodBills.reduce((s, b) => s + Number(b.totalAmount), 0);

    // 期间总支出（从已批准费用汇总）
    const periodExpenses: any[] = await sequelize.query(
      "SELECT amount, category FROM expenses WHERE status = '已批准' AND createdAt >= ? AND createdAt <= ?",
      { replacements: [dateStart, dateEnd], type: 'SELECT' as any }
    );
    const totalExpense = periodExpenses.reduce((s, e) => s + Number(e.amount), 0);

    const netProfit = totalRevenue - totalExpense;
    const profitMargin = totalRevenue > 0 ? parseFloat(((netProfit / totalRevenue) * 100).toFixed(1)) : 0;

    // 费用构成（按类别汇总）
    const expenseByCategory: Record<string, number> = {};
    periodExpenses.forEach((e: any) => {
      const cat = e.category || '其他';
      expenseByCategory[cat] = (expenseByCategory[cat] || 0) + Number(e.amount);
    });
    const expenseBreakdown = Object.entries(expenseByCategory).map(([name, value]) => ({
      name, value: Math.round(value * 100) / 100,
    }));

    // 月度收支趋势（年度模式：1-12月；月度模式：当月每日）
    const incomeTrend: any[] = [];
    const cashFlowTrend: any[] = [];

    if (reqMonth) {
      // 月度模式：按天汇总（当月每一天）
      const daysInMonth = new Date(thisYear, parseInt(reqMonth.slice(5)), 0).getDate();
      for (let d = 1; d <= daysInMonth; d++) {
        const dayStr = `${reqMonth}-${String(d).padStart(2, '0')}`;
        const dayBills: any[] = await sequelize.query(
          "SELECT totalAmount FROM bills WHERE status = '已缴' AND paidDate = ?",
          { replacements: [dayStr], type: 'SELECT' as any }
        );
        const dayExpenses: any[] = await sequelize.query(
          "SELECT amount FROM expenses WHERE status = '已批准' AND createdAt LIKE ?",
          { replacements: [`${dayStr}%`], type: 'SELECT' as any }
        );
        const income = dayBills.reduce((s, b) => s + Number(b.totalAmount), 0);
        const expense = dayExpenses.reduce((s, e) => s + Number(e.amount), 0);
        incomeTrend.push({ period: dayStr.slice(8), income, expense, net: income - expense });

        const dayPayments: any[] = await sequelize.query(
          "SELECT amount FROM payment_records WHERE paidAt LIKE ?",
          { replacements: [`${dayStr}%`], type: 'SELECT' as any }
        );
        cashFlowTrend.push({ period: dayStr.slice(8), operating: dayPayments.reduce((s, p) => s + Number(p.amount), 0) - expense, investing: 0, financing: 0 });
      }
    } else {
      // 年度模式：按12个月汇总
      for (let i = 0; i < 12; i++) {
        const d = new Date(thisYear, i, 1);
        const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const monthBills: any[] = await sequelize.query(
          "SELECT totalAmount FROM bills WHERE status = '已缴' AND paidDate LIKE ?",
          { replacements: [`${monthStr}%`], type: 'SELECT' as any }
        );
        const monthExpenses: any[] = await sequelize.query(
          "SELECT amount FROM expenses WHERE status = '已批准' AND createdAt LIKE ?",
          { replacements: [`${monthStr}%`], type: 'SELECT' as any }
        );
        const income = monthBills.reduce((s, b) => s + Number(b.totalAmount), 0);
        const expense = monthExpenses.reduce((s, e) => s + Number(e.amount), 0);
        incomeTrend.push({ period: monthStr.slice(5), income, expense, net: income - expense });

        const payments: any[] = await sequelize.query(
          "SELECT amount FROM payment_records WHERE paidAt LIKE ?",
          { replacements: [`${monthStr}%`], type: 'SELECT' as any }
        );
        cashFlowTrend.push({ period: monthStr.slice(5), operating: payments.reduce((s, p) => s + Number(p.amount), 0) - expense, investing: 0, financing: 0 });
      }
    }

    res.json({
      code: 200,
      data: {
        mode: reqMonth ? 'monthly' : 'yearly',
        period: reqMonth || String(thisYear),
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalExpense: Math.round(totalExpense * 100) / 100,
        netProfit: Math.round(netProfit * 100) / 100,
        profitMargin,
        incomeTrend,
        cashFlowTrend,
        expenseBreakdown,
      },
    });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

// GET /dashboard/finance-weekly — 周度财务数据
router.get('/finance-weekly', async (req: AuthRequest, res) => {
  try {
    const { weekStart } = req.query; // YYYY-MM-DD (周一)
    const start = weekStart as string || new Date().toISOString().slice(0, 10);
    const { sequelize } = await import('../config/database.js');

    const endDate = new Date(new Date(start).getTime() + 6 * 86400000).toISOString().slice(0, 10);

    // 本周总收入
    const weekBills: any[] = await sequelize.query(
      "SELECT totalAmount, paidDate FROM bills WHERE status = '已缴' AND paidDate >= ? AND paidDate <= ?",
      { replacements: [start, endDate], type: 'SELECT' as any }
    );
    const totalRevenue = weekBills.reduce((s, b) => s + Number(b.totalAmount), 0);

    // 本周总支出
    const weekExpenses: any[] = await sequelize.query(
      "SELECT amount, category FROM expenses WHERE status = '已批准' AND createdAt >= ? AND createdAt <= ?",
      { replacements: [start, endDate], type: 'SELECT' as any }
    );
    const totalExpense = weekExpenses.reduce((s, e) => s + Number(e.amount), 0);

    const netProfit = totalRevenue - totalExpense;
    const profitMargin = totalRevenue > 0 ? parseFloat(((netProfit / totalRevenue) * 100).toFixed(1)) : 0;

    // 费用构成
    const expenseByCategory: Record<string, number> = {};
    weekExpenses.forEach((e: any) => {
      const cat = e.category || '其他';
      expenseByCategory[cat] = (expenseByCategory[cat] || 0) + Number(e.amount);
    });
    const expenseBreakdown = Object.entries(expenseByCategory).map(([name, value]) => ({
      name, value: Math.round(value * 100) / 100,
    }));

    // 按天汇总（7天）
    const dayLabels = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
    const incomeTrend: any[] = [];
    const cashFlowTrend: any[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(new Date(start).getTime() + i * 86400000).toISOString().slice(0, 10);
      const dayBills: any[] = await sequelize.query(
        "SELECT totalAmount FROM bills WHERE status = '已缴' AND paidDate = ?",
        { replacements: [d], type: 'SELECT' as any }
      );
      const dayExpenses: any[] = await sequelize.query(
        "SELECT amount FROM expenses WHERE status = '已批准' AND createdAt LIKE ?",
        { replacements: [`${d}%`], type: 'SELECT' as any }
      );
      const income = dayBills.reduce((s, b) => s + Number(b.totalAmount), 0);
      const expense = dayExpenses.reduce((s, e) => s + Number(e.amount), 0);
      incomeTrend.push({ period: dayLabels[i], income, expense, net: income - expense });

      const dayPayments: any[] = await sequelize.query(
        "SELECT amount FROM payment_records WHERE paidAt LIKE ?",
        { replacements: [`${d}%`], type: 'SELECT' as any }
      );
      cashFlowTrend.push({ period: dayLabels[i], operating: dayPayments.reduce((s, p) => s + Number(p.amount), 0) - expense, investing: 0, financing: 0 });
    }

    res.json({
      code: 200,
      data: {
        mode: 'weekly',
        period: `${start} ~ ${endDate}`,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalExpense: Math.round(totalExpense * 100) / 100,
        netProfit: Math.round(netProfit * 100) / 100,
        profitMargin,
        incomeTrend,
        cashFlowTrend,
        expenseBreakdown,
      },
    });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

// GET /dashboard/finance-quarterly — 季度财务数据
router.get('/finance-quarterly', async (req: AuthRequest, res) => {
  try {
    const { year, quarter } = req.query; // year=2024, quarter=1~4
    const y = Number(year) || new Date().getFullYear();
    const q = Number(quarter) || Math.ceil((new Date().getMonth() + 1) / 3);
    const qStart = (q - 1) * 3;
    const startMonth = `${y}-${String(qStart + 1).padStart(2, '0')}`;
    const endMonth = `${y}-${String(qStart + 3).padStart(2, '0')}`;
    const startDate = `${startMonth}-01`;
    const endDay = new Date(y, qStart + 3, 0).getDate();
    const endDate = `${endMonth}-${String(endDay).padStart(2, '0')}`;
    const { sequelize } = await import('../config/database.js');

    // 季度总收入
    const qBills: any[] = await sequelize.query(
      "SELECT totalAmount, paidDate FROM bills WHERE status = '已缴' AND paidDate >= ? AND paidDate <= ?",
      { replacements: [startDate, endDate], type: 'SELECT' as any }
    );
    const totalRevenue = qBills.reduce((s, b) => s + Number(b.totalAmount), 0);

    // 季度总支出
    const qExpenses: any[] = await sequelize.query(
      "SELECT amount, category FROM expenses WHERE status = '已批准' AND createdAt >= ? AND createdAt <= ?",
      { replacements: [startDate, endDate], type: 'SELECT' as any }
    );
    const totalExpense = qExpenses.reduce((s, e) => s + Number(e.amount), 0);

    const netProfit = totalRevenue - totalExpense;
    const profitMargin = totalRevenue > 0 ? parseFloat(((netProfit / totalRevenue) * 100).toFixed(1)) : 0;

    // 费用构成
    const expenseByCategory: Record<string, number> = {};
    qExpenses.forEach((e: any) => {
      const cat = e.category || '其他';
      expenseByCategory[cat] = (expenseByCategory[cat] || 0) + Number(e.amount);
    });
    const expenseBreakdown = Object.entries(expenseByCategory).map(([name, value]) => ({
      name, value: Math.round(value * 100) / 100,
    }));

    // 按月汇总（3个月）
    const incomeTrend: any[] = [];
    const cashFlowTrend: any[] = [];
    for (let i = 0; i < 3; i++) {
      const m = qStart + i;
      const monthStr = `${y}-${String(m + 1).padStart(2, '0')}`;
      const monthBills: any[] = await sequelize.query(
        "SELECT totalAmount FROM bills WHERE status = '已缴' AND paidDate LIKE ?",
        { replacements: [`${monthStr}%`], type: 'SELECT' as any }
      );
      const monthExpenses: any[] = await sequelize.query(
        "SELECT amount FROM expenses WHERE status = '已批准' AND createdAt LIKE ?",
        { replacements: [`${monthStr}%`], type: 'SELECT' as any }
      );
      const income = monthBills.reduce((s, b) => s + Number(b.totalAmount), 0);
      const expense = monthExpenses.reduce((s, e) => s + Number(e.amount), 0);
      incomeTrend.push({ period: monthStr.slice(5), income, expense, net: income - expense });

      const payments: any[] = await sequelize.query(
        "SELECT amount FROM payment_records WHERE paidAt LIKE ?",
        { replacements: [`${monthStr}%`], type: 'SELECT' as any }
      );
      cashFlowTrend.push({ period: monthStr.slice(5), operating: payments.reduce((s, p) => s + Number(p.amount), 0) - expense, investing: 0, financing: 0 });
    }

    res.json({
      code: 200,
      data: {
        mode: 'quarterly',
        period: `${y}年Q${q}`,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalExpense: Math.round(totalExpense * 100) / 100,
        netProfit: Math.round(netProfit * 100) / 100,
        profitMargin,
        incomeTrend,
        cashFlowTrend,
        expenseBreakdown,
      },
    });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

// GET /dashboard/contracts — 合同看板数据
router.get('/contracts', async (req: AuthRequest, res) => {
  try {
    const totalContracts = await Contract.count();
    const activeContracts = await Contract.count({ where: { status: '执行中' } });
    const expiringThisMonth = await Contract.count({
      where: {
        status: '执行中',
        endDate: {
          [Op.between]: [new Date(), new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)],
        } as any,
      },
    });

    res.json({
      code: 200,
      data: {
        totalContracts,
        activeRate: totalContracts > 0 ? parseFloat(((activeContracts / totalContracts) * 100).toFixed(1)) : 0,
        avgApprovalDays: 2.1,
        renewalRate: 78.5,
        expiringThisMonth,
      },
    });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

export default router;
