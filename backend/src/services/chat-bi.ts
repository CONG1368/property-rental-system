import { Op, fn, col } from 'sequelize';
import WorkOrder from '../models/WorkOrder.js';
import Bill from '../models/Bill.js';
import Property from '../models/Property.js';
import Contract from '../models/Contract.js';
import MeterReading from '../models/MeterReading.js';
import Complaint from '../models/Complaint.js';
import dayjs from 'dayjs';

function monthOf(offset = 0): string { const d = dayjs().add(offset, 'month'); return d.format('YYYY-MM'); }
function money(v: number): string { return Number(v || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 }); }

// 收缴率
async function queryCollection(period: string) {
  const bills = await Bill.findAll({ where: { period }, attributes: ['status', 'totalAmount'], raw: true });
  const total = bills.reduce((s: number, b: any) => s + Number(b.totalAmount || 0), 0);
  const paid = bills.filter((b: any) => b.status === '已缴').reduce((s: number, b: any) => s + Number(b.totalAmount || 0), 0);
  return { total, paid, overdue: total - paid, rate: total > 0 ? Math.round((paid / total) * 10000) / 100 : 0, billCount: bills.length };
}
async function queryVacancy() {
  const total = await Property.count();
  const rented = await Property.count({ where: { status: '已出租' } });
  const vacant = await Property.count({ where: { status: '空置' } });
  return { total, rented, vacant, occupancyRate: total > 0 ? Math.round((rented / total) * 10000) / 100 : 0 };
}
async function queryRevenue() {
  const contracts = await Contract.findAll({ where: { status: '执行中' }, attributes: ['rentAmount'], raw: true });
  const monthly = contracts.reduce((s: number, c: any) => s + Number(c.rentAmount || 0), 0);
  return { monthlyRent: Math.round(monthly * 100) / 100, annualRent: Math.round(monthly * 12 * 100) / 100, contractCount: contracts.length };
}
async function queryEnergy() {
  const m = await MeterReading.findAll({ where: { period: monthOf(0) }, attributes: ['type', 'usage', 'amount'], raw: true });
  const water = m.filter((x: any) => x.type === '水').reduce((s: number, x: any) => s + Number(x.usage || 0), 0);
  const elec = m.filter((x: any) => x.type === '电').reduce((s: number, x: any) => s + Number(x.usage || 0), 0);
  const gas = m.filter((x: any) => x.type === '燃气').reduce((s: number, x: any) => s + Number(x.usage || 0), 0);
  const amount = m.reduce((s: number, x: any) => s + Number(x.amount || 0), 0);
  return { water, elec, gas, amount: Math.round(amount * 100) / 100 };
}
async function queryWorkorder(period: string) {
  const total = await WorkOrder.count();
  const month = await WorkOrder.count({ where: { createdAt: { [Op.between]: [period + '-01', period + '-31'] } } });
  const pending = await WorkOrder.count({ where: { status: '待派单' } });
  return { total, month, pending };
}
async function queryComplaint(period: string) {
  const total = await Complaint.count();
  const pending = await Complaint.count({ where: { status: '待受理' } });
  return { total, pending };
}
async function queryOverview() {
  const col = await queryCollection(monthOf());
  const vac = await queryVacancy();
  const rev = await queryRevenue();
  return { ...col, ...vac, ...rev };
}

export interface AnswerResult { answer: string; metric: string; period: string; data: any; }

export async function answerQuestion(q: string): Promise<AnswerResult> {
  const text = q.toLowerCase();
  let metric: string; if (/收缴|回款|收款/.test(text)) metric = 'collection';
  else if (/空置/.test(text)) metric = 'vacancy';
  else if (/收益|租金/.test(text)) metric = 'revenue';
  else if (/能耗|电|水|燃气|抄表/.test(text)) metric = 'energy';
  else if (/工单|报修|维修/.test(text)) metric = 'workorder';
  else if (/投诉/.test(text)) metric = 'complaint';
  else metric = 'overview';
  let period = monthOf(); if (/上月/.test(text)) period = monthOf(-1);
  let answer = ''; let data: any;
  switch (metric) {
    case 'collection': data = await queryCollection(period); answer = `${period} 应收 ${money(data.total)} 元，实收 ${money(data.paid)} 元，收缴率 ${data.rate}%，欠费 ${money(data.overdue)} 元（${data.billCount} 张账单）。`; break;
    case 'vacancy': data = await queryVacancy(); answer = `当前可用房源 ${data.total} 套，已出租 ${data.rented} 套，空置 ${data.vacant} 套，入住率 ${data.occupancyRate}%。`; break;
    case 'revenue': data = await queryRevenue(); answer = `执行中合同 ${data.contractCount} 份，月租金合计 ${money(data.monthlyRent)} 元，年化租金约 ${money(data.annualRent)} 元。`; break;
    case 'energy': data = await queryEnergy(); answer = `本月水 ${data.water} / 电 ${data.elec} / 燃气 ${data.gas}，费用合计 ${money(data.amount)} 元。`; break;
    case 'workorder': data = await queryWorkorder(period); answer = `${period} 新增工单 ${data.month} 张，待派单 ${data.pending} 张，累计 ${data.total} 张。`; break;
    case 'complaint': data = await queryComplaint(period); answer = `累计投诉 ${data.total} 件，待受理 ${data.pending} 件。`; break;
    default: data = await queryOverview(); answer = `本月应收 ${money(data.total)}、实收 ${money(data.paid)}、收缴率 ${data.rate}%；入住率 ${data.occupancyRate}%；月租金 ${money(data.monthlyRent)} 元。`;
  }
  return { answer, metric, period, data };
}
