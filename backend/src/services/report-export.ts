import { Op, fn, col } from 'sequelize';
import * as XLSX from 'xlsx';
import Bill from '../models/Bill.js';
import Contract from '../models/Contract.js';
import Property from '../models/Property.js';
import Expense from '../models/Expense.js';
import MeterReading from '../models/MeterReading.js';
import WorkOrder from '../models/WorkOrder.js';
import FacilityMaintenance from '../models/FacilityMaintenance.js';
import CommonRevenue from '../models/CommonRevenue.js';
import Resident from '../models/Resident.js';
import Budget from '../models/Budget.js';
import ChartOfAccount from '../models/ChartOfAccount.js';
import Complaint from '../models/Complaint.js';
import dayjs from 'dayjs';

function money(v: number): string { return Number(v || 0).toFixed(2); }
function months(period: string, periodType = 'month'): string[] {
  const [y, m] = period.split('-').map(Number);
  const total = periodType === 'year' ? 12 : periodType === 'half-year' ? 6 : periodType === 'quarter' ? 3 : 1;
  const out: string[] = []; for (let i = 0; i < total; i++) { const d = new Date(y, (m - 1 + i), 1); out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`); }
  return out;
}

// 获取指定报表键的 rows
export async function getReportRows(key: string, params: any): Promise<{ rows: any[]; columns: string[]; title: string }> {
  const period = params.period || dayjs().format('YYYY-MM'); const periodType = params.periodType || 'month';
  const periods = months(period, periodType);
  switch (key) {
    case 'collection-rate': {
      const where: any = { period: { [Op.in]: periods } };
      if (params.projectId) { const p = await Property.findAll({ where: { projectId: Number(params.projectId) }, attributes: ['id'], raw: true }); const c = await Contract.findAll({ where: { propertyId: { [Op.in]: p.map((x:any)=>x.id) } }, attributes: ['id'], raw: true }); where.contractId = { [Op.in]: c.map((x:any)=>x.id) }; }
      const bills = await Bill.findAll({ where, attributes: ['period', 'status', 'totalAmount'], raw: true });
      const map: Record<string, any> = {}; periods.forEach(p => map[p] = { due: 0, paid: 0 });
      bills.forEach((b: any) => { const mm = map[b.period] || (map[b.period] = { due: 0, paid: 0 }); mm.due += Number(b.totalAmount); if (b.status === '已缴') mm.paid += Number(b.totalAmount); });
      const rows = periods.map(p => { const m = map[p]; const rate = m.due > 0 ? Math.round(m.paid / m.due * 10000) / 100 : 0; return { 月份: p, 应收: m.due, 实收: m.paid, 欠费: m.due - m.paid, 收缴率: rate + '%' }; });
      return { rows, columns: ['月份', '应收', '实收', '欠费', '收缴率'], title: '收缴率分析' };
    }
    case 'rent-summary': {
      const bills = await Bill.findAll({ where: { period: { [Op.in]: periods } }, include: [{ model: Contract, as: 'contract', include: [{ model: Property, as: 'property', attributes: ['type'] }] }], raw: false });
      const map: Record<string, any> = {};
      (bills as any[]).forEach((b) => { const t = b.contract?.property?.type || '其他'; if (!map[t]) map[t] = { due: 0, paid: 0 }; map[t].due += Number(b.totalAmount); if (b.status === '已缴') map[t].paid += Number(b.totalAmount); });
      const rows = Object.entries(map).map(([t, v]) => ({ 业态: t, 应收: v.due, 实收: v.paid, 收缴率: v.due > 0 ? Math.round(v.paid / v.due * 10000) / 100 + '%' : '0%' }));
      return { rows, columns: ['业态', '应收', '实收', '收缴率'], title: '收租汇总' };
    }
    case 'energy': {
      const mr = await MeterReading.findAll({ where: { period: { [Op.in]: periods } }, attributes: ['period', 'type', 'usage', 'amount'], raw: true });
      const map: Record<string, any> = {}; periods.forEach(p => map[p] = { water: 0, elec: 0, gas: 0, amount: 0 });
      mr.forEach((r: any) => { const m = map[r.period] || (map[r.period] = { water: 0, elec: 0, gas: 0, amount: 0 }); if (r.type === '水') m.water += Number(r.usage); else if (r.type === '电') m.elec += Number(r.usage); else m.gas += Number(r.usage); m.amount += Number(r.amount); });
      const rows = periods.map(p => { const m = map[p]; return { 月份: p, 水用量: m.water, 电用量: m.elec, 燃气用量: m.gas, 金额: money(m.amount) }; });
      return { rows, columns: ['月份', '水用量', '电用量', '燃气用量', '金额'], title: '能耗分析' };
    }
    case 'occupancy': {
      const types = ['公寓', '厂房', '商铺']; const rows = [];
      for (const t of types) { const total = await Property.count({ where: { type: t } }); const occ = await Property.count({ where: { type: t, status: '已出租' } }); if (total) rows.push({ 业态: t, 总数: total, 已出租: occ, 入住率: Math.round(occ / total * 10000) / 100 + '%' }); }
      return { rows, columns: ['业态', '总数', '已出租', '入住率'], title: '入驻率' };
    }
    case 'aging': {
      const now = new Date(); const overdue = await Bill.findAll({ where: { status: { [Op.in]: ['逾期', '部分缴'] } }, attributes: ['dueDate', 'totalAmount'], raw: true });
      const buckets = { b30: 0, b60: 0, b90: 0, b180: 0 };
      overdue.forEach((b: any) => { const days = Math.floor((now.getTime() - new Date(b.dueDate).getTime()) / 86400000); if (days <= 30) buckets.b30 += Number(b.totalAmount); else if (days <= 60) buckets.b60 += Number(b.totalAmount); else if (days <= 90) buckets.b90 += Number(b.totalAmount); else buckets.b180 += Number(b.totalAmount); });
      const rows = [{ 区间: '1-30天', 金额: buckets.b30 }, { 区间: '31-60天', 金额: buckets.b60 }, { 区间: '61-90天', 金额: buckets.b90 }, { 区间: '90天+', 金额: buckets.b180 }];
      return { rows, columns: ['区间', '金额'], title: '账龄分析' };
    }
    case 'revenue': {
      const contracts = await Contract.findAll({ where: { status: '执行中' }, include: [{ model: Property, as: 'property', attributes: ['type'] }], raw: false });
      const map: Record<string, any> = {};
      (contracts as any[]).forEach((c: any) => { const t = c.property?.type || '其他'; if (!map[t]) map[t] = { count: 0, rent: 0 }; map[t].count++; map[t].rent += Number(c.rentAmount); });
      const rows = Object.entries(map).map(([t, v]) => ({ 业态: t, 在租合同: v.count, 月租金: v.rent, 年化: v.rent * 12 }));
      return { rows, columns: ['业态', '在租合同', '月租金', '年化'], title: '收益预测' };
    }
    case 'work-order-cost': {
      const wos = await WorkOrder.findAll({ attributes: ['type', 'status', 'cost'], raw: true });
      const map: Record<string, any> = {};
      wos.forEach((w: any) => { if (!map[w.type]) map[w.type] = { count: 0, cost: 0 }; map[w.type].count++; map[w.type].cost += Number(w.cost); });
      const rows = Object.entries(map).map(([t, v]) => ({ 类型: '工单-' + t, 数量: v.count, 金额: money(v.cost) }));
      const mts = await FacilityMaintenance.findAll({ attributes: ['cost'], raw: true });
      rows.push({ 类型: '维保支出', 数量: mts.length, 金额: money(mts.reduce((s, x) => s + Number(x.cost || 0), 0)) });
      return { rows, columns: ['类型', '数量', '金额'], title: '工单成本' };
    }
    case 'tenant-retention': {
      const contracts = await Contract.findAll({ attributes: ['status', 'startDate', 'endDate'], raw: true });
      const now = Date.now();
      const exec = contracts.filter((c: any) => c.status === '执行中').length;
      const expired = contracts.filter((c: any) => ['已到期', '已终止'].includes(c.status)).length;
      const expiring = contracts.filter((c: any) => c.status === '执行中' && c.endDate && (new Date(c.endDate).getTime() - now) > 0 && (new Date(c.endDate).getTime() - now) < 30 * 86400000).length;
      const months = contracts.filter((c: any) => c.status === '执行中' && c.startDate && c.endDate).map((c: any) => (new Date(c.endDate).getTime() - new Date(c.startDate).getTime()) / (30 * 86400000));
      const avg = months.length ? Math.round(months.reduce((a, b) => a + b, 0) / months.length) : 0;
      return { rows: [{ 指标: '执行中合同', 数值: exec }, { 指标: '已到期/终止', 数值: expired }, { 指标: '30天内到期', 数值: expiring }, { 指标: '平均租期(月)', 数值: avg }], columns: ['指标', '数值'], title: '租户留存' };
    }
    case 'budget-vs-actual': {
      const budgets = await Budget.findAll({ attributes: ['accountId', 'budgetAmount', 'actualAmount'], raw: true });
      const accounts = await ChartOfAccount.findAll({ attributes: ['id', 'name', 'code'], raw: true }); const amap: Record<string, any> = {}; accounts.forEach((a: any) => amap[a.id] = a);
      const agg: Record<string, any> = {}; budgets.forEach((b: any) => { const k = String(b.accountId); if (!agg[k]) agg[k] = { b: 0, a: 0 }; agg[k].b += Number(b.budgetAmount); agg[k].a += Number(b.actualAmount); });
      const rows = Object.entries(agg).map(([k, v]) => { const ac = amap[k] || { name: '#' + k, code: '' }; return { 科目: ac.code ? ac.code + ' ' + ac.name : ac.name, 预算: v.b, 实际: v.a, 偏差率: v.b > 0 ? Math.round((v.b - v.a) / v.b * 10000) / 100 + '%' : '0%' }; });
      return { rows, columns: ['科目', '预算', '实际', '偏差率'], title: '预算偏差' };
    }
    case 'cashflow-forecast': {
      const now = new Date(); const list: string[] = [];
      for (let i = 0; i < 6; i++) { const d = new Date(now.getFullYear(), now.getMonth() + i, 1); list.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`); }
      const contracts = await Contract.findAll({ where: { status: '执行中' }, attributes: ['rentAmount'], raw: true });
      const rent = contracts.reduce((s, c) => s + Number(c.rentAmount || 0), 0);
      const sixAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      const exp = await Expense.findAll({ where: { createdAt: { [Op.gte]: sixAgo } }, attributes: ['amount'], raw: true });
      const avgExp = exp.length ? exp.reduce((s, e) => s + Number(e.amount || 0), 0) / exp.length : 0;
      let run = 0;
      const rows = list.map(m => { run += (rent - avgExp); return { 月份: m, 预计收入: money(rent), 预计支出: money(avgExp), 净额: money(rent - avgExp), 累计: money(run) }; });
      return { rows, columns: ['月份', '预计收入', '预计支出', '净额', '累计'], title: '现金流预测' };
    }
    default:
      return { rows: [], columns: [], title: '空报表' };
  }
}

// 服务端多表导出：一次生成多 Sheet Excel 并返回 Buffer
export async function buildExcelExport(reportKeys: string[], params: any): Promise<{ buffer: Buffer; filename: string }> {
  const wb = XLSX.utils.book_new();
  for (const key of reportKeys) {
    const { rows, columns, title } = await getReportRows(key, params);
    if (rows.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), title.slice(0, 31));
  }
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  return { buffer, filename: `报表包_${dayjs().format('YYYYMMDD')}.xlsx` };
}
