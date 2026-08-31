<template>
  <div class="ops-page">
    <div class="head-row">
      <h2 class="page-title">物业管理运营看板</h2>
      <el-button type="warning" size="small" :loading="autoRunning" @click="runAuto">一键执行自动化</el-button>
    </div>

    <!-- 经营简报 -->
    <el-alert v-if="briefing" type="info" :closable="false" class="briefing">
      <template #title><b>本月经营简报</b></template>
      {{ briefing }}
    </el-alert>

    <!-- KPI -->
    <el-row :gutter="16" class="kpi-row">
      <el-col :span="6"><div class="kpi"><div class="kpi-num" style="color:#409EFF">{{ kpi.workTotal }}</div><div class="kpi-label">工单总数</div><div class="kpi-sub">待派单 {{ kpi.workPending }} · 已完工 {{ kpi.workDone }}</div></div></el-col>
      <el-col :span="6"><div class="kpi"><div class="kpi-num" style="color:#67C23A">{{ kpi.facTotal }}</div><div class="kpi-label">设备总数</div><div class="kpi-sub">故障 {{ kpi.facFault }} · 即将到期 {{ kpi.facDue }}</div></div></el-col>
      <el-col :span="6"><div class="kpi"><div class="kpi-num" style="color:#E6A23C">{{ kpi.complaintPending }}</div><div class="kpi-label">待处理投诉</div><div class="kpi-sub">总投诉 {{ kpi.complaintTotal }}</div></div></el-col>
      <el-col :span="6"><div class="kpi"><div class="kpi-num" style="color:#F56C6C">{{ parkRate }}%</div><div class="kpi-label">车位空闲率</div><div class="kpi-sub">空闲 {{ kpi.parkIdle }} / {{ kpi.parkTotal }}</div></div></el-col>
    </el-row>
    <el-row :gutter="16" class="kpi-row">
      <el-col :span="6"><div class="kpi"><div class="kpi-num" style="color:#409EFF">{{ kpi.residentLive }}</div><div class="kpi-label">在住住户</div><div class="kpi-sub">业主 {{ kpi.residentOwner }} 人</div></div></el-col>
      <el-col :span="6"><div class="kpi"><div class="kpi-num" style="color:#E6A23C">{{ kpi.inventoryLow }}</div><div class="kpi-label">低库存物料</div><div class="kpi-sub">物料 {{ kpi.inventoryTotal }} 项</div></div></el-col>
      <el-col :span="6"><div class="kpi"><div class="kpi-num" style="color:#67C23A">{{ kpi.revenueAmount }}</div><div class="kpi-label">公共收益(元)</div><div class="kpi-sub">已入账 {{ kpi.revenueConfirmed }}</div></div></el-col>
      <el-col :span="6"><div class="kpi"><div class="kpi-num" style="color:#409EFF">{{ pred.curCollectionRate }}%</div><div class="kpi-label">本月收缴率</div><div class="kpi-sub">下月工单预计 {{ pred.forecastNextWork }}</div></div></el-col>
    </el-row>

    <!-- 图表 -->
    <el-row :gutter="16">
      <el-col :span="12"><el-card shadow="never" class="panel"><template #header>工单/投诉趋势（近6月）</template><v-chart :option="trendOption" autoresize style="height:260px" /></el-card></el-col>
      <el-col :span="12"><el-card shadow="never" class="panel"><template #header>账单收缴趋势（近6月）</template><v-chart :option="collectOption" autoresize style="height:260px" /></el-card></el-col>
    </el-row>
    <el-row :gutter="16">
      <el-col :span="6"><el-card shadow="never" class="panel"><template #header>工单类型分布</template><v-chart :option="pieOption(structure.workByType)" autoresize style="height:220px" /></el-card></el-col>
      <el-col :span="6"><el-card shadow="never" class="panel"><template #header>设备状态分布</template><v-chart :option="pieOption(structure.facByStatus, true)" autoresize style="height:220px" /></el-card></el-col>
      <el-col :span="6"><el-card shadow="never" class="panel"><template #header>投诉类型分布</template><v-chart :option="pieOption(structure.compByType)" autoresize style="height:220px" /></el-card></el-col>
      <el-col :span="6"><el-card shadow="never" class="panel"><template #header>公共收益构成</template><v-chart :option="pieOption(structure.revByType, true)" autoresize style="height:220px" /></el-card></el-col>
    </el-row>

    <!-- 预测卡片 -->
    <el-row :gutter="16">
      <el-col :span="6"><div class="kpi"><div class="kpi-num">{{ pred.forecastNextWork }}</div><div class="kpi-label">下月工单预测</div><div class="kpi-sub">近6月均值 {{ pred.workAvg }}</div></div></el-col>
      <el-col :span="6"><div class="kpi"><div class="kpi-num warn">{{ fmt(pred.meterUnbilled) }}</div><div class="kpi-label">未生成账单抄表(元)</div></div></el-col>
      <el-col :span="6"><div class="kpi"><div class="kpi-num">{{ fmt(pred.parkingRevenue) }}</div><div class="kpi-label">停车累计收入(元)</div></div></el-col>
      <el-col :span="6"><div class="kpi"><div class="kpi-num green">{{ kpi.workDone }}</div><div class="kpi-label">本月已完工工单</div></div></el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import request from '@/api/request';
