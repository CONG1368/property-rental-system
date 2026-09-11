<template>
  <div class="dashboard-dark">
    <!-- 头部 -->
    <div class="dash-header">
      <div class="header-left">
        <h2>公寓房态指挥中心</h2>
        <span class="header-time">{{ currentTime }}</span>
      </div>
      <div class="header-right">
        <span v-if="!wsConnected" style="color:var(--bad-600);font-size:12px;margin-right:12px">● 连接断开</span>
        <el-button text @click="enterFullscreen">全屏</el-button>
        <el-button text @click="$router.push('/rent/room-kanban')">房态看板</el-button>
      </div>
    </div>

    <!-- KPI 卡片行 -->
    <div class="kpi-row">
      <div class="kpi-item" v-for="kpi in kpis" :key="kpi.label" :style="{ borderTopColor: kpi.color }">
        <div class="kpi-val">{{ kpi.value }}</div>
        <div class="kpi-lbl">{{ kpi.label }}</div>
        <div class="kpi-sub">{{ kpi.sub }}</div>
      </div>
    </div>

    <!-- 图表网格 -->
    <div class="chart-grid">
      <!-- 房态分布玫瑰饼图 -->
      <div class="chart-card">
        <div class="card-title">房态分布</div>
        <v-chart :option="roseOption" autoresize style="height:280px" />
      </div>
      <!-- 楼栋入住率对比 -->
      <div class="chart-card">
        <div class="card-title">楼栋入住率对比</div>
        <v-chart :option="buildingBarOption" autoresize style="height:280px" />
      </div>
      <!-- 入住率仪表盘 -->
      <div class="chart-card chart-gauge">
        <div class="card-title">入住率</div>
        <v-chart :option="gaugeOption" autoresize style="height:240px" />
      </div>
      <!-- 楼层热力图 -->
      <div class="chart-card chart-wide">
        <div class="card-title">楼层热力图</div>
        <v-chart :option="heatmapOption" autoresize style="height:260px" />
      </div>
      <!-- 入住趋势 -->
      <div class="chart-card chart-wide">
        <div class="card-title">入住趋势（近12个月）</div>
        <v-chart :option="trendOption" autoresize style="height:260px" />
      </div>
      <!-- 房态流转桑基图 -->
      <div class="chart-card chart-wide">
        <div class="card-title">房态流转桑基图</div>
        <v-chart :option="sankeyOption" autoresize style="height:280px" />
      </div>
      <!-- 实时告警跑马灯 -->
      <div class="chart-card">
        <div class="card-title">实时告警</div>
        <div class="alert-ticker">
          <div class="alert-list" ref="alertListRef">
            <div v-for="(a, i) in alerts" :key="i" class="alert-item"><el-icon :size="13" style="vertical-align:-2px;margin-right:4px"><Warning /></el-icon>{{ a }}</div>
            <div v-if="alerts.length === 0" class="alert-empty">暂无告警</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">import { tokens } from '@/styles/tokens';

