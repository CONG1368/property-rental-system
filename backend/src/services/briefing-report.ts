import { Op, fn, col } from 'sequelize';
import fs from 'fs';
import path from 'path';
import WorkOrder from '../models/WorkOrder.js';
import Facility from '../models/Facility.js';
import Complaint from '../models/Complaint.js';
import Bill from '../models/Bill.js';
import CommonRevenue from '../models/CommonRevenue.js';
import MeterReading from '../models/MeterReading.js';
import ParkingRecord from '../models/ParkingRecord.js';
import Resident from '../models/Resident.js';
import dayjs from 'dayjs';

const REPORT_DIR = path.join(process.cwd(), 'reports');
function ensureDir() { if (!fs.existsSync(REPORT_DIR)) fs.mkdirSync(REPORT_DIR, { recursive: true }); }
function money(v: number): string { return Number(v || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 }); }
function lastMonths(n: number): string[] {
  const out: string[] = []; const d = new Date();
  for (let i = n - 1; i >= 0; i--) { const m = new Date(d.getFullYear(), d.getMonth() - i, 1); out.push(`${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`); }
  return out;
}

// 聚合经营简报数据
function normLines(text: string): string[] { return text.replace(/\r\n/g, '\n').split('\n').filter(p => p.trim()); }
function wrapParagraphs(text: string): string {
  const lines = normLines(text);
  if (!lines.length) return '';
  return lines.map(p => `<p style="text-indent:2em;margin:4px 0;line-height:1.8">${p}</p>`).join('');
}
function esc(s: string): string { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;'); }

// 构建 A4 报表 HTML
export function buildBriefingHTML(d: any): string {
  const theme = '#0A3D62';
  const kpiCards = d.kpis.map((k: any) => `<div class="kpi"><div class="kpi-v">${esc(k.value)}</div><div class="kpi-l">${esc(k.label)}</div></div>`).join('');
  const rows = d.trend && d.trend.length
    ? d.trend.map((t: any) => `<tr><td>${t.month}</td><td>${t.work}</td><td>${t.comp}</td><td class="num">${money(t.total)}</td><td class="num">${money(t.paid)}</td><td>${t.rate}%</td></tr>`).join('')
    : '<tr><td colspan="6" style="text-align:center;color:#909399">暂无数据</td></tr>';
  const structBlocks = d.structure.map((s: any) => {
    const items = s.data && s.data.length ? s.data.map((x: any) => `<div class="si">${esc(x.name)}：<b>${esc(x.value)}</b>${s.money ? ' 元' : ''}</div>`).join('') : '<div class="si" style="color:#909399">暂无</div>';
    return `<div class="struct"><div class="st">${esc(s.name)}</div>${items}</div>`;
  }).join('');
  const pred = d.prediction || {};
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><title>${esc(d.title)}</title>
<style>
@page { size: A4; margin: 18mm 16mm; }
* { box-sizing:border-box; }
body { font-family:"Microsoft YaHei","PingFang SC",sans-serif; color:#303133; font-size:13px; line-height:1.6; }
.hd { border-bottom:2px solid ${theme}; padding-bottom:10px; margin-bottom:14px; }
.hd h1 { margin:0; color:${theme}; font-size:22px; }
.hd .meta { color:#909399; font-size:12px; margin-top:6px; }
.kpis { display:flex; flex-wrap:wrap; gap:10px; margin-bottom:16px; }
.kpi { flex:1 1 22%; min-width:130px; border:1px solid #ebeef5; border-radius:6px; padding:12px; text-align:center; }
.kpi-v { font-size:20px; font-weight:700; color:${theme}; }
.kpi-l { margin-top:4px; color:#909399; font-size:12px; }
h3 { color:${theme}; font-size:15px; margin:16px 0 8px; border-left:3px solid ${theme}; padding-left:8px; }
table { width:100%; border-collapse:collapse; font-size:12px; }
th,td { border:1px solid #ebeef5; padding:6px 8px; text-align:center; }
th { background:#f5f7fa; color:${theme}; }
td.num { text-align:right; }
.structs { display:flex; flex-wrap:wrap; gap:10px; }
.struct { flex:1 1 45%; border:1px solid #ebeef5; border-radius:6px; padding:10px; }
.st { font-weight:600; color:${theme}; margin-bottom:6px; }
.si { font-size:12px; line-height:1.8; }
.pred p { margin:6px 0; }
.brief { background:#f5f7fa; border-radius:6px; padding:14px 16px; }
.footer { margin-top:24px; text-align:right; color:#909399; font-size:12px; }
</style></head><body>
<div class="hd"><h1>${esc(d.title)}</h1><div class="meta">报告期：${esc(d.reportPeriod)} ｜ 生成时间：${esc(d.generatedAt)}</div></div>
<div class="kpis">${kpiCards}</div>
<h3>一、近 6 个月运营趋势</h3>
<table><thead><tr><th>月份</th><th>工单数</th><th>投诉数</th><th>应收(元)</th><th>实收(元)</th><th>收缴率</th></tr></thead><tbody>${rows}</tbody></table>
<h3>二、结构占比</h3><div class="structs">${structBlocks}</div>
<h3>三、预测与关注</h3><div class="pred">
<p>下月工单预测：<b>${pred.forecastNextWork ?? 0}</b> 单（近 6 月均值 ${pred.workAvg ?? 0}）。</p>
<p>本月账单收缴率：<b>${pred.curCollectionRate ?? 0}%</b>。未生成账单抄表：<b>${money(pred.meterUnbilled ?? 0)}</b> 元。停车累计收入：<b>${money(pred.parkingRevenue ?? 0)}</b> 元。</p></div>
<h3>四、经营简报</h3><div class="brief">${wrapParagraphs(d.briefing)}</div>
<div class="footer">物业租赁综合管理系统 自动生成</div>
</body></html>`;
}

// 用 Playwright(Chromium) 将 HTML 渲染为 PDF（文字版，可搜索）
async function renderPDF(html: string, filePath: string): Promise<void> {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle' });
    await page.pdf({ path: filePath, format: 'A4', printBackground: true, preferCSSPageSize: true });
  } finally { await browser.close(); }
}

// 生成本月经营简报 PDF 存档
export async function generateMonthlyBriefing(): Promise<{ filePath: string; month: string; bytes: number }> {
  const data = await aggregateBriefing();
  const html = buildBriefingHTML(data);
  ensureDir();
  const month = dayjs().format('YYYY-MM');
  const filePath = path.join(REPORT_DIR, `经营简报-${month}.pdf`);
  await renderPDF(html, filePath);
  const bytes = fs.statSync(filePath).size;
  console.log(`[Briefing] 已生成月度简报 PDF: ${filePath} (${bytes} bytes)`);
  return { filePath, month, bytes };
}


export async function aggregateBriefing() {
  const months = lastMonths(6);
  const workOrderTrend = await Promise.all(months.map(async m => ({ month: m, count: await WorkOrder.count({ where: { createdAt: { [Op.between]: [`${m}-01`, `${m}-31`] } } }) })));
  const complaintTrend = await Promise.all(months.map(async m => ({ month: m, count: await Complaint.count({ where: { createdAt: { [Op.between]: [`${m}-01`, `${m}-31`] } } }) })));
  const collectedTrend = await Promise.all(months.map(async m => {
    const bills = await Bill.findAll({ where: { period: m }, attributes: ['status', 'totalAmount'], raw: true });
    const total = bills.reduce((s, b) => s + Number((b as any).totalAmount || 0), 0);
    const paid = bills.filter((b: any) => b.status === '已缴').reduce((s, b) => s + Number((b as any).totalAmount || 0), 0);
    return { month: m, total: Math.round(total * 100) / 100, paid: Math.round(paid * 100) / 100, rate: total > 0 ? Math.round(paid / total * 100) : 0 };
  }));

  const [ws, fs, cs, ps, rs, workByType, facByStatus, compByType, revByType, meterBilled, parkingSum] = await Promise.all([
    WorkOrder.count(), Facility.count(), Complaint.count({ where: { status: '待受理' } }),
    ParkingRecord.count(), Resident.count({ where: { status: '在住' } }),
    WorkOrder.findAll({ attributes: ['type', [fn('COUNT', col('id')), 'count']], group: ['type'], raw: true }),
    Facility.findAll({ attributes: ['status', [fn('COUNT', col('id')), 'count']], group: ['status'], raw: true }),
    Complaint.findAll({ attributes: ['type', [fn('COUNT', col('id')), 'count']], group: ['type'], raw: true }),
    CommonRevenue.findAll({ attributes: ['type', [fn('SUM', col('amount')), 'sum']], group: ['type'], raw: true }),
    MeterReading.findAll({ where: { billed: '未生成' }, attributes: [[fn('SUM', col('amount')), 'sum']], raw: true }),
    ParkingRecord.sum('amount'),
  ]);

  const facStats = await Facility.findAll({ attributes: ['status', [fn('COUNT', col('id')), 'count']], group: ['status'], raw: true });
  const statusMap: Record<string, number> = {}; facStats.forEach((s: any) => { statusMap[s.status] = Number(s.count); });
  const facFault = statusMap['故障'] || 0;
  const facDue = await Facility.count({ where: { nextMaintainDate: { [Op.between]: [dayjs().startOf('day').toDate(), dayjs().add(7, 'day').toDate()] } } });

  const workAvg = workOrderTrend.length ? workOrderTrend.reduce((s, t) => s + t.count, 0) / workOrderTrend.length : 0;
  const curRate = collectedTrend.length ? collectedTrend[collectedTrend.length - 1].rate : 0;
  const meterUnbilled = Number((meterBilled[0] as any)?.sum || 0);
  const parkTotal = await ParkingRecord.count();
  const parkIdle = parkTotal > 0 ? Math.max(0, parkTotal - (await ParkingRecord.count({ where: { status: '进行中' } }))) : 0;

  const data = {
    title: '物业经营管理简报',
    reportPeriod: dayjs().format('YYYY-MM'),
    generatedAt: dayjs().format('YYYY-MM-DD HH:mm'),
    kpis: [
      { label: '工单总数', value: String(ws) },
      { label: '设备总数', value: String(fs) },
      { label: '待处理投诉', value: String(cs) },
      { label: '停车记录', value: String(parkTotal) },
      { label: '在住住户', value: String(rs) },
      { label: '故障设备', value: String(facFault) },
      { label: '本月收缴率', value: curRate + '%' },
      { label: '未生成账单抄表', value: money(meterUnbilled) + '元' },
    ],
    trend: workOrderTrend.map((w, i) => ({ month: w.month, work: w.count, comp: complaintTrend[i]?.count ?? 0, total: collectedTrend[i]?.total ?? 0, paid: collectedTrend[i]?.paid ?? 0, rate: collectedTrend[i]?.rate ?? 0 })),
    structure: [
      { name: '工单类型', data: workByType.map((r: any) => ({ name: r.type, value: Number(r.count) })) },
      { name: '设备状态', data: facByStatus.map((r: any) => ({ name: r.status, value: Number(r.count) })) },
      { name: '投诉类型', data: compByType.map((r: any) => ({ name: r.type, value: Number(r.count) })) },
      { name: '公共收益构成', data: revByType.map((r: any) => ({ name: r.type, value: String(r.sum || 0) })), money: true },
    ],
    prediction: { forecastNextWork: Math.round(workAvg * 1.1), workAvg: Math.round(workAvg * 10) / 10, curCollectionRate: curRate, meterUnbilled, parkingRevenue: Number(parkingSum || 0) },
    briefing: `近6个月月均工单 ${Math.round(workAvg * 10) / 10} 单；本月账单收缴率 ${curRate}%；当前未生成账单抄表 ${money(meterUnbilled)} 元；停车累计收入 ${money(Number(parkingSum || 0))} 元；设备即将到期 ${facDue} 台。建议重点关注设备到期与待处理投诉。`,
  };
  return data;
}
