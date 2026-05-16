<template>
  <div class="report-center">
    <h2 class="page-title">报表中心</h2>
    <el-row :gutter="16">
      <el-col :span="8" v-for="r in reports" :key="r.title">
        <el-card shadow="hover" class="report-card" @click="openReport(r)">
          <div class="report-icon"><el-icon :size="32" color="#0A3D62"><Document /></el-icon></div>
          <div class="report-title">{{ r.title }}</div>
          <div class="report-desc">{{ r.desc }}</div>
        </el-card>
      </el-col>
    </el-row>

    <el-dialog :title="currentReport?.title" v-model="reportVisible" width="960px" top="3vh">
      <!-- 报表工具栏 -->
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;flex-wrap:wrap">
        <span style="font-size:13px;color:#606266">周期:</span>
        <el-radio-group v-model="reportPeriodType" size="small" @change="onPeriodTypeChange">
          <el-radio-button value="month">月度</el-radio-button>
          <el-radio-button value="quarter">季度</el-radio-button>
          <el-radio-button value="half-year">半年</el-radio-button>
          <el-radio-button value="year">年度</el-radio-button>
          <el-radio-button value="custom">自定义</el-radio-button>
        </el-radio-group>
        <!-- 月度：月份选择器 -->
        <el-date-picker
          v-if="reportPeriodType === 'month'"
          v-model="reportPeriod" type="month" placeholder="选择月份" format="YYYY-MM" value-format="YYYY-MM" size="small" style="width:160px" @change="refreshReport"
        />
        <!-- 年度：年份选择器 -->
        <el-date-picker
          v-if="reportPeriodType === 'year'"
          v-model="reportPeriod" type="year" placeholder="选择年份" format="YYYY" value-format="YYYY" size="small" style="width:140px" @change="refreshReport"
        />
        <!-- 季度：下拉 -->
        <el-select v-if="reportPeriodType === 'quarter'" v-model="reportPeriod" size="small" style="width:160px" @change="refreshReport">
          <el-option v-for="q in quarters" :key="q.value" :label="q.label" :value="q.value" />
        </el-select>
        <!-- 半年：下拉 -->
        <el-select v-if="reportPeriodType === 'half-year'" v-model="reportPeriod" size="small" style="width:160px" @change="refreshReport">
          <el-option v-for="h in halfYears" :key="h.value" :label="h.label" :value="h.value" />
        </el-select>
        <!-- 自定义：起止月份范围 -->
        <el-date-picker
          v-if="reportPeriodType === 'custom'"
          v-model="customDateRange"
          type="monthrange"
          range-separator="→"
          start-placeholder="起始月"
          end-placeholder="截止月"
          format="YYYY-MM"
          value-format="YYYY-MM"
          size="small"
          style="width:240px"
          @change="refreshReport"
        />
        <el-button size="small" @click="refreshReport" :loading="reportLoading">刷新</el-button>
      </div>

      <!-- 资产负债表 -->
      <template v-if="reportType === 'balance'">
        <h4>资产</h4>
        <el-table :data="reportState.assets || []" stripe size="small" style="margin-bottom:16px" show-summary :summary-method="sumAssets">
          <el-table-column prop="code" label="科目编码" width="120" />
          <el-table-column prop="name" label="科目名称" />
          <el-table-column prop="balance" label="余额" width="150"><template #default="{ row }">¥{{ (row.balance || 0).toFixed(2) }}</template></el-table-column>
        </el-table>
        <h4>负债</h4>
        <el-table :data="reportState.liabilities || []" stripe size="small" style="margin-bottom:16px" show-summary :summary-method="sumLiabilities">
          <el-table-column prop="code" label="科目编码" width="120" />
          <el-table-column prop="name" label="科目名称" />
          <el-table-column prop="balance" label="余额" width="150"><template #default="{ row }">¥{{ (row.balance || 0).toFixed(2) }}</template></el-table-column>
        </el-table>
        <h4>所有者权益</h4>
        <el-table :data="reportState.equity || []" stripe size="small" show-summary :summary-method="sumEquity">
          <el-table-column prop="code" label="科目编码" width="120" />
          <el-table-column prop="name" label="科目名称" />
          <el-table-column prop="balance" label="余额" width="150"><template #default="{ row }">¥{{ (row.balance || 0).toFixed(2) }}</template></el-table-column>
        </el-table>
      </template>

      <!-- 利润表 -->
      <template v-else-if="reportType === 'income'">
        <h4>收入</h4>
        <el-table :data="reportState.revenue || []" stripe size="small" style="margin-bottom:16px" show-summary :summary-method="sumRevenue">
          <el-table-column prop="code" label="科目编码" width="120" />
          <el-table-column prop="name" label="科目名称" />
          <el-table-column prop="amount" label="金额" width="150"><template #default="{ row }">¥{{ (row.amount || 0).toFixed(2) }}</template></el-table-column>
        </el-table>
        <h4>成本费用</h4>
        <el-table :data="reportState.costs || []" stripe size="small" style="margin-bottom:16px" show-summary :summary-method="sumCosts">
          <el-table-column prop="code" label="科目编码" width="120" />
          <el-table-column prop="name" label="科目名称" />
          <el-table-column prop="amount" label="金额" width="150"><template #default="{ row }">¥{{ (row.amount || 0).toFixed(2) }}</template></el-table-column>
        </el-table>
        <el-descriptions :column="3" border size="small">
          <el-descriptions-item label="总收入">¥{{ (reportState.totalRevenue || 0).toFixed(2) }}</el-descriptions-item>
          <el-descriptions-item label="总成本">¥{{ (reportState.totalCost || 0).toFixed(2) }}</el-descriptions-item>
          <el-descriptions-item label="净利润" :label-style="{ fontWeight: 700, color: '#00B894' }">¥{{ (reportState.netProfit || 0).toFixed(2) }}</el-descriptions-item>
        </el-descriptions>
      </template>

      <!-- 现金流量表 -->
      <template v-else-if="reportType === 'cashflow'">
        <h4>经营活动</h4>
        <el-table :data="reportState.operating || []" stripe size="small" style="margin-bottom:16px">
          <el-table-column prop="code" label="编码" width="100" />
          <el-table-column prop="name" label="项目" />
          <el-table-column prop="amount" label="金额" width="150"><template #default="{ row }">¥{{ (row.amount || 0).toFixed(2) }}</template></el-table-column>
        </el-table>
        <h4>投资活动</h4>
        <el-table :data="reportState.investing || []" stripe size="small" style="margin-bottom:16px">
          <el-table-column prop="code" label="编码" width="100" />
          <el-table-column prop="name" label="项目" />
          <el-table-column prop="amount" label="金额" width="150"><template #default="{ row }">¥{{ (row.amount || 0).toFixed(2) }}</template></el-table-column>
        </el-table>
        <h4>筹资活动</h4>
        <el-table :data="reportState.financing || []" stripe size="small" style="margin-bottom:16px">
          <el-table-column prop="code" label="编码" width="100" />
          <el-table-column prop="name" label="项目" />
          <el-table-column prop="amount" label="金额" width="150"><template #default="{ row }">¥{{ (row.amount || 0).toFixed(2) }}</template></el-table-column>
        </el-table>
        <el-descriptions :column="1" border size="small">
          <el-descriptions-item label="现金净增加额" :label-style="{ fontWeight: 700 }">¥{{ (reportState.netCashFlow || 0).toFixed(2) }}</el-descriptions-item>
        </el-descriptions>
      </template>

      <!-- 自定义报表：通用扁平表格 -->
      <template v-else>
        <el-table :data="reportState.rows || []" stripe size="small" empty-text="暂无数据">
          <el-table-column v-for="col in (reportState.columns || [])" :key="col" :prop="col" :label="col" show-overflow-tooltip>
            <template #default="{ row }">
              <template v-if="typeof row[col] === 'number'">
                <span v-if="col.includes('率') || col.includes('比')">{{ row[col] }}%</span>
                <span v-else-if="col === '逾期天数'">{{ row[col] }}天</span>
                <span v-else-if="col === '户数'">{{ row[col] }}</span>
                <span v-else>¥{{ row[col].toFixed(2) }}</span>
              </template>
              <span v-else>{{ row[col] }}</span>
            </template>
          </el-table-column>
        </el-table>
      </template>

      <template #footer>
        <el-button @click="reportVisible = false">关闭</el-button>
        <el-button type="success" @click="handleExportPDF" :loading="pdfLoading">导出PDF</el-button>
        <el-button type="primary" @click="handleExport">导出Excel</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue';
