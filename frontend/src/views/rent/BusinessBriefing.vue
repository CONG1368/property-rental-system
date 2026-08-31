<template>
  <div class="briefing-page">
    <div class="head-row">
      <h2 class="page-title">经营简报</h2>
      <el-button type="primary" @click="exportPDF">导出 / 打印 PDF</el-button>
    </div>

    <div class="report-area" id="briefing-report">
      <div class="report-header">
        <h1>物业经营管理简报</h1>
        <div class="rpt-date">报告期：{{ currentMonth }}　生成时间：{{ generatedAt }}</div>
      </div>

      <div class="rpt-kpi">
        <div class="kpi-cell" v-for="k in kpiList" :key="k.label">
          <div class="kpi-val">{{ k.value }}</div>
          <div class="kpi-lab">{{ k.label }}</div>
        </div>
      </div>

      <div class="rpt-trend">
        <h3>一、近 6 个月运营趋势</h3>
        <table class="rpt-table">
          <thead><tr><th>月份</th><th>工单数</th><th>投诉数</th><th>应收(元)</th><th>实收(元)</th><th>收缴率</th></tr></thead>
          <tbody><tr v-for="(t, i) in trendRows" :key="t.month"><td>{{ t.month }}</td><td>{{ t.work }}</td><td>{{ t.comp }}</td><td>{{ fmt(t.total) }}</td><td>{{ fmt(t.paid) }}</td><td>{{ t.rate }}%</td></tr></tbody>
        </table>
      </div>

      <div class="rpt-structure">
        <h3>二、结构占比</h3>
        <div class="struct-grid">
          <div class="struct-item" v-for="s in structList" :key="s.name">
            <div class="struct-tag">{{ s.name }}</div>
            <div class="struct-line" v-for="d in s.data" :key="d.name">{{ d.name }}：<b>{{ d.value }}</b>{{ s.money ? ' 元' : '' }}</div>
          </div>
        </div>
      </div>

      <div class="rpt-pred">
        <h3>三、预测与关注</h3>
        <p>下月工单预测：<b>{{ pred.forecastNextWork }}</b> 单（近 6 月均值 {{ pred.workAvg }}）。</p>
        <p>本月账单收缴率：<b>{{ pred.curCollectionRate }}%</b>。未生成账单抄表：<b>{{ fmt(pred.meterUnbilled) }}</b> 元。</p>
        <p>重点关注：设备即将到期 {{ kpi.facDue }} 台，待处理投诉 {{ kpi.complaintPending }} 件，低库存物料 {{ kpi.inventoryLow }} 项。</p>
      </div>

      <div class="rpt-summary">
        <h3>四、经营简报</h3>
        <p>{{ briefing }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import request from '@/api/request';
import { ElMessage } from 'element-plus';
import { buildBriefingHTML } from '@/components/print/BriefingPrint';
import { printDocument } from '@/utils/print-service';

const kpi = ref<any>({}); const pred = ref<any>({ forecastNextWork:0, workAvg:0, curCollectionRate:0, meterUnbilled:0, parkingRevenue:0 });
const trends = ref<any>({ workOrderTrend: [], complaintTrend: [], collectedTrend: [] });
const structure = ref<any>({ workByType:[], facByStatus:[], compByType:[], revByType:[] });
const briefing = ref(''); const generatedAt = ref('');
function fmt(v: any): string { return Number(v || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 }); }
const currentMonth = new Date().toISOString().slice(0,7);

const kpiList = computed(() => [
  { label: '工单总数', value: kpi.value.workTotal ?? 0 },
  { label: '设备总数', value: kpi.value.facTotal ?? 0 },
  { label: '待处理投诉', value: kpi.value.complaintPending ?? 0 },
  { label: '车位空闲率', value: (kpi.value.parkTotal ? Math.round(kpi.value.parkIdle/kpi.value.parkTotal*100) : 0) + '%' },
  { label: '在住住户', value: kpi.value.residentLive ?? 0 },
  { label: '公共收益(元)', value: fmt(kpi.value.revenueAmount) },
  { label: '本月收缴率', value: pred.value.curCollectionRate + '%' },
]);
const trendRows = computed(() => {
  const wt = trends.value.workOrderTrend || [], ct = trends.value.complaintTrend || [], ctt = trends.value.collectedTrend || [];
  return wt.map((w:any, i:number) => ({ month: w.month, work: w.count, comp: ct[i]?.count ?? 0, total: ctt[i]?.total ?? 0, paid: ctt[i]?.paid ?? 0, rate: ctt[i]?.rate ?? 0 }));
});
const structList = computed(() => [
  { name: '工单类型', data: structure.value.workByType, money: false },
  { name: '设备状态', data: structure.value.facByStatus, money: false },
  { name: '投诉类型', data: structure.value.compByType, money: false },
  { name: '公共收益构成', data: structure.value.revByType, money: true },
]);

