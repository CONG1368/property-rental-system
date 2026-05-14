<template>
  <div class="home-dashboard">
    <h2 class="page-title">首页概览</h2>

    <!-- KPI 卡片 -->
    <el-row :gutter="16" class="kpi-row">
      <el-col :span="6" v-for="kpi in kpis" :key="kpi.label">
        <div class="kpi-card" @click="goPage(kpi.link)" :title="kpi.label + ' — 点击查看详情'">
          <div class="kpi-top">
            <span class="kpi-icon" :style="{ background: kpi.color }">{{ kpi.icon }}</span>
            <span class="kpi-trend" :class="kpi.trend > 0 ? 'up' : kpi.trend < 0 ? 'down' : 'flat'" v-if="kpi.value !== '--'">
              {{ kpi.trend > 0 ? '↑' : kpi.trend < 0 ? '↓' : '→' }} {{ kpi.trend !== 0 ? Math.abs(kpi.trend) + '%' : '持平' }}
            </span>
          </div>
          <div class="kpi-value" :style="{ color: kpi.color }">{{ kpi.value }}</div>
          <div class="kpi-label">{{ kpi.label }}</div>
          <div class="kpi-bar"><span class="kpi-bar-fill" :style="{ width: kpi.percent + '%', background: kpi.color }"></span></div>
        </div>
      </el-col>
    </el-row>

    <!-- 多周期收入趋势曲线图 -->
    <div class="section-card" style="margin-top:16px">
      <div class="section-header">
        <span class="section-title">收入趋势分析</span>
        <div class="chart-controls">
          <el-radio-group v-model="chartPeriod" size="small">
            <el-radio-button :value="6">近6月</el-radio-button>
            <el-radio-button :value="12">近12月</el-radio-button>
            <el-radio-button :value="36">近36月</el-radio-button>
          </el-radio-group>
          <el-button type="primary" link size="small" style="margin-left:12px" @click="goPage('/rent/dashboard')">查看详情 →</el-button>
        </div>
      </div>
      <v-chart :option="chartOption" style="height:260px" autoresize />
    </div>

    <el-row :gutter="16" style="margin-top:16px">
      <!-- 快捷入口 -->
      <el-col :span="14">
        <div class="section-card">
          <div class="section-header">
            <span class="section-title">快捷入口</span>
          </div>
          <el-row :gutter="12">
            <el-col :span="8" v-for="link in quickLinks" :key="link.path">
              <div class="quick-btn" @click="goPage(link.path)" :title="link.label">
                <span class="quick-icon">{{ link.icon }}</span>
                <span>{{ link.label }}</span>
              </div>
            </el-col>
          </el-row>
        </div>
      </el-col>

      <!-- 催缴 + 到期 -->
      <el-col :span="10">
        <div class="section-card" style="margin-bottom:16px">
          <div class="section-header">
            <span class="section-title">催缴分布</span>
            <el-button type="primary" link size="small" @click="goPage('/rent/dunning')">查看详情 →</el-button>
          </div>
          <div class="viz-list" v-if="dunningStats.some(d => d.count > 0)">
            <div class="viz-item" v-for="ds in dunningStats" :key="ds.level" @click="goPage('/rent/dunning')" :title="ds.level + ': ' + ds.count + '单'">
              <span class="viz-label">{{ ds.level }}</span>
              <div class="viz-bar-wrap"><span class="viz-bar-fill" :style="{ width: maxDunning > 0 ? (ds.count / maxDunning * 100) + '%' : '0%', background: ds.color }"></span></div>
              <span class="viz-count" :style="{ color: ds.color }">{{ ds.count }}</span>
            </div>
          </div>
          <div v-else style="text-align:center;color:#c0c4cc;font-size:13px;padding:16px 0">暂无催缴数据</div>
        </div>

        <div class="section-card">
          <div class="section-header">
            <span class="section-title">即将到期合同</span>
            <el-button type="primary" link size="small" @click="goPage('/contract/expiry')">查看详情 →</el-button>
          </div>
          <div class="expiry-list" v-if="expiringContracts.length > 0">
            <div class="expiry-item" v-for="ec in expiringContracts.slice(0, 4)" :key="ec.id" @click="goPage('/contract/detail/' + ec.id)" :title="ec.contractNo + ' — ' + ec.endDate">
              <span class="expiry-no">{{ ec.contractNo }}</span>
              <span class="expiry-date">{{ ec.endDate }}</span>
              <el-tag :type="ec.daysLeft <= 7 ? 'danger' : ec.daysLeft <= 30 ? 'warning' : ec.daysLeft <= 90 ? 'primary' : ec.daysLeft <= 180 ? '' : ec.daysLeft <= 365 ? 'success' : 'info'" size="small">{{ ec.daysLeft }}天</el-tag>
            </div>
          </div>
          <div v-else style="text-align:center;color:#c0c4cc;font-size:13px;padding:16px 0">暂无即将到期合同</div>
        </div>
      </el-col>
    </el-row>

    <!-- 系统信息 -->
    <div class="section-card sys-info-card">
      <div class="sys-info-row">
        <span class="sys-item"><span class="sys-dot"></span> 版本 v1.0.0</span>
        <span class="sys-sep">|</span>
        <span class="sys-item"><span class="sys-dot"></span> Vue3 + Express + SQLite</span>
        <span class="sys-sep">|</span>
        <span class="sys-item"><span class="sys-dot"></span> {{ nowStr }}</span>
        <span class="sys-sep">|</span>
        <span class="sys-item"><span class="sys-dot"></span> 运行 {{ uptime }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import VChart from 'vue-echarts';
import 'echarts';
import request from '@/api/request';

const router = useRouter();
function goPage(path: string) {
  if (!path) return;
  router.push(path).catch(() => {});
}

// ---- KPI ----
const kpis = ref([
  { label: '房源总数', value: '--', color: '#0A3D62', icon: '🏠', link: '/rent/properties', trend: 0, percent: 0 },
  { label: '在租合同', value: '--', color: '#00B894', icon: '👥', link: '/contract/list', trend: 0, percent: 0 },
  { label: '当月应收(万)', value: '--', color: '#F6B93B', icon: '💰', link: '/rent/bills', trend: 0, percent: 0 },
  { label: '收缴率', value: '--', color: '#FF6B35', icon: '📈', link: '/rent/dashboard', trend: 0, percent: 0 },
]);

const dunningStats = ref([
  { level: '到期提醒', count: 0, color: '#3498db' },
  { level: '一级催缴', count: 0, color: '#f39c12' },
  { level: '二级催缴', count: 0, color: '#e67e22' },
  { level: '三级催缴', count: 0, color: '#e74c3c' },
]);
const maxDunning = computed(() => Math.max(1, ...dunningStats.value.map(d => d.count)));

const expiringContracts = ref<any[]>([]);

// ---- 曲线趋势图 ----
const fullTrend = ref<any[]>([]);
const chartPeriod = ref(6);
const chartOption = computed(() => {
  const data = fullTrend.value.slice(-chartPeriod.value);
  const months = data.map((t: any) => t.period.slice(5) + '月');
  return {
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        let s = params[0].axisValue + '<br/>';
        params.forEach((p: any) => {
          s += `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${p.color};margin-right:6px"></span>${p.seriesName}: ${p.value}${p.seriesIndex === 2 ? '%' : '万'}<br/>`;
        });
        return s;
      },
    },
    legend: { data: ['应收金额', '实收金额', '逾期率'], bottom: 0, textStyle: { fontSize: 11 } },
    grid: { top: 15, right: 55, bottom: 35, left: 50 },
    xAxis: { type: 'category', data: months, axisLabel: { fontSize: 10 } },
    yAxis: [
      { type: 'value', name: '万元', nameTextStyle: { fontSize: 10 }, axisLabel: { fontSize: 10 } },
      { type: 'value', name: '%', nameTextStyle: { fontSize: 10 }, axisLabel: { fontSize: 10 }, max: 100 },
    ],
    series: [
      { name: '应收金额', type: 'bar', data: data.map((t: any) => +(t.due / 10000).toFixed(1)), itemStyle: { color: '#a0c4ff', borderRadius: [3,3,0,0] }, barMaxWidth: 24 },
      { name: '实收金额', type: 'line', smooth: true, data: data.map((t: any) => +(t.collected / 10000).toFixed(1)), lineStyle: { color: '#00B894', width: 2 }, itemStyle: { color: '#00B894' }, symbol: 'circle', symbolSize: 6 },
      { name: '逾期率', type: 'line', smooth: true, yAxisIndex: 1, data: data.map((t: any) => t.rate || 0), lineStyle: { color: '#e74c3c', width: 1.5, type: 'dashed' }, itemStyle: { color: '#e74c3c' }, symbol: 'diamond', symbolSize: 6 },
    ],
  };
});

