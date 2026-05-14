<template>
  <div class="rent-dashboard">
    <h2 class="page-title">收租看板</h2>
    <el-row :gutter="16" class="kpi-row">
      <el-col :span="4" v-for="kpi in kpis" :key="kpi.label">
        <el-card shadow="hover" class="kpi-card">
          <div class="kpi-label">{{ kpi.label }}</div>
          <div class="kpi-value" :style="{ color: kpi.color }">{{ kpi.value }}</div>
        </el-card>
      </el-col>
    </el-row>
    <el-row :gutter="16" style="margin-top:16px">
      <el-col :span="12">
        <el-card><template #header>收租趋势</template><v-chart :option="trendOption" style="height:280px" autoresize /></el-card>
      </el-col>
      <el-col :span="12">
        <el-card><template #header>逾期率趋势</template><v-chart :option="overdueOption" style="height:280px" autoresize /></el-card>
      </el-col>
    </el-row>
    <el-row :gutter="16" style="margin-top:16px">
      <el-col :span="12">
        <el-card><template #header>收款渠道分布</template><v-chart :option="channelOption" style="height:280px" autoresize /></el-card>
      </el-col>
      <el-col :span="12">
        <el-card><template #header>催缴概览</template><v-chart :option="dunningOption" style="height:280px" autoresize /></el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import request from '@/api/request';
import { use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { LineChart, BarChart, PieChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent, TitleComponent } from 'echarts/components';
import VChart from 'vue-echarts';

use([CanvasRenderer, LineChart, BarChart, PieChart, GridComponent, TooltipComponent, LegendComponent, TitleComponent]);

const kpis = ref([
  { label: '当月收缴率', value: '--', color: '#00B894' },
  { label: '逾期率', value: '--', color: '#FF6B35' },
  { label: '当月应收(万)', value: '--', color: '#0A3D62' },
  { label: '当月实收(万)', value: '--', color: '#F6B93B' },
  { label: '欠费户数', value: '--', color: '#FF6B35' },
]);

const trendOption = ref({});
const overdueOption = ref({});
const channelOption = ref({});
const dunningOption = ref({});

function buildTrendChart(months: string[], dueData: number[], collectedData: number[], overdueData: number[]) {
  return {
    tooltip: { trigger: 'axis' },
    legend: { data: ['应收', '实收', '欠费'], bottom: 0 },
    grid: { left: 50, right: 20, top: 10, bottom: 30 },
    xAxis: { type: 'category', data: months, axisLabel: { rotate: 45, fontSize: 10 } },
    yAxis: { type: 'value', axisLabel: { formatter: (v: number) => (v / 10000).toFixed(0) + '万' } },
    series: [
      { name: '应收', type: 'line', data: dueData, smooth: true, lineStyle: { color: '#0A3D62' }, itemStyle: { color: '#0A3D62' } },
      { name: '实收', type: 'line', data: collectedData, smooth: true, lineStyle: { color: '#00B894' }, itemStyle: { color: '#00B894' } },
      { name: '欠费', type: 'line', data: overdueData, smooth: true, lineStyle: { color: '#FF6B35' }, itemStyle: { color: '#FF6B35' } },
    ],
  };
}

function buildOverdueChart(months: string[], rates: number[]) {
  return {
    tooltip: { trigger: 'axis', formatter: (p: any) => `${p[0].axisValue}<br/>逾期率: ${p[0].value}%` },
    grid: { left: 50, right: 20, top: 10, bottom: 30 },
    xAxis: { type: 'category', data: months, axisLabel: { rotate: 45, fontSize: 10 } },
    yAxis: { type: 'value', axisLabel: { formatter: '{value}%' } },
    series: [{
      type: 'line', data: rates, smooth: true, areaStyle: { color: 'rgba(255,107,53,0.15)' },
      lineStyle: { color: '#FF6B35' }, itemStyle: { color: '#FF6B35' },
    }],
  };
}

function buildChannelChart(data: { channel: string; total: number }[]) {
  return {
    tooltip: { trigger: 'item', formatter: '{b}: ¥{c} ({d}%)' },
    legend: { bottom: 0 },
    series: [{
      type: 'pie', radius: ['40%', '70%'], center: ['50%', '45%'],
      data: data.map(d => ({ name: d.channel, value: Math.round(d.total * 100) / 100 })),
      label: { formatter: '{b}\n{d}%' },
      emphasis: { itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0,0,0,0.3)' } },
    }],
  };
}

function buildDunningChart(data: { level: string; count: number }[]) {
  return {
    tooltip: { trigger: 'axis' },
    grid: { left: 100, right: 20, top: 10, bottom: 20 },
    xAxis: { type: 'value', axisLabel: { formatter: '{value}' } },
    yAxis: { type: 'category', data: data.map(d => d.level), axisLabel: { fontSize: 11 } },
    series: [{
      type: 'bar', data: data.map(d => ({ value: d.count, itemStyle: { color: d.count > 0 ? '#FF6B35' : '#B2BEC3' } })),
      barMaxWidth: 30, label: { show: true, position: 'right' },
    }],
  };
}

onMounted(async () => {
  try {
    const res = await request.get('/dashboard/rent');
    const d = res.data;
    kpis.value = [
      { label: '当月收缴率', value: d.collectionRate + '%', color: '#00B894' },
      { label: '逾期率', value: d.overdueRate + '%', color: '#FF6B35' },
      { label: '当月应收(万)', value: (d.monthlyDue / 10000).toFixed(1), color: '#0A3D62' },
      { label: '当月实收(万)', value: (d.monthlyCollected / 10000).toFixed(1), color: '#F6B93B' },
      { label: '欠费户数', value: String(d.arrearsCount), color: '#FF6B35' },
    ];

    if (d.trend) {
      trendOption.value = buildTrendChart(
        d.trend.map((t: any) => t.period),
        d.trend.map((t: any) => t.due),
        d.trend.map((t: any) => t.collected),
        d.trend.map((t: any) => t.overdue),
      );
    }

    if (d.overdueTrend) {
      overdueOption.value = buildOverdueChart(
        d.overdueTrend.map((t: any) => t.period),
        d.overdueTrend.map((t: any) => t.rate),
      );
    }

    channelOption.value = buildChannelChart(d.channelStats || []);

    dunningOption.value = buildDunningChart(d.dunningStats || []);
  } catch (e: any) {
    console.error('收租看板加载失败:', e?.response?.data?.message || e.message);
  }
});
</script>

<style lang="scss" scoped>
.page-title { font-size: 18px; font-weight: 700; color: #0A3D62; margin-bottom: 16px; }
.kpi-card { text-align: center; cursor: pointer; }
.kpi-label { font-size: 12px; color: #7F8C8D; margin-bottom: 8px; }
.kpi-value { font-size: 28px; font-weight: 700; }
</style>