import { ElMessage } from 'element-plus';
import VChart from 'vue-echarts';
import { use } from 'echarts/core';
import { LineChart, BarChart, PieChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
use([LineChart, BarChart, PieChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);

const kpi = ref<any>({ workTotal:0, workPending:0, workDone:0, facTotal:0, facFault:0, facDue:0, complaintTotal:0, complaintPending:0, parkTotal:0, parkIdle:0, residentLive:0, residentOwner:0, inventoryTotal:0, inventoryLow:0, revenueAmount:0, revenueConfirmed:0 });
const trends = ref({ workOrderTrend: [], complaintTrend: [], collectedTrend: [] });
const structure = ref({ workByType: [], facByStatus: [], compByType: [], revByType: [] });
const pred = ref<any>({ forecastNextWork: 0, curCollectionRate: 0, workAvg: 0, meterUnbilled: 0, parkingRevenue: 0 });
const briefing = ref('');

const parkRate = computed(() => kpi.value.parkTotal > 0 ? Math.round(kpi.value.parkIdle / kpi.value.parkTotal * 100) : 0);
function fmt(v: any): string { return Number(v || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 }); }

const trendOption = computed(() => ({
  tooltip: { trigger: 'axis' }, legend: { data: ['工单', '投诉'] },
  grid: { left: 40, right: 20, top: 30, bottom: 30 },
  xAxis: { type: 'category', data: trends.value.workOrderTrend.map((t: any) => t.month) },
  yAxis: { type: 'value' },
  series: [
    { name: '工单', type: 'line', smooth: true, data: trends.value.workOrderTrend.map((t: any) => t.count), areaStyle: { opacity: .15 }, itemStyle: { color: '#409EFF' } },
    { name: '投诉', type: 'line', smooth: true, data: trends.value.complaintTrend.map((t: any) => t.count), itemStyle: { color: '#E6A23C' } },
  ],
}));
const collectOption = computed(() => ({
  tooltip: { trigger: 'axis' }, legend: { data: ['应收', '实收', '收缴率'] },
  grid: { left: 50, right: 50, top: 30, bottom: 30 },
  xAxis: { type: 'category', data: trends.value.collectedTrend.map((t: any) => t.month) },
  yAxis: [{ type: 'value', name: '金额' }, { type: 'value', name: '%', max: 100 }],
  series: [
    { name: '应收', type: 'bar', data: trends.value.collectedTrend.map((t: any) => t.total) },
    { name: '实收', type: 'bar', data: trends.value.collectedTrend.map((t: any) => t.paid) },
    { name: '收缴率', type: 'line', yAxisIndex: 1, smooth: true, data: trends.value.collectedTrend.map((t: any) => t.rate), itemStyle: { color: '#67C23A' } },
  ],
}));
function pieOption(data: any[], money = false) {
  return {
    tooltip: { trigger: 'item', formatter: money ? (p: any) => `${p.name}: ${fmt(p.value)} 元` : undefined },
    legend: { orient: 'vertical', right: 8, top: 'center', textStyle: { fontSize: 11 } },
    series: [{ type: 'pie', radius: ['35%', '68%'], center: ['38%', '50%'], data: data || [], label: { show: false } }],
  };
}

async function loadAll() {
  const calls: Promise<any>[] = [
    request.get('/work-orders/stats', { silent: true }).catch(() => null),
    request.get('/facilities/stats', { silent: true }).catch(() => null),
    request.get('/complaints/stats', { silent: true }).catch(() => null),
    request.get('/parking/spaces/stats', { silent: true }).catch(() => null),
    request.get('/residents/stats', { silent: true }).catch(() => null),
    request.get('/inventory/materials/stats', { silent: true }).catch(() => null),
    request.get('/common-revenues/stats', { silent: true }).catch(() => null),
    request.get('/property-analytics/dashboard', { silent: true }).catch(() => null),
  ];
  const [ws, fs, cs, ps, rs, is, rev, an] = await Promise.all(calls);
  if (ws?.data) { kpi.value.workTotal = ws.data.total; kpi.value.workPending = ws.data.pendingDispatch; kpi.value.workDone = ws.data.finished; }
  if (fs?.data) { kpi.value.facTotal = fs.data.total; kpi.value.facFault = fs.data.fault; kpi.value.facDue = fs.data.expiringSoon; }
  if (cs?.data) { kpi.value.complaintTotal = cs.data.total; kpi.value.complaintPending = cs.data.pending; }
  if (ps?.data) { kpi.value.parkTotal = ps.data.total; kpi.value.parkIdle = ps.data.idle; }
  if (rs?.data) { kpi.value.residentLive = rs.data.residents; kpi.value.residentOwner = rs.data.owners; }
  if (is?.data) { kpi.value.inventoryTotal = is.data.total; kpi.value.inventoryLow = is.data.low; }
  if (rev?.data) { kpi.value.revenueAmount = rev.data.totalAmount; kpi.value.revenueConfirmed = rev.data.receivedAmount; }
  if (an?.data) {
    trends.value = an.data.trends; structure.value = an.data.structure; pred.value = an.data.prediction;
    const flow = trends.value.workOrderTrend.map((t: any) => t.count);
    briefing.value = `近6个月月均工单 ${pred.value.workAvg} 单，环比趋势${flow[flow.length-1] >= flow[0] ? '上升' : '下降'}；本月账单收缴率 ${pred.value.curCollectionRate}%；当前未生成账单抄表 ${fmt(pred.value.meterUnbilled)} 元；车位空闲率 ${parkRate.value}%。建议重点关注设备到期(${kpi.value.facDue}台)与待处理投诉(${kpi.value.complaintPending}件)。`;
  }
}
const autoRunning = ref(false);
async function runAuto() {
  autoRunning.value = true;
  try { const res = await request.post('/property-automation/run', {}); ElMessage.success('自动化完成'); loadAll(); }
  catch (err: any) { ElMessage.error(err?.response?.data?.message || '执行失败'); } finally { autoRunning.value = false; }
}
onMounted(() => loadAll());
</script>

<style lang="scss" scoped>
.ops-page { padding: 0; }
.head-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.page-title { font-size: 20px; font-weight: 700; color: #0A3D62; margin: 0; }
.briefing { margin-bottom: 16px; }
.kpi-row { margin-bottom: 16px; }
.kpi { background: #fff; border: 1px solid #ebeef5; border-radius: 8px; padding: 18px; }
.kpi-num { font-size: 28px; font-weight: 700; color: #0A3D62; }
.kpi-num.warn { color: #E6A23C; } .kpi-num.green { color: #67C23A; }
.kpi-label { margin-top: 6px; font-size: 14px; color: #303133; font-weight: 600; }
.kpi-sub { margin-top: 4px; font-size: 12px; color: #909399; }
.panel { margin-bottom: 16px; }
</style>