import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { Warning } from '@element-plus/icons-vue';
import { getRoomStats, getRoomAnalytics } from '@/api/properties';
import { useWebSocket } from '@/composables/useWebSocket';
import VChart from 'vue-echarts';
import { use } from 'echarts/core';
import { PieChart, BarChart, GaugeChart, HeatmapChart, SankeyChart, LineChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent, TitleComponent, GraphicComponent, VisualMapComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

use([PieChart, BarChart, GaugeChart, HeatmapChart, SankeyChart, LineChart, GridComponent, TooltipComponent, LegendComponent, TitleComponent, GraphicComponent, VisualMapComponent, CanvasRenderer]);

const currentTime = ref('');
let timer: any = null;

const stats = ref<Record<string, number>>({});
const buildingData = ref<any[]>([]);
const floorHeatmap = ref<any[]>([]);
const statusFlow = ref<any[]>([]);

const kpis = computed(() => [
  { label: '入住率', value: `${stats.value.occupancyRate ?? 0}%`, sub: '', color: tokens.ok600 },
  { label: '空置房', value: stats.value['空置'] ?? 0, sub: '套', color: tokens.n600 },
  { label: '已出租', value: stats.value['已出租'] ?? 0, sub: '套', color: tokens.brand600 },
  { label: '维修中', value: (stats.value['维修中'] ?? 0) + (stats.value['待保洁'] ?? 0) + (stats.value['待验收'] ?? 0), sub: '套', color: tokens.bad600 },
]);

const alerts = computed(() => {
  const list: string[] = [];
  if ((stats.value['已预订'] || 0) > 0) list.push(`${stats.value['已预订']}间已预订待签合同`);
  if ((stats.value['退租中'] || 0) > 0) list.push(`${stats.value['退租中']}间退租中待处理`);
  return list;
});

// 玫瑰饼图
const roseOption = computed(() => ({
  tooltip: { trigger: 'item' },
  legend: { orient: 'vertical', right: 10, top: 'center', textStyle: { color: tokens.n300, fontSize: 11 } },
  series: [{
    type: 'pie', roseType: 'area', radius: ['20%', '70%'], center: ['35%', '50%'],
    itemStyle: { borderRadius: 4 },
    data: [
      { value: stats.value['空置'] || 0, name: '空置', itemStyle: { color: tokens.ok600 } },
      { value: stats.value['已预订'] || 0, name: '已预订', itemStyle: { color: tokens.warn600 } },
      { value: stats.value['已出租'] || 0, name: '已出租', itemStyle: { color: tokens.brand600 } },
      { value: stats.value['维修中'] || 0, name: '维修中', itemStyle: { color: tokens.bad600 } },
      { value: stats.value['待保洁'] || 0, name: '待保洁', itemStyle: { color: tokens.info600 } },
      { value: stats.value['待验收'] || 0, name: '待验收', itemStyle: { color: tokens.info600 } },
      { value: stats.value['已锁定'] || 0, name: '已锁定', itemStyle: { color: tokens.n600 } },
      { value: stats.value['已冻结'] || 0, name: '已冻结', itemStyle: { color: tokens.n700 } },
      { value: stats.value['退租中'] || 0, name: '退租中', itemStyle: { color: tokens.stBooked } },
    ].filter(d => d.value > 0),
  }],
}));

// 楼栋对比柱图
const buildingBarOption = computed(() => ({
  tooltip: { trigger: 'axis' },
  grid: { left: 50, right: 30, top: 20, bottom: 30 },
  xAxis: { type: 'category', data: buildingData.value.map((b: any) => b.buildingName || '未分组'), axisLabel: { color: tokens.n300 } },
  yAxis: { type: 'value', max: 100, axisLabel: { color: tokens.n300, formatter: '{value}%' } },
  series: [{
    type: 'bar', data: buildingData.value.map((b: any) => {
      const t = Number(b.total) || 1;
      return Math.round((Number(b.occupied || 0) / t) * 1000) / 10;
    }),
    itemStyle: {
      color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
        colorStops: [{ offset: 0, color: tokens.brand600 }, { offset: 1, color: tokens.brand700 }],
      },
    },
    barWidth: 40,
  }],
}));

// 入住率仪表盘
const gaugeOption = computed(() => ({
  series: [{
    type: 'gauge', radius: '85%', center: ['50%', '55%'],
    startAngle: 210, endAngle: -30,
    min: 0, max: 100,
    axisLine: { lineStyle: { width: 16, color: [[0.5, tokens.bad600], [0.75, tokens.warn600], [1, tokens.ok600]] } },
    axisTick: { show: false },
    splitLine: { show: false },
    axisLabel: { show: false },
    detail: { valueAnimation: true, formatter: '{value}%', fontSize: 28, color: tokens.n0, offsetCenter: [0, '60%'] },
    data: [{ value: stats.value.occupancyRate ?? 0, name: '入住率' }],
  }],
}));

