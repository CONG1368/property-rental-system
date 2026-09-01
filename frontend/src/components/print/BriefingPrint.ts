// 经营简报 — 文字版打印模板（Electron printToPDF 输出真正文字 PDF）
// 页面尺寸由 @page CSS 决定，printToPDF preferCSSPageSize 自动适配

export interface BriefingKpi { label: string; value: string; }
export interface BriefingTrend { month: string; work: number; comp: number; total: number; paid: number; rate: number; }
export interface BriefingStruct { name: string; data: { name: string; value: string }[]; money?: boolean; }
export interface BriefingData {
  title: string;
  reportPeriod: string;
  generatedAt: string;
  kpis: BriefingKpi[];
  trend: BriefingTrend[];
  structure: BriefingStruct[];
  prediction: { forecastNextWork: number; workAvg: number; curCollectionRate: number; meterUnbilled: number; parkingRevenue: number };
  briefing: string;
}

function normLines(text: string): string[] {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(p => p.trim());
}
function wrapParagraphs(text: string): string {
  const lines = normLines(text);
  if (lines.length === 0) return '';
  return lines.map(p => `<p style="text-indent:2em;margin:4px 0;line-height:1.8">${p}</p>`).join('');
}
function money(v: number): string { return Number(v || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 }); }

export function buildBriefingHTML(d: BriefingData): string {
  const theme = '#0A3D62';
  const kpiCards = d.kpis.map(k => `<div class="kpi"><div class="kpi-v">${k.value}</div><div class="kpi-l">${k.label}</div></div>`).join('');

  let rows = '';
  if (d.trend && d.trend.length) {
    rows = d.trend.map(t => `<tr><td>${t.month}</td><td>${t.work}</td><td>${t.comp}</td><td class="num">${money(t.total)}</td><td class="num">${money(t.paid)}</td><td>${t.rate}%</td></tr>`).join('');
  } else {
    rows = '<tr><td colspan="6" style="text-align:center;color:#909399">暂无数据</td></tr>';
  }

  const structBlocks = d.structure.map(s => {
    const items = s.data && s.data.length
      ? s.data.map(x => `<div class="si">${x.name}：<b>${x.value}</b>${s.money ? ' 元' : ''}</div>`).join('')
      : '<div class="si" style="color:#909399">暂无</div>';
    return `<div class="struct"><div class="st">${s.name}</div>${items}</div>`;
  }).join('');

  const pred = d.prediction || {};
  const lines = ['第 1 页'].join('');
  const first = normLines(d.briefing);

  return `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>${d.title}</title>
<style>
@page { size: A4; margin: 18mm 16mm; }
* { box-sizing: border-box; }
body { font-family: "Microsoft YaHei","PingFang SC",sans-serif; color:#303133; font-size:13px; line-height:1.6; }
.hd { border-bottom:2px solid ${theme}; padding-bottom:10px; margin-bottom:14px; }
.hd h1 { margin:0; color:${theme}; font-size:22px; }
.hd .meta { color:#909399; font-size:12px; margin-top:6px; }
.kpis { display:flex; flex-wrap:wrap; gap:10px; margin-bottom:16px; }
.kpi { flex:1 1 22%; min-width:130px; border:1px solid #ebeef5; border-radius:6px; padding:12px; text-align:center; }
.kpi-v { font-size:22px; font-weight:700; color:${theme}; }
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
</style></head>
<body>
  <div class="hd"><h1>${d.title}</h1><div class="meta">报告期：${d.reportPeriod} ｜ 生成时间：${d.generatedAt}</div></div>
  <div class="kpis">${kpiCards}</div>
  <h3>一、近 6 个月运营趋势</h3>
  <table><thead><tr><th>月份</th><th>工单数</th><th>投诉数</th><th>应收(元)</th><th>实收(元)</th><th>收缴率</th></tr></thead><tbody>${rows}</tbody></table>
  <h3>二、结构占比</h3>
  <div class="structs">${structBlocks}</div>
  <h3>三、预测与关注</h3>
  <div class="pred">
    <p>下月工单预测：<b>${pred.forecastNextWork ?? 0}</b> 单（近 6 月均值 ${pred.workAvg ?? 0}）。</p>
    <p>本月账单收缴率：<b>${pred.curCollectionRate ?? 0}%</b>。未生成账单抄表：<b>${money(pred.meterUnbilled ?? 0)}</b> 元。停车累计收入：<b>${money(pred.parkingRevenue ?? 0)}</b> 元。</p>
  </div>
  <h3>四、经营简报</h3>
  <div class="brief">${wrapParagraphs(d.briefing)}</div>
  <div class="footer">物业租赁综合管理系统 自动生成</div>
</body></html>`;
}