async function loadData() {
  try {
    const [an, ws, fs, cs, ps, rs] = await Promise.all([
      request.get('/property-analytics/dashboard', { silent: true }).catch(() => null),
      request.get('/work-orders/stats', { silent: true }).catch(() => null),
      request.get('/facilities/stats', { silent: true }).catch(() => null),
      request.get('/complaints/stats', { silent: true }).catch(() => null),
      request.get('/parking/spaces/stats', { silent: true }).catch(() => null),
      request.get('/residents/stats', { silent: true }).catch(() => null),
    ]);
    if (an?.data) { trends.value = an.data.trends; structure.value = an.data.structure; pred.value = an.data.prediction; briefing.value = `近6个月月均工单 ${an.data.prediction.workAvg} 单；本月收缴率 ${an.data.prediction.curCollectionRate}%；当前未生成账单抄表 ${fmt(an.data.prediction.meterUnbilled)} 元；车位空闲率 ${kpi.value.parkTotal ? Math.round(kpi.value.parkIdle/kpi.value.parkTotal*100) : 0}%。建议重点关注设备到期与待处理投诉。`; }
    if (ws?.data) kpi.value.workTotal = ws.data.total;
    if (fs?.data) { kpi.value.facTotal = fs.data.total; kpi.value.facDue = fs.data.expiringSoon; }
    if (cs?.data) kpi.value.complaintPending = cs.data.pending;
    if (ps?.data) { kpi.value.parkTotal = ps.data.total; kpi.value.parkIdle = ps.data.idle; }
    if (rs?.data) kpi.value.residentLive = rs.data.residents;
    generatedAt.value = new Date().toLocaleString('zh-CN');
  } catch { /* 静默 */ }
}
async function exportPDF() {
  const data = {
    title: '物业经营管理简报',
    reportPeriod: currentMonth,
    generatedAt: generatedAt.value,
    kpis: kpiList.value.map((k: any) => ({ label: k.label, value: String(k.value) })),
    trend: trendRows.value,
    structure: structList.value.map((s: any) => ({ name: s.name, data: s.data, money: s.money })),
    prediction: { ...pred.value },
    briefing: briefing.value,
  };
  const html = buildBriefingHTML(data as any);
  try { await printDocument({ title: '物业经营管理简报', paperSize: 'A4', htmlContent: html, mode: 'pdf' }); }
  catch (err: any) { ElMessage.error(err?.message || '导出失败'); }
}
onMounted(() => loadData());
</script>

<style lang="scss" scoped>
.briefing-page { padding: 0; }
.head-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.page-title { font-size: 20px; font-weight: 700; color: #0A3D62; margin: 0; }
.report-area { background: #fff; border: 1px solid #ebeef5; border-radius: 8px; padding: 28px; }
.report-header { border-bottom: 2px solid #0A3D62; padding-bottom: 12px; margin-bottom: 16px; }
.report-header h1 { margin: 0; color: #0A3D62; }
.rpt-date { color: #909399; font-size: 13px; margin-top: 6px; }
.rpt-kpi { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
.kpi-cell { border: 1px solid #ebeef5; border-radius: 6px; padding: 14px; text-align: center; }
.kpi-val { font-size: 24px; font-weight: 700; color: #0A3D62; }
.kpi-lab { margin-top: 4px; color: #909399; font-size: 12px; }
.rpt-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.rpt-table th, .rpt-table td { border: 1px solid #ebeef5; padding: 8px; text-align: center; }
.rpt-table th { background: #f5f7fa; }
.struct-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
.struct-item { border: 1px solid #ebeef5; border-radius: 6px; padding: 12px; }
.struct-tag { font-weight: 600; margin-bottom: 8px; color: #0A3D62; }
.struct-line { font-size: 13px; line-height: 1.8; }
@media print {
  .head-row { display: none; }
  .briefing-page { padding: 0; }
  .report-area { border: none; padding: 0; }
}
</style>