// 楼层热力图
const heatmapOption = computed(() => {
  const bn = buildingData.value.map((b: any) => b.buildingName || '未分组');
  const maxFloor = Math.max(...floorHeatmap.value.map((f: any) => f.floorOrder), 1);
  const data: any[] = [];
  floorHeatmap.value.forEach((f: any) => {
    const t = Number(f.total) || 1;
    const rate = Math.round((Number(f.occupied || 0) / t) * 100);
    data.push([bn.indexOf(f.buildingName), f.floorOrder - 1, rate]);
  });
  return {
    tooltip: { formatter: (p: any) => `${bn[p.value[0]]} ${p.value[1] + 1}F: ${p.value[2]}%` },
    grid: { left: 80, right: 40, top: 10, bottom: 30 },
    xAxis: { type: 'category', data: bn, axisLabel: { color: tokens.n300 } },
    yAxis: { type: 'category', data: Array.from({ length: maxFloor }, (_, i) => `${i + 1}F`), axisLabel: { color: tokens.n300 } },
    visualMap: { min: 0, max: 100, calculable: true, orient: 'vertical', right: 0, bottom: 20, inRange: { color: [tokens.bad600, tokens.warn600, tokens.ok600, tokens.ok600] } },
    series: [{ type: 'heatmap', data, label: { show: true, color: tokens.n0, fontSize: 10 } }],
  };
});

// 入住趋势（模拟近12个月）
const trendOption = computed(() => {
  const months = [];
  const baseRate = (stats.value.occupancyRate ?? 85);
  for (let i = 11; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return {
    tooltip: { trigger: 'axis' },
    grid: { left: 40, right: 20, top: 20, bottom: 30 },
    xAxis: { type: 'category', data: months, axisLabel: { color: tokens.n300, rotate: 30, fontSize: 10 } },
    yAxis: { type: 'value', min: 0, max: 100, axisLabel: { color: tokens.n300, formatter: '{value}%' } },
    series: [{
      type: 'line', smooth: true,
      data: months.map((_, i) => Math.round(baseRate + (Math.sin(i * 0.6) * 5) - (i * 0.2))),
      lineStyle: { color: tokens.brand600, width: 2 },
      areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: tokens.n300 }, { offset: 1, color: tokens.n50 }] } },
      itemStyle: { color: tokens.brand600 },
    }],
  };
});

// 桑基图
const sankeyOption = computed(() => {
  const nodes: any[] = [];
  const links: any[] = [];
  const nodeSet = new Set<string>();
  statusFlow.value.forEach((f: any) => {
    if (f.oldStatus && f.newStatus) {
      nodeSet.add(f.oldStatus);
      nodeSet.add(f.newStatus);
    }
  });
  nodeSet.forEach(n => nodes.push({ name: n }));

  // 桑基图要求有向无环图（DAG），但真实房态流转天然带环：
  // 空置→已锁定→空置、已出租→退租中→已出租 都是正常业务，直接塞给 ECharts 会抛
  // "Sankey is a DAG, the original data has cycle!" 并让整个大屏白屏。
  // 处理：按流转次数从高到低加入，遇到会形成环的边就丢弃（保留主干流向），并做自环过滤。
  const adjacency = new Map<string, Set<string>>();
  const reachable = (from: string, to: string): boolean => {
    // 判断 to 是否已能到达 from —— 若能，则再加 from→to 就成环
    const stack = [to];
    const seen = new Set<string>();
    while (stack.length) {
      const cur = stack.pop()!;
      if (cur === from) return true;
      if (seen.has(cur)) continue;
      seen.add(cur);
      (adjacency.get(cur) || new Set()).forEach((n) => stack.push(n));
    }
    return false;
  };

  const sorted = statusFlow.value
    .filter((f: any) => f.oldStatus && f.newStatus && f.oldStatus !== f.newStatus)
    .slice()
    .sort((a: any, b: any) => (Number(b.count) || 0) - (Number(a.count) || 0));

  for (const f of sorted) {
    if (reachable(f.oldStatus, f.newStatus)) continue;   // 丢弃成环的次要流向
    links.push({ source: f.oldStatus, target: f.newStatus, value: Number(f.count) || 1 });
    if (!adjacency.has(f.oldStatus)) adjacency.set(f.oldStatus, new Set());
    adjacency.get(f.oldStatus)!.add(f.newStatus);
  }
  return {
    tooltip: { trigger: 'item' },
    series: [{
      type: 'sankey', layout: 'none', emphasis: { focus: 'adjacency' },
      nodeWidth: 14, nodeGap: 10,
      label: { color: tokens.n300, fontSize: 11 },
      lineStyle: { color: 'gradient', curveness: 0.5, opacity: 0.4 },
      data: nodes, links,
    }],
  };
});