import { Document } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import request from '@/api/request';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// ---- 周期选项 ----
const currentYear = new Date().getFullYear();
const yearRange = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);
const quarters = computed(() =>
  yearRange.flatMap(y => [
    { label: `${y}年 Q1 (1-3月)`, value: `${y}-1` },
    { label: `${y}年 Q2 (4-6月)`, value: `${y}-2` },
    { label: `${y}年 Q3 (7-9月)`, value: `${y}-3` },
    { label: `${y}年 Q4 (10-12月)`, value: `${y}-4` },
  ])
);
const halfYears = computed(() =>
  yearRange.flatMap(y => [
    { label: `${y}年 上半年 (1-6月)`, value: `${y}-1` },
    { label: `${y}年 下半年 (7-12月)`, value: `${y}-2` },
  ])
);

const reports = [
  { title: '资产负债表', desc: '资产/负债/权益汇总', endpoint: '/reports/balance-sheet', type: 'balance' },
  { title: '利润表', desc: '收入/成本/利润明细', endpoint: '/reports/income-statement', type: 'income' },
  { title: '现金流量表', desc: '经营/投资/筹资现金流', endpoint: '/reports/cash-flow', type: 'cashflow' },
  { title: '收租汇总表', desc: '按业态汇总收租', endpoint: '/reports/custom', type: 'custom', params: { type: 'rent-summary' } },
  { title: '欠费明细表', desc: '欠费租客明细', endpoint: '/reports/custom', type: 'custom', params: { type: 'arrears-detail' } },
  { title: '成本分析表', desc: '费用结构分析', endpoint: '/reports/custom', type: 'custom', params: { type: 'cost-analysis' } },
];