const nowStr = ref('');
const startTime = Date.now();
const uptime = ref('');
let timer: any;

onMounted(async () => {
  await loadDashboardData();

  try {
    const ec = await request.get('/contracts/expiry-calendar');
    const now = Date.now();
    expiringContracts.value = (ec.data?.list || []).map((c: any) => ({
      ...c, daysLeft: Math.ceil((new Date(c.endDate).getTime() - now) / 86400000),
    }));
  } catch (e: any) {
    console.error('[首页] 到期合同加载失败:', e?.message || e);
  }

  timer = setInterval(() => {
    nowStr.value = new Date().toLocaleString('zh-CN');
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const h = Math.floor(elapsed / 3600), m = Math.floor((elapsed % 3600) / 60), s = elapsed % 60;
    uptime.value = `${h}时${m}分${s}秒`;
  }, 1000);
});

async function loadDashboardData() {
  try {
    const [rentRes, overviewRes] = await Promise.all([
      request.get('/dashboard/rent', { params: { trendMonths: 36 } }),
      request.get('/dashboard/overview'),
    ]);
    const d = rentRes.data;
    const o = overviewRes.data;

    const trend = d.trend || [];
    let dueTrend = 0, collectedTrend = 0;
    if (trend.length >= 2) {
      const t = trend[trend.length - 1], l = trend[trend.length - 2];
      dueTrend = l.due > 0 ? Math.round(((t.due - l.due) / l.due) * 100) : 0;
      collectedTrend = l.collected > 0 ? Math.round(((t.collected - l.collected) / l.collected) * 100) : 0;
    }
    const cr = d.collectionRate || 0;
    const occRate = o.totalProperties > 0 ? Math.round((o.activeContracts / o.totalProperties) * 100) : 0;

    kpis.value = [
      { label: '房源总数', value: String(o.totalProperties || 0), color: '#0A3D62', icon: '🏠', link: '/rent/properties', trend: 0, percent: occRate },
      { label: '在租合同', value: String(o.activeContracts || 0), color: '#00B894', icon: '👥', link: '/contract/list', trend: 0, percent: occRate },
      { label: '当月应收(万)', value: ((d.monthlyDue || 0) / 10000).toFixed(1), color: '#F6B93B', icon: '💰', link: '/rent/bills', trend: dueTrend, percent: cr },
      { label: '收缴率', value: cr + '%', color: '#FF6B35', icon: '📈', link: '/rent/dashboard', trend: collectedTrend, percent: cr },
    ];

    if (d.dunningStats) dunningStats.value = d.dunningStats.map((s: any, i: number) => ({
      ...s, count: s.count || 0, color: dunningStats.value[i]?.color || '#999',
    }));

    // 完整趋势数据（含逾期率，默认36月）
    const overdueTrend = d.overdueTrend || [];
    fullTrend.value = trend.map((t: any) => {
      const o = overdueTrend.find((ot: any) => ot.period === t.period);
      return { period: t.period, due: t.due, collected: t.collected, rate: o?.rate || 0 };
    });
  } catch (e: any) {
    console.error('[首页] 看板数据加载失败:', e?.message || e);
  }
}

