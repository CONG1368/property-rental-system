<template>
  <div class="finance-dashboard">
    <h2 class="page-title">财务看板</h2>
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;flex-wrap:wrap">
      <span style="font-size:13px;color:#606266">周期:</span>
      <el-radio-group v-model="periodMode" size="small" @change="onModeChange">
        <el-radio-button value="yearly">年度</el-radio-button>
        <el-radio-button value="quarterly">季度</el-radio-button>
        <el-radio-button value="monthly">月度</el-radio-button>
        <el-radio-button value="weekly">周度</el-radio-button>
      </el-radio-group>
      <template v-if="periodMode === 'yearly'">
        <el-select v-model="selectedYear" size="small" style="width:100px" @change="loadData">
          <el-option v-for="y in yearOptions" :key="y" :label="String(y)" :value="y" />
        </el-select>
      </template>
      <template v-if="periodMode === 'quarterly'">
        <el-select v-model="selectedQuarterYear" size="small" style="width:100px" @change="loadData">
          <el-option v-for="y in yearOptions" :key="y" :label="String(y)" :value="y" />
        </el-select>
        <el-select v-model="selectedQuarter" size="small" style="width:80px" @change="loadData">
          <el-option label="Q1" :value="1" />
          <el-option label="Q2" :value="2" />
          <el-option label="Q3" :value="3" />
          <el-option label="Q4" :value="4" />
        </el-select>
      </template>
      <el-date-picker v-if="periodMode === 'monthly'" v-model="selectedMonth" type="month" value-format="YYYY-MM" size="small" style="width:150px" @change="loadData" />
      <el-date-picker v-if="periodMode === 'weekly'" v-model="selectedWeek" type="date" placeholder="选择周一" value-format="YYYY-MM-DD" size="small" style="width:150px" @change="onWeekChange" />
      <el-tag size="small" type="info" v-if="currentPeriod">{{ currentPeriod }}</el-tag>
    </div>

    <el-row :gutter="16">
      <el-col :span="6" v-for="kpi in kpis" :key="kpi.label">
        <el-card shadow="hover" class="kpi-card">
          <div class="kpi-label">{{ kpi.label }}</div>
          <div class="kpi-value" :style="{ color: kpi.color }">{{ kpi.value }}</div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="16" style="margin-top:16px">
      <el-col :span="12">
        <el-card>
          <template #header>收支趋势</template>
          <v-chart :option="incomeTrendOption" style="height:280px" autoresize />
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card>
          <template #header>现金流分析</template>
          <v-chart :option="cashFlowOption" style="height:280px" autoresize />
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="16" style="margin-top:16px">
      <el-col :span="24">
        <el-card>
          <template #header>费用构成</template>
          <v-chart v-if="expensePieOption" :option="expensePieOption" style="height:280px" autoresize />
          <el-empty v-else description="本期无费用数据" :image-size="80" />
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import request from '@/api/request';
import { use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { LineChart, BarChart, PieChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components';
import VChart from 'vue-echarts';
import dayjs from 'dayjs';

use([CanvasRenderer, LineChart, BarChart, PieChart, GridComponent, TooltipComponent, LegendComponent]);

const currentYear = new Date().getFullYear();
const periodMode = ref('yearly');
const selectedYear = ref(currentYear);
const selectedQuarterYear = ref(currentYear);
const selectedQuarter = ref(Math.ceil((new Date().getMonth() + 1) / 3));
const selectedMonth = ref(dayjs().format('YYYY-MM'));
const selectedWeek = ref(dayjs().startOf('week').add(1, 'day').format('YYYY-MM-DD'));
const currentPeriod = ref('');

const yearOptions = computed(() => Array.from({ length: 4 }, (_, i) => currentYear - i));

const kpis = ref([
  { label: '总收入', value: '--', color: '#00B894' },
  { label: '总支出', value: '--', color: '#FF6B35' },
  { label: '净利润', value: '--', color: '#0A3D62' },
  { label: '利润率', value: '--', color: '#F6B93B' },
]);

const incomeTrendOption = ref({});
const cashFlowOption = ref({});
const expensePieOption = ref<any>(null);

function formatWan(v: number): string { return (v / 10000).toFixed(1) + '万'; }

function buildTrendChart(data: any[], labels: string[]) {
  return {
    tooltip: { trigger: 'axis' },
    legend: { data: ['收入', '支出', '净利润'], bottom: 0 },
    grid: { left: 55, right: 20, top: 10, bottom: 30 },
    xAxis: { type: 'category', data: labels, axisLabel: { fontSize: 10 } },
    yAxis: { type: 'value', axisLabel: { formatter: (v: number) => (v / 10000).toFixed(0) + '万' } },
    series: [
      { name: '收入', type: 'line', data: data.map((t: any) => t.income), smooth: true, lineStyle: { color: '#00B894' }, itemStyle: { color: '#00B894' } },
      { name: '支出', type: 'line', data: data.map((t: any) => t.expense), smooth: true, lineStyle: { color: '#FF6B35' }, itemStyle: { color: '#FF6B35' } },
      { name: '净利润', type: 'line', data: data.map((t: any) => t.net), smooth: true, lineStyle: { color: '#0A3D62', type: 'dashed' }, itemStyle: { color: '#0A3D62' } },
    ],
  };
}

function buildCashFlowChart(data: any[], labels: string[]) {
  return {
    tooltip: { trigger: 'axis' },
    legend: { data: ['经营活动', '投资活动', '筹资活动'], bottom: 0 },
    grid: { left: 55, right: 20, top: 10, bottom: 30 },
    xAxis: { type: 'category', data: labels, axisLabel: { fontSize: 10 } },
    yAxis: { type: 'value', axisLabel: { formatter: (v: number) => (v / 10000).toFixed(0) + '万' } },
    series: [
      { name: '经营活动', type: 'bar', data: data.map((t: any) => t.operating), barGap: '10%', itemStyle: { color: '#0984E3' } },
      { name: '投资活动', type: 'bar', data: data.map((t: any) => t.investing), barGap: '10%', itemStyle: { color: '#636E72' } },
      { name: '筹资活动', type: 'bar', data: data.map((t: any) => t.financing), barGap: '10%', itemStyle: { color: '#B2BEC3' } },
    ],
  };
}

function updateDisplay(d: any, prefix: string) {
  kpis.value = [
    { label: prefix + '总收入', value: '¥' + formatWan(d.totalRevenue), color: '#00B894' },
    { label: prefix + '总支出', value: '¥' + formatWan(d.totalExpense), color: '#FF6B35' },
    { label: prefix + '净利润', value: '¥' + formatWan(d.netProfit), color: '#0A3D62' },
    { label: '利润率', value: d.profitMargin + '%', color: '#F6B93B' },
  ];

  if (d.expenseBreakdown && d.expenseBreakdown.length > 0) {
    expensePieOption.value = {
      tooltip: { trigger: 'item', formatter: '{b}: ¥{c} ({d}%)' },
      legend: { bottom: 0 },
      series: [{
        type: 'pie', radius: ['45%', '75%'], center: ['50%', '45%'],
        data: d.expenseBreakdown.map((e: any) => ({ name: e.name, value: e.value })),
        label: { formatter: '{b}\n{d}%' },
        emphasis: { itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0,0,0,0.3)' } },
      }],
    };
  } else {
    expensePieOption.value = null;
  }
}

async function loadYearlyData() {
  const res = await request.get('/dashboard/finance', { params: { year: selectedYear.value } });
  const d = res.data;
  currentPeriod.value = String(selectedYear.value) + '年';
  updateDisplay(d, '年度');
  const labels = d.incomeTrend.map((t: any) => t.period);
  incomeTrendOption.value = buildTrendChart(d.incomeTrend, labels);
  cashFlowOption.value = buildCashFlowChart(d.cashFlowTrend, labels);
}

async function loadQuarterlyData() {
  const res = await request.get('/dashboard/finance-quarterly', { params: { year: selectedQuarterYear.value, quarter: selectedQuarter.value } });
  const d = res.data;
  currentPeriod.value = d.period;
  updateDisplay(d, '季度');
  const labels = d.incomeTrend.map((t: any) => t.period + '月');
  incomeTrendOption.value = buildTrendChart(d.incomeTrend, labels);
  cashFlowOption.value = buildCashFlowChart(d.cashFlowTrend, labels);
}

async function loadMonthlyData() {
  const res = await request.get('/dashboard/finance', { params: { year: selectedMonth.value.slice(0, 4), month: selectedMonth.value } });
  const d = res.data;
  currentPeriod.value = selectedMonth.value;
  updateDisplay(d, '月度');
  const labels = d.incomeTrend.map((t: any) => t.period + '日');
  incomeTrendOption.value = buildTrendChart(d.incomeTrend, labels);
  cashFlowOption.value = buildCashFlowChart(d.cashFlowTrend, labels);
}

async function loadWeeklyData() {
  const res = await request.get('/dashboard/finance-weekly', { params: { weekStart: selectedWeek.value } });
  const d = res.data;
  currentPeriod.value = d.period;
  updateDisplay(d, '周度');
  const labels = d.incomeTrend.map((t: any) => t.period);
  incomeTrendOption.value = buildTrendChart(d.incomeTrend, labels);
  cashFlowOption.value = buildCashFlowChart(d.cashFlowTrend, labels);
}

function onModeChange() {
  if (periodMode.value === 'weekly') loadWeeklyData();
  else loadData();
}

function onWeekChange() {
  if (selectedWeek.value) loadWeeklyData();
}

async function loadData() {
  try {
    if (periodMode.value === 'yearly') await loadYearlyData();
    else if (periodMode.value === 'quarterly') await loadQuarterlyData();
    else if (periodMode.value === 'monthly') await loadMonthlyData();
    else if (periodMode.value === 'weekly') await loadWeeklyData();
  } catch (e: any) {
    console.error('[财务看板] 加载失败:', e?.message || e);
  }
}

onMounted(() => loadData());
</script>

<style lang="scss" scoped>
.page-title { font-size: 18px; font-weight: 700; color: #0A3D62; margin-bottom: 16px; }
.kpi-card { text-align: center; }
.kpi-label { font-size: 12px; color: #7F8C8D; margin-bottom: 8px; }
.kpi-value { font-size: 28px; font-weight: 700; }
</style>