const currentReport = ref<any>(null);
const reportVisible = ref(false);
const reportType = ref('');
const reportState = reactive<any>({});
const reportPeriod = ref(new Date().toISOString().slice(0, 7));
const reportPeriodType = ref('month');
const reportLoading = ref(false);
const pdfLoading = ref(false);
const customDateRange = ref<[string, string] | null>(null);

function getDefaultPeriod(type: string): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  switch (type) {
    case 'year': return String(y);
    case 'quarter': return `${y}-${Math.ceil(m / 3)}`;
    case 'half-year': return `${y}-${m <= 6 ? 1 : 2}`;
    default: return `${y}-${String(m).padStart(2, '0')}`;
  }
}

function onPeriodTypeChange(type: string) {
  if (type === 'custom') {
    customDateRange.value = null;
    reportState.length = 0;
    return;
  }
  customDateRange.value = null;
  reportPeriod.value = getDefaultPeriod(type);
  refreshReport();
}

function sumAssets(param: any) { const { data } = param; return ['合计', '', '¥' + data.reduce((s: number, r: any) => s + (r.balance || 0), 0).toFixed(2)]; }
function sumLiabilities(param: any) { const { data } = param; return ['合计', '', '¥' + data.reduce((s: number, r: any) => s + (r.balance || 0), 0).toFixed(2)]; }
function sumEquity(param: any) { const { data } = param; return ['合计', '', '¥' + data.reduce((s: number, r: any) => s + (r.balance || 0), 0).toFixed(2)]; }
function sumRevenue(param: any) { const { data } = param; return ['合计', '', '¥' + data.reduce((s: number, r: any) => s + (r.amount || 0), 0).toFixed(2)]; }
function sumCosts(param: any) { const { data } = param; return ['合计', '', '¥' + data.reduce((s: number, r: any) => s + (r.amount || 0), 0).toFixed(2)]; }

function buildParams(r: any): any {
  const params: any = { ...(r.params || {}) };
  if (reportPeriodType.value === 'custom' && customDateRange.value) {
    params.startDate = customDateRange.value[0];
    params.endDate = customDateRange.value[1];
  } else {
    params.period = reportPeriod.value;
    params.periodType = reportPeriodType.value;
  }
  return params;
}

async function loadReportData(r: any) {
  const params = buildParams(r);
  const res = await request.get(r.endpoint, { params });
  Object.assign(reportState, res.data);
}

async function refreshReport() {
  if (!currentReport.value) return;
  if (reportPeriodType.value === 'custom' && !customDateRange.value) return;
  reportLoading.value = true;
  Object.keys(reportState).forEach(k => delete reportState[k]);
  try {
    await loadReportData(currentReport.value);
  } catch {
    ElMessage.error('加载报表失败');
  } finally {
    reportLoading.value = false;
  }
}

async function openReport(r: any) {
  currentReport.value = r;
  reportType.value = r.type;
  reportPeriod.value = new Date().toISOString().slice(0, 7);
  reportPeriodType.value = 'month';
  customDateRange.value = null;
  Object.keys(reportState).forEach(k => delete reportState[k]);
  reportLoading.value = true;
  try {
    await loadReportData(r);
  } catch {
    ElMessage.error('加载报表失败');
  } finally {
    reportLoading.value = false;
  }
  reportVisible.value = true;
}

// ---- Excel 导出 ----
function handleExport() {
  const wb = XLSX.utils.book_new();
  const title = currentReport.value?.title || '报表';
  const now = new Date().toISOString().slice(0, 10);

  if (reportType.value === 'balance') {
    if (reportState.assets?.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(reportState.assets), '资产');
    if (reportState.liabilities?.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(reportState.liabilities), '负债');
    if (reportState.equity?.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(reportState.equity), '权益');
  } else if (reportType.value === 'income') {
    if (reportState.revenue?.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(reportState.revenue), '收入');
    if (reportState.costs?.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(reportState.costs), '成本费用');
  } else if (reportType.value === 'cashflow') {
    if (reportState.operating?.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(reportState.operating), '经营活动');
    if (reportState.investing?.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(reportState.investing), '投资活动');
    if (reportState.financing?.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(reportState.financing), '筹资活动');
  } else {
    if (reportState.rows?.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(reportState.rows), 'Sheet1');
  }

  if (!wb.SheetNames.length) { ElMessage.warning('没有可导出的数据'); return; }
  XLSX.writeFile(wb, `${title}_${now}.xlsx`);
  ElMessage.success('Excel导出成功');
}

// ---- PDF 导出（html2canvas 截图方案，利用浏览器原生中文渲染） ----
async function handleExportPDF() {
  const title = currentReport.value?.title || '报表';
  const now = new Date().toISOString().slice(0, 10);
  pdfLoading.value = true;

  try {
    const rangeLabel = reportPeriodType.value === 'custom' && customDateRange.value
      ? `周期：${customDateRange.value[0]} ~ ${customDateRange.value[1]}`
      : `周期：${reportPeriod.value} (${({ month: '月度', quarter: '季度', 'half-year': '半年', year: '年度' } as any)[reportPeriodType.value]})`;

    const html = buildReportHTML(title, rangeLabel, now);

    // 创建离屏渲染容器
    const container = document.createElement('div');
    container.innerHTML = html;
    container.style.cssText = 'position:fixed;left:-9999px;top:0;width:760px;font-family:"Microsoft YaHei","SimHei","PingFang SC",sans-serif;font-size:12px;color:#333;background:#fff;padding:16px;z-index:-1;';
    document.body.appendChild(container);

    const canvas = await html2canvas(container, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
    document.body.removeChild(container);

    // 生成 PDF
    const imgData = canvas.toDataURL('image/png');
    const pageW = 297; // A4 横向 mm
    const pageH = 210;
    const margin = 8;
    const usableW = pageW - margin * 2;
    const usableH = pageH - margin * 2;
    const imgW = usableW;
    const imgH = (canvas.height * usableW) / canvas.width;

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    let heightLeft = imgH;
    let position = margin;
    let pageNum = 0;

    // 首页
    doc.addImage(imgData, 'PNG', margin, position, imgW, imgH);
    heightLeft -= usableH;
    pageNum++;

    // 后续页面
    while (heightLeft > 0) {
      doc.addPage();
      position = -(usableH * pageNum) + margin;
      doc.addImage(imgData, 'PNG', margin, position, imgW, imgH);
      heightLeft -= usableH;
      pageNum++;
    }

    doc.save(`${title}_${now}.pdf`);
    ElMessage.success('PDF导出成功');
  } catch (e) {
    ElMessage.error('PDF导出失败');
    console.error(e);
  } finally {
    pdfLoading.value = false;
  }
}

// 构建报表 HTML（浏览器原生渲染中文）
function buildReportHTML(title: string, rangeLabel: string, now: string): string {
  let html = `<div style="text-align:center;margin-bottom:10px">
    <h2 style="margin:0 0 4px;font-size:18px;color:#0A3D62">${title}</h2>
    <div style="font-size:11px;color:#666">${rangeLabel}　导出日期：${now}</div>
  </div>`;

  if (reportType.value === 'balance') {
    html += buildTableHTML('资产', reportState.assets || [], ['code', 'name', 'balance'], ['科目编码', '科目名称', '余额'], true);
    html += buildTableHTML('负债', reportState.liabilities || [], ['code', 'name', 'balance'], ['科目编码', '科目名称', '余额'], true);
    html += buildTableHTML('所有者权益', reportState.equity || [], ['code', 'name', 'balance'], ['科目编码', '科目名称', '余额'], true);
  } else if (reportType.value === 'income') {
    html += buildTableHTML('收入', reportState.revenue || [], ['code', 'name', 'amount'], ['科目编码', '科目名称', '金额'], true);
    html += buildTableHTML('成本费用', reportState.costs || [], ['code', 'name', 'amount'], ['科目编码', '科目名称', '金额'], true);
    html += `<div style="font-size:13px;margin-top:6px;padding:8px;background:#f5f7fa;border-radius:4px">
      <strong>总收入：</strong>¥${(reportState.totalRevenue || 0).toFixed(2)}
      <strong>总成本：</strong>¥${(reportState.totalCost || 0).toFixed(2)}
      <strong style="color:#00B894">净利润：¥${(reportState.netProfit || 0).toFixed(2)}</strong>
    </div>`;
  } else if (reportType.value === 'cashflow') {
    html += buildTableHTML('经营活动', reportState.operating || [], ['code', 'name', 'amount'], ['编码', '项目', '金额'], false);
    html += buildTableHTML('投资活动', reportState.investing || [], ['code', 'name', 'amount'], ['编码', '项目', '金额'], false);
    html += buildTableHTML('筹资活动', reportState.financing || [], ['code', 'name', 'amount'], ['编码', '项目', '金额'], false);
    html += `<div style="font-size:13px;margin-top:6px;padding:8px;background:#f5f7fa;border-radius:4px">
      <strong>现金净增加额：</strong>¥${(reportState.netCashFlow || 0).toFixed(2)}
    </div>`;
  } else {
    const rows = reportState.rows || [];
    const cols = reportState.columns || [];
    if (rows.length && cols.length) {
      html += buildCustomTableHTML(cols, rows);
    }
  }

  return html;
}

function formatCellValue(v: any, col: string): string {
  if (typeof v === 'number') {
    if (col.includes('率') || col.includes('比')) return v + '%';
    if (col === '逾期天数') return v + '天';
    if (col === '户数') return String(v);
    return v.toFixed(2);
  }
  return v != null ? String(v) : '';
}

function buildTableHTML(sectionTitle: string, data: any[], keys: string[], headers: string[], isCurrency: boolean): string {
  if (!data.length) return `<h4 style="margin:10px 0 4px;color:#0A3D62">${sectionTitle}</h4><p style="color:#999;font-size:11px">暂无数据</p>`;
  const sum = data.reduce((s, r) => s + (Number(r[keys[keys.length - 1]]) || 0), 0);
  return `<h4 style="margin:12px 0 4px;color:#0A3D62">${sectionTitle}</h4>
    <table style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:8px">
      <tr style="background:#0A3D62;color:#fff">
        ${headers.map(h => `<th style="padding:6px 10px;text-align:${h === headers[headers.length - 1] && isCurrency ? 'right' : 'left'};border:1px solid #ddd">${h}</th>`).join('')}
      </tr>
      ${data.map(r => `<tr>
        ${keys.map((k, i) => {
          const v = r[k] || 0;
          const val = (i === keys.length - 1 && isCurrency) ? (Number(v)).toFixed(2) : String(v);
          const align = (i === keys.length - 1 && isCurrency) ? 'right' : 'left';
          return `<td style="padding:5px 10px;text-align:${align};border:1px solid #eee">${val}</td>`;
        }).join('')}
      </tr>`).join('')}
      <tr style="background:#f0f4f8;font-weight:700">
        <td style="padding:6px 10px;border:1px solid #ddd" colspan="${keys.length - 1}">合计</td>
        <td style="padding:6px 10px;text-align:right;border:1px solid #ddd">¥${sum.toFixed(2)}</td>
      </tr>
    </table>`;
}

function buildCustomTableHTML(cols: string[], rows: any[]): string {
  return `<table style="width:100%;border-collapse:collapse;font-size:11px">
    <tr style="background:#0A3D62;color:#fff">
      ${cols.map(c => `<th style="padding:6px 10px;text-align:left;border:1px solid #ddd">${c}</th>`).join('')}
    </tr>
    ${rows.map(r => `<tr>
      ${cols.map(c => {
        const v = r[c];
        const val = formatCellValue(v, c);
        return `<td style="padding:5px 10px;text-align:left;border:1px solid #eee">${val}</td>`;
      }).join('')}
    </tr>`).join('')}
  </table>`;
}
</script>

<style lang="scss" scoped>
.page-title { font-size: 18px; font-weight: 700; color: #0A3D62; margin-bottom: 16px; }
.report-card { text-align: center; cursor: pointer; padding: 16px; }
.report-card:hover { border-color: #0A3D62; }
.report-icon { margin-bottom: 12px; }
.report-title { font-size: 15px; font-weight: 600; color: #0A3D62; margin-bottom: 4px; }
.report-desc { font-size: 11px; color: #7F8C8D; }
h4 { margin: 8px 0; color: #0A3D62; font-size: 14px; }
</style>