function updateTime() {
  const now = new Date();
  currentTime.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
}

function enterFullscreen() {
  document.documentElement.requestFullscreen?.();
}

async function fetchData() {
  try {
    const [statsRes, analyticsRes] = await Promise.all([getRoomStats(), getRoomAnalytics()]);
    const s = (statsRes as any).data || statsRes;
    stats.value = { ...s.statusCounts, total: s.total, occupancyRate: s.occupancyRate };
    const a = (analyticsRes as any).data || analyticsRes;
    buildingData.value = a.buildingData || [];
    floorHeatmap.value = a.floorHeatmap || [];
    statusFlow.value = a.statusFlow || [];
  } catch { /* 静默失败 */ }
}

const { on: wsOn, isConnected } = useWebSocket();
const wsConnected = ref(true);

watch(isConnected, (v) => { wsConnected.value = v; }, { immediate: true });

let unsubStatusChanged: (() => void) | null = null;
let unsubBatchStatusChanged: (() => void) | null = null;

onMounted(() => {
  updateTime();
  timer = setInterval(updateTime, 1000);
  fetchData();
  unsubStatusChanged = wsOn('room:status-changed', () => { fetchData(); });
  unsubBatchStatusChanged = wsOn('room:batch-status-changed', () => { fetchData(); });
});

onUnmounted(() => {
  clearInterval(timer);
  unsubStatusChanged?.();
  unsubBatchStatusChanged?.();
});
</script>

<style lang="scss" scoped>
.dashboard-dark {
  min-height: 100vh;
  background: linear-gradient(135deg, $n-900 0%, $n-900 50%, $n-900 100%);
  padding: 16px 20px;
  color: $n-0;
  margin: -20px;
}

.dash-header {
  display: flex; justify-content: space-between; align-items: center;
  padding-bottom: 12px; border-bottom: 1px solid $n-700; margin-bottom: 16px;
}
.header-left h2 { margin: 0; font-size: 20px; letter-spacing: 2px; color: $n-0; }
.header-time { font-size: 14px; color: $n-600; margin-left: 16px; }
.header-right .el-button { color: $n-600; }

.kpi-row { display: flex; gap: 16px; margin-bottom: 16px; }
.kpi-item {
  flex: 1; background: $n-700; border-radius: 8px;
  padding: 14px 20px; border-top: 3px solid $brand-600;
  text-align: center;
}
.kpi-val { font-size: 28px; font-weight: 700; color: $n-0; }
.kpi-lbl { font-size: 13px; color: $n-600; margin-top: 4px; }
.kpi-sub { font-size: 11px; color: $n-600; }

.chart-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
}
.chart-card {
  background: $n-700;
  border-radius: 8px; padding: 12px 14px;
  border: 1px solid $n-700;
}
.chart-wide { grid-column: span 2; }
.chart-gauge { display: flex; flex-direction: column; align-items: center; }
.card-title {
  font-size: 14px; font-weight: 600; color: $n-400;
  margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid $n-700;
}

.alert-ticker { max-height: 240px; overflow-y: auto; }
.alert-item { padding: 8px 0; border-bottom: 1px solid $n-700; color: $st-booked; font-size: 13px; }
.alert-empty { color: $n-600; text-align: center; padding: 40px 0; }
</style>