onUnmounted(() => clearInterval(timer));

const quickLinks = [
  { label: '房源管理', path: '/rent/properties', icon: '🏠' },
  { label: '租客管理', path: '/rent/tenants', icon: '👥' },
  { label: '收租管理', path: '/rent/bills', icon: '💰' },
  { label: '智能催缴', path: '/rent/dunning', icon: '🔔' },
  { label: '合同管理', path: '/contract/list', icon: '📝' },
  { label: '报表中心', path: '/finance/reports', icon: '📊' },
  { label: '收租看板', path: '/rent/dashboard', icon: '📈' },
  { label: '财务看板', path: '/finance/dashboard', icon: '💹' },
  { label: '合同审批', path: '/contract/approval', icon: '✅' },
];
</script>

<style lang="scss" scoped>
.page-title { font-size: 18px; font-weight: 700; color: #0A3D62; margin-bottom: 16px; }

.section-card { background: #fff; border-radius: 8px; padding: 16px 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
.section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
.section-title { font-size: 14px; font-weight: 600; color: #303133; }

// ---- KPI ----
.kpi-card {
  background: #fff; border-radius: 10px; padding: 20px 16px; text-align: center;
  cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  transition: transform 0.25s, box-shadow 0.25s;
  &:hover { transform: translateY(-4px); box-shadow: 0 8px 24px rgba(0,0,0,0.14); }
  &:active { transform: scale(0.98); }
}
.kpi-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.kpi-icon { width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 18px; color: #fff; }
.kpi-trend { font-size: 11px; font-weight: 600; padding: 1px 6px; border-radius: 10px; }
.kpi-trend.up { color: #00B894; background: #e6faf4; }
.kpi-trend.down { color: #e74c3c; background: #fde8e8; }
.kpi-trend.flat { color: #909399; background: #f5f7fa; }
.kpi-value { font-size: 28px; font-weight: 700; margin: 4px 0; }
.kpi-label { font-size: 12px; color: #7F8C8D; margin-bottom: 10px; }
.kpi-bar { height: 4px; background: #eee; border-radius: 2px; overflow: hidden; }
.kpi-bar-fill { display: block; height: 100%; border-radius: 2px; transition: width 0.8s ease; }

// ---- 快捷入口 ----
.quick-btn {
  width: 100%; height: 60px; display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 4px; cursor: pointer; border-radius: 10px; transition: all 0.3s ease;
  background: #f8f9fb; margin-bottom: 12px; user-select: none; font-size: 13px;
  &:hover { background: #e6f0ff; transform: translateY(-3px) scale(1.05); box-shadow: 0 6px 20px rgba(64,158,255,0.18); }
  &:active { transform: scale(0.97); }
}
.quick-icon { font-size: 24px; transition: transform 0.3s ease; }

// ---- 催缴 ----
.viz-list { display: flex; flex-direction: column; gap: 14px; }
.viz-item { display: flex; align-items: center; cursor: pointer; padding: 4px 0; border-radius: 6px; }
.viz-label { font-size: 12px; color: #606266; width: 70px; flex-shrink: 0; }
.viz-bar-wrap { flex: 1; height: 10px; background: #f0f0f0; border-radius: 5px; overflow: hidden; margin: 0 10px; }
.viz-bar-fill { display: block; height: 100%; border-radius: 5px; transition: width 0.6s ease; min-width: 2px; }
.viz-count { font-size: 15px; font-weight: 700; width: 30px; text-align: right; }

// ---- 到期合同 ----
.expiry-list { display: flex; flex-direction: column; gap: 8px; }
.expiry-item { display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; border-radius: 6px; cursor: pointer; transition: background 0.2s; background: #fafbfc;
  &:hover { background: #e6f0ff; } }
.expiry-no { font-size: 13px; color: #303133; font-weight: 500; }
.expiry-date { font-size: 12px; color: #909399; }

// ---- 系统信息 ----
.sys-info-card { margin-top: 16px; }
.sys-info-row { display: flex; align-items: center; flex-wrap: wrap; font-size: 12px; color: #909399; }
.sys-dot { width: 6px; height: 6px; border-radius: 50%; background: #00B894; display: inline-block; margin-right: 4px; }
.sys-sep { margin: 0 14px; color: #dcdfe6; }

// ---- 迷你趋势图 ----
.mini-trend { display: flex; align-items: flex-end; gap: 16px; height: 130px; padding: 0 8px; position: relative; }
.mini-trend-bar { display: flex; flex-direction: column; align-items: center; flex: 1; height: 100%; }
.bar-stack { flex: 1; width: 100%; max-width: 40px; display: flex; flex-direction: column; justify-content: flex-end; gap: 2px; border-radius: 4px 4px 0 0; overflow: hidden; background: #f5f7fa; }
.bar-due { background: #a0c4ff; border-radius: 2px 2px 0 0; transition: height 0.6s ease; min-height: 2px; }
.bar-collected { background: #00B894; border-radius: 2px 2px 0 0; transition: height 0.6s ease; min-height: 2px; }
.bar-label { font-size: 10px; color: #909399; margin-top: 4px; }
.trend-legend { position: absolute; top: 0; right: 8px; display: flex; gap: 12px; font-size: 11px; color: #606266; }
.legend-dot { display: inline-block; width: 8px; height: 8px; border-radius: 2px; margin-right: 4px; }
.due-dot { background: #a0c4ff; }
.collected-dot { background: #00B894; }
.chart-controls { display: flex; align-items: center; }
</style>
