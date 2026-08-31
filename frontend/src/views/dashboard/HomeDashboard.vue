<template>
  <div class="home-dashboard">
    <h2 class="page-title">首页概览</h2>

    <!-- 数据加载中 -->
    <div v-if="dashboardLoading" style="text-align:center;padding:40px;color:#909399;">
      <div style="font-size:13px;margin-top:8px;">正在加载首页数据...</div>
    </div>

    <!-- KPI 卡片 -->
    <el-row v-show="!dashboardLoading" :gutter="16" class="kpi-row">
      <el-col :span="6" v-for="kpi in kpis" :key="kpi.label">
        <div class="kpi-card" @click="goPage(kpi.link)" :title="kpi.label + ' — 点击查看详情'">
          <div class="kpi-top">
            <span class="kpi-icon" :style="{ background: kpi.color }"><el-icon :size="18" color="#fff"><component :is="iconMap[kpi.icon]" /></el-icon></span>
            <span class="kpi-trend" :class="kpi.trend > 0 ? 'up' : kpi.trend < 0 ? 'down' : 'flat'" :style="{ color: kpi.trendColor, background: kpi.trend > 0 ? '#e6faf4' : kpi.trend < 0 ? '#fde8e8' : '#f5f7fa' }" v-if="kpi.trend !== 0">
              {{ kpi.trend > 0 ? '↑' : '↓' }} {{ Math.abs(kpi.trend) }}%
            </span>
          </div>
          <div class="kpi-value" :style="{ color: kpi.color }">{{ kpi.value }}</div>
          <div class="kpi-label">{{ kpi.label }}</div>
          <div class="kpi-bar"><span class="kpi-bar-fill" :style="{ width: kpi.percent + '%', background: kpi.barColor }"></span></div>
        </div>
      </el-col>
    </el-row>

    <!-- 今日待办（P1 作战台核心） -->
    <div class="section-card" v-show="!dashboardLoading" style="margin-top:16px">
      <div class="section-header">
        <span class="section-title">今日待办</span>
        <div style="display:flex;align-items:center;gap:8px">
          <el-tag v-if="todoTotal > 0" type="danger" effect="plain">{{ todoTotal }} 项</el-tag>
          <span style="font-size:12px;color:#909399" v-else><el-icon :size="13" color="#10b981" style="vertical-align:-2px;margin-right:4px"><CircleCheck /></el-icon>今日无待办，一切正常</span>
        </div>
      </div>
      <div v-if="todoList.length > 0">
        <el-row :gutter="12">
          <el-col :span="8" v-for="todo in todoList" :key="todo.key" style="margin-bottom:12px">
            <div class="todo-item" @click="goPage(todo.link)" :title="todo.title + ' — 点击处理'">
              <span class="todo-icon" :style="{ background: todoTypeColor[todo.type] || '#909399' }"><el-icon :size="18" color="#fff"><component :is="iconMap[todoSeverityMap[todo.severity]?.icon || 'list']" /></el-icon></span>
              <div class="todo-body">
                <div class="todo-title">{{ todo.title }} <el-tag :type="todoSeverityMap[todo.severity]?.tagType || 'info'" size="small" effect="light">{{ todoSeverityMap[todo.severity]?.label || todo.severity }}</el-tag></div>
                <div class="todo-sub">{{ todo.type }} · {{ todo.count }} 项待处理</div>
              </div>
              <span class="todo-count" :style="{ color: todoTypeColor[todo.type] }">{{ todo.count }}</span>
            </div>
          </el-col>
        </el-row>
      </div>
      <div v-else class="empty-state">
        <el-icon :size="30" color="#c6d6fd"><CircleCheck /></el-icon>
        <div class="empty-title">今日无待办</div>
        <div class="empty-sub">有逾期账单、待审批或消防隐患时会在此提醒</div>
      </div>
    </div>

    <!-- 推荐报表（按角色） -->
    <el-row :gutter="16" v-show="!dashboardLoading" style="margin-top:16px">
      <el-col :span="24">
        <div class="section-card">
          <div class="section-header">
            <span class="section-title">推荐报表</span>
            <el-button type="primary" link size="small" @click="goPage('/finance/reports')">前往报表中心 →</el-button>
          </div>
          <el-row :gutter="12">
            <el-col :span="6" v-for="rp in recommendedReports" :key="rp.key">
              <div class="quick-btn" @click="goPage('/finance/reports?report=' + rp.key)" :title="rp.desc">
                <span class="quick-icon"><el-icon :size="20"><component :is="iconMap['chart']" /></el-icon></span><span>{{ rp.title }}</span>
              </div>
            </el-col>
          </el-row>
        </div>
      </el-col>
    </el-row>

    <!-- 多周期收入趋势曲线图 -->
    <div class="section-card" style="margin-top:16px">
      <div class="section-header">
        <span class="section-title">收入趋势分析</span>
        <div class="chart-controls">
          <el-switch v-model="showCumulative" active-text="累计" size="small" style="margin-right:12px" />
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
                <span class="quick-icon"><el-icon :size="24"><component :is="iconMap[link.icon]" /></el-icon></span>
                <span>{{ link.label }}</span>
              </div>
            </el-col>
          </el-row>
        </div>
      </el-col>

      <!-- 催缴 + 到期 + 逾期预警 -->
      <el-col :span="10">
        <div class="section-card" style="margin-bottom:16px">
          <div class="section-header">
            <span class="section-title">逾期账单预警</span>
            <el-button v-if="overdueCount > 0" type="danger" text size="small">{{ overdueCount }} 笔</el-button>
            <el-button type="primary" link size="small" @click="goPage('/rent/dunning')">查看详情 →</el-button>
          </div>
          <div class="expiry-list" v-if="overdueBills.length > 0">
            <div class="expiry-item" v-for="ob in overdueBills.slice(0, 4)" :key="ob.id" @click="goPage('/rent/dunning')" :title="ob.billNo + ' — ' + ob.dueDate">
              <span class="expiry-no">{{ ob.billNo }}</span>
              <span class="expiry-date">{{ ob.dueDate }}</span>
              <span class="overdue-amt">¥{{ Number(ob.totalAmount).toLocaleString() }}</span>
            </div>
          </div>
          <div v-else style="text-align:center;color:#c0c4cc;font-size:13px;padding:16px 0">暂无逾期账单</div>
        </div>

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

    <!-- P2 多模块看板：房态分布 / 物业运营 / 消防 -->
    <div class="section-card" style="margin-top:16px" v-show="!dashboardLoading">
      <div class="section-header">
        <span class="section-title">多模块看板</span>
        <el-radio-group v-model="opsTab" size="small">
          <el-radio-button v-for="t in opsTabList" :key="t.key" :value="t.key">{{ t.label }}</el-radio-button>
        </el-radio-group>
      </div>

      <!-- 房态分布 -->
      <div v-if="opsTab === 'room'">
        <el-row :gutter="16">
          <el-col :span="10">
            <div style="text-align:center">
              <div style="font-size:34px;font-weight:700;color:#1f2430">{{ roomStats.occupancyRate }}%</div>
              <div style="font-size:12px;color:#909399;margin-top:2px">总房源 {{ roomStats.total }} 间 · 入住率</div>
            </div>
            <div class="room-legend" style="margin-top:12px">
              <div class="room-legend-item" v-for="s in roomStatusList.filter(x => x.count > 0)" :key="s.name">
                <span class="room-dot" :style="{ background: roomStatusColorMap[s.name] || '#909399' }"></span>
                <span class="room-name">{{ s.name }}</span>
                <div class="room-bar-wrap"><span class="room-bar-fill" :style="{ width: (s.count / roomMax * 100) + '%', background: roomStatusColorMap[s.name] }"></span></div>
                <span class="room-count">{{ s.count }}</span>
              </div>
            </div>
          </el-col>
          <el-col :span="14">
            <v-chart :option="roomChartOption" style="height:260px" autoresize />
          </el-col>
        </el-row>
      </div>

      <!-- 物业运营 -->
      <div v-if="opsTab === 'prop'">
        <el-row :gutter="16">
          <el-col :span="14">
            <v-chart :option="propTrendChartOption" style="height:240px" autoresize />
          </el-col>
          <el-col :span="10">
            <div class="ops-kpi-row">
              <div class="ops-kpi"><div class="ops-kpi-val">{{ propOps.prediction?.curCollectionRate ?? 0 }}%</div><div class="ops-kpi-label">本月收缴率</div></div>
              <div class="ops-kpi"><div class="ops-kpi-val">{{ propOps.prediction?.forecastNextWork ?? 0 }}</div><div class="ops-kpi-label">下月工单预测</div></div>
              <div class="ops-kpi"><div class="ops-kpi-val">¥{{ Number(propOps.prediction?.meterUnbilled ?? 0).toLocaleString() }}</div><div class="ops-kpi-label">未生成抄表</div></div>
              <div class="ops-kpi"><div class="ops-kpi-val">¥{{ Number(propOps.prediction?.parkingRevenue ?? 0).toLocaleString() }}</div><div class="ops-kpi-label">停车累计收入</div></div>
            </div>
            <div class="structure-list" style="margin-top:14px">
              <div class="structure-item" v-for="s in (propOps.structure?.workByType || [])" :key="s.name">
                <span class="structure-name">{{ s.name }}</span>
                <div class="viz-bar-wrap"><span class="viz-bar-fill" :style="{ width: (s.value / (Math.max(1, ...(propOps.structure?.workByType || []).map((x: any) => x.value))) * 100) + '%', background: '#5B7FFF' }"></span></div>
                <span class="structure-val">{{ s.value }}</span>
              </div>
            </div>
          </el-col>
        </el-row>
      </div>

      <!-- 消防安全 -->
      <div v-if="opsTab === 'fire'">
        <el-row :gutter="16">
          <el-col :span="10">
            <div class="ops-kpi-row">
              <div class="ops-kpi"><div class="ops-kpi-val" style="color:#4f7cf7">{{ fireDash.totalEquipment }}</div><div class="ops-kpi-label">器材总数</div></div>
              <div class="ops-kpi"><div class="ops-kpi-val" style="color:#fa8c16">{{ fireDash.expiringEquipment }}</div><div class="ops-kpi-label">过期/到期</div></div>
              <div class="ops-kpi"><div class="ops-kpi-val" style="color:#e74c3c">{{ fireDash.pendingViolations }}</div><div class="ops-kpi-label">隐患待整改</div></div>
              <div class="ops-kpi"><div class="ops-kpi-val" style="color:#1677ff">{{ fireDash.monthInspections }}</div><div class="ops-kpi-label">本月检查</div></div>
            </div>
            <el-button type="primary" link size="small" style="margin-top:12px" @click="goPage('/fire/list')">前往消防管理 →</el-button>
          </el-col>
          <el-col :span="14">
            <v-chart :option="fireEquipChartOption" style="height:240px" autoresize />
          </el-col>
        </el-row>
      </div>
    </div>

    <!-- 系统信息 -->
    <div class="section-card sys-info-card">
      <div class="sys-info-row">
        <span class="sys-item"><span class="sys-dot"></span> 版本 v{{ systemVersion || '--' }}</span>
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
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import VChart from 'vue-echarts';
import 'echarts';
import type { Component } from 'vue';
import { OfficeBuilding, User, Money, TrendCharts, Bell, Document, DataAnalysis, Checked, Warning, Coin, CircleCheck, Tickets } from '@element-plus/icons-vue';
// 语义键 → 图标组件映射（ANTI-EMOJI：UI 统一用 Element Plus 线性图标，禁用 emoji）
const iconMap: Record<string, Component> = {
  home: OfficeBuilding, users: User, money: Money, trend: TrendCharts,
  bell: Bell, doc: Document, chart: DataAnalysis, coin: Coin, check: Checked,
  alert: Warning, warn: Bell, list: Tickets,
};
import request from '@/api/request';
import { useWebSocket } from '@/composables/useWebSocket';

const router = useRouter();
const recommendedReports = ref<any[]>([]);
function resolveRole(): string {
  const raw = localStorage.getItem('accessToken') || '';
  try { const p = raw.split('.')[1]; const b64 = p.replace(/-/g, '+').replace(/_/g, '/'); const bin = atob(b64); const bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i); const pl = JSON.parse(new TextDecoder('utf-8').decode(bytes)); return pl.role || ''; } catch { return ''; }
}
// 角色 → 可访问模块（与路由守卫 routeRoleMap 一致），用于首页待办权限隔离
const roleModuleMap: Record<string, string[]> = {
  '管理员': ['rent', 'property', 'finance', 'contract', 'fire', 'system'],
  '总经理': ['rent', 'property', 'finance', 'contract', 'fire'],
  '收租主管': ['rent'],
  '收租员': ['rent'],
  '合同主管': ['contract'],
  '法务': ['contract'],
  '财务主管': ['finance'],
  '会计': ['finance'],
  '出纳': ['finance'],
  '物业经理': ['property'],
  '维修工': ['property'],
  '安全主管': ['fire'],
};
const roleModules = computed(() => roleModuleMap[resolveRole()] || []);
// P2 多模块看板 tab 门控：仅渲染当前角色可访问的模块 tab（与路由守卫一致）
const opsTabList = computed(() => {
  const list = [
    { key: 'room', label: '房态分布', module: 'rent' },
    { key: 'prop', label: '物业运营', module: 'property' },
    { key: 'fire', label: '消防安全', module: 'fire' },
  ];
  return list.filter((t) => roleModules.value.includes(t.module));
});
// 缺省 tab：落到首个有权限的模块；opsTab 在挂载时由 opsTabList 决定
const opsTab = ref('room');
function resolveOpsTab() {
  const first = opsTabList.value[0];
  if (first) opsTab.value = first.key;
}
async function loadRecommended() {
  try { const r = await request.get('/reports/registry', { silent: true }); const list = r.data?.list || []; const role = resolveRole(); recommendedReports.value = list.filter((x: any) => x.recommended?.includes(role)).slice(0, 4); } catch { /* 静默 */ }
}
function goPage(path: string) {
  if (!path) return;
  router.push(path).catch(() => {});
}

// ---- KPI ----
const dashboardLoading = ref(true);
const kpis = ref<any[]>([
  { label: '房源总数', value: '--', color: '#4f7cf7', icon: 'home', link: '/rent/properties', trend: 0, percent: 0, barColor: '#4f7cf7', trendColor: '#909399' },
  { label: '在租合同', value: '--', color: '#38bdf8', icon: 'users', link: '/contract/list', trend: 0, percent: 0, barColor: '#38bdf8', trendColor: '#909399' },
  { label: '当月应收(万)', value: '--', color: '#60a5fa', icon: 'money', link: '/rent/bills', trend: 0, percent: 0, barColor: '#60a5fa', trendColor: '#909399' },
  { label: '收缴率', value: '--', color: '#3b82f6', icon: 'trend', link: '/rent/dashboard', trend: 0, percent: 0, barColor: '#3b82f6', trendColor: '#909399' },
]);

const dunningStats = ref([
  { level: '到期提醒', count: 0, color: '#3498db' },
  { level: '一级催缴', count: 0, color: '#f39c12' },
  { level: '二级催缴', count: 0, color: '#e67e22' },
  { level: '三级催缴', count: 0, color: '#e74c3c' },
]);
const maxDunning = computed(() => Math.max(1, ...dunningStats.value.map(d => d.count)));
const todoSeverityMap: Record<string, { label: string; tagType: string; icon: string }> = {
  high: { label: '紧急', tagType: 'danger', icon: 'alert' },
  mid: { label: '关注', tagType: 'warning', icon: 'warn' },
  low: { label: '一般', tagType: 'info', icon: 'list' },
};
const todoTypeColor: Record<string, string> = { '财务': '#eb2f96', '合同': '#1677ff', '物业': '#4f7cf7', '消防': '#fa8c16' };

// ---- P2 看板 computed ----
const roomStatusList = computed(() => Object.entries(roomStats.value.statusCounts || {}).map(([name, count]) => ({ name, count: Number(count) })));
const roomMax = computed(() => Math.max(1, ...roomStatusList.value.map(s => s.count)));
const roomChartOption = computed(() => ({
  tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
  legend: { bottom: 0, textStyle: { fontSize: 10 } },
  series: [{ type: 'pie', radius: ['40%', '68%'], center: ['50%', '44%'], data: roomStatusList.value.filter(s => s.count > 0).map(s => ({ name: s.name, value: s.count, itemStyle: { color: roomStatusColorMap[s.name] || '#909399' } })), label: { fontSize: 11 }, emphasis: { itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0,0,0,0.3)' } } }],
}));
const propTrendChartOption = computed(() => {
  const t = propOps.value.trends || {};
  const months = (t.collectedTrend || []).map((x: any) => x.month.slice(5) + '月');
  return {
    tooltip: { trigger: 'axis' },
    legend: { bottom: 0, textStyle: { fontSize: 10 } },
    grid: { top: 12, right: 20, bottom: 30, left: 45 },
    xAxis: { type: 'category', data: months, axisLabel: { fontSize: 10 } },
    yAxis: { type: 'value', name: '元', nameTextStyle: { fontSize: 10 }, axisLabel: { fontSize: 10 } },
    series: [
      { name: '实收', type: 'line', smooth: true, data: (t.collectedTrend || []).map((x: any) => x.paid), lineStyle: { color: '#4f7cf7', width: 2 }, itemStyle: { color: '#4f7cf7' }, symbol: 'circle', symbolSize: 5 },
      { name: '应收', type: 'line', smooth: true, data: (t.collectedTrend || []).map((x: any) => x.total), lineStyle: { color: '#a0c4ff', width: 1.5 }, itemStyle: { color: '#a0c4ff' }, symbol: 'circle', symbolSize: 5 },
    ],
  };
});
const fireEquipChartOption = computed(() => {
  const byStatus = fireDash.value.equipmentByStatus || [];
  const total = fireDash.value.totalEquipment || 0;
  return {
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: { bottom: 0, textStyle: { fontSize: 10 } },
    series: [{ type: 'pie', radius: ['40%', '68%'], center: ['50%', '44%'], data: byStatus.map((s: any) => ({ name: s.status, value: Number(s.count) })), label: { fontSize: 11 } }],
  };
});

const expiringContracts = ref<any[]>([]);
const overdueBills = ref<any[]>([]);
const overdueCount = ref(0);
const systemVersion = ref('');
const uptimeSeconds = ref(0);

// ---- P1 今日待办 ----
const todoList = ref<any[]>([]);
const todoTotal = ref(0);

// ---- P2 多模块看板 ----
const roomStats = ref<any>({ total: 0, statusCounts: {}, occupancyRate: 0, buildingStats: [] });
const propOps = ref<any>({ trends: { workOrderTrend: [], complaintTrend: [], collectedTrend: [] }, structure: { workByType: [], facByStatus: [], compByType: [], revByType: [] }, prediction: {} });
const fireDash = ref<any>({ totalEquipment: 0, expiringEquipment: 0, pendingViolations: 0, monthInspections: 0, equipmentByStatus: [], inspectionByResult: [], violationBySeverity: [], expiringList: [], pendingList: [] });
const roomStatusColorMap: Record<string, string> = { '空置': '#909399', '已锁定': '#a0c4ff', '已预订': '#ffd04b', '已出租': '#4f7cf7', '退租中': '#f59e0b', '待保洁': '#b8a9ff', '待验收': '#f39c12', '维修中': '#e67e22', '已冻结': '#95a5a6' };

// ---- 曲线趋势图 ----
const fullTrend = ref<any[]>([]);
const chartPeriod = ref(6);
const showCumulative = ref(false); // 累计曲线开关
const chartOption = computed(() => {
  const data = fullTrend.value.slice(-chartPeriod.value);
  const months = data.map((t: any) => t.period.slice(5) + '月');
  // 累计：逐月累加应收/实收
  let dueAcc = 0, colAcc = 0;
  const dueCum = data.map((t: any) => +((dueAcc += t.due) / 10000).toFixed(1));
  const colCum = data.map((t: any) => +((colAcc += t.collected) / 10000).toFixed(1));
  const series: any[] = [
    { name: '应收金额', type: 'bar', data: data.map((t: any) => +(t.due / 10000).toFixed(1)), itemStyle: { color: '#a0c4ff', borderRadius: [3,3,0,0] }, barMaxWidth: 24 },
    { name: '实收金额', type: 'line', smooth: true, data: data.map((t: any) => +(t.collected / 10000).toFixed(1)), lineStyle: { color: '#4f7cf7', width: 2 }, itemStyle: { color: '#4f7cf7' }, symbol: 'circle', symbolSize: 6 },
    { name: '逾期率', type: 'line', smooth: true, yAxisIndex: 1, data: data.map((t: any) => t.rate || 0), lineStyle: { color: '#e74c3c', width: 1.5, type: 'dashed' }, itemStyle: { color: '#e74c3c' }, symbol: 'diamond', symbolSize: 6 },
  ];
  if (showCumulative.value) {
    series.push(
      { name: '累计应收', type: 'line', smooth: true, data: dueCum, lineStyle: { color: '#5B7FFF', width: 1.5, type: 'dotted' }, itemStyle: { color: '#5B7FFF' }, symbol: 'circle', symbolSize: 4 },
      { name: '累计实收', type: 'line', smooth: true, data: colCum, lineStyle: { color: '#1abc9c', width: 1.5, type: 'dotted' }, itemStyle: { color: '#1abc9c' }, symbol: 'circle', symbolSize: 4 },
    );
  }
  return {
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        let s = params[0].axisValue + '<br/>';
        params.forEach((p: any) => {
          const unit = p.seriesName === '逾期率' ? '%' : '万';
          s += '<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:' + p.color + ';margin-right:6px"></span>' + p.seriesName + ': ' + p.value + unit + '<br/>';
        });
        return s;
      },
    },
    legend: { data: series.map((s: any) => s.name), bottom: 0, textStyle: { fontSize: 11 } },
    grid: { top: 15, right: 55, bottom: 35, left: 50 },
    xAxis: { type: 'category', data: months, axisLabel: { fontSize: 10 } },
    yAxis: [
      { type: 'value', name: '万元', nameTextStyle: { fontSize: 10 }, axisLabel: { fontSize: 10 } },
      { type: 'value', name: '%', nameTextStyle: { fontSize: 10 }, axisLabel: { fontSize: 10 }, max: 100 },
    ],
    series,
  };
});

const nowStr = ref('');
const startTime = Date.now();
const uptime = ref('');
let timer: any;
let refreshTimer: any;
let wsUnsubs: (() => void)[] = [];

// 格式化时长（基于后端进程 uptime 为基准 + 页面停留时长）
function fmtUptime(seconds: number) {
  const h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60), s = seconds % 60;
  return h > 0 ? h + '时' + m + '分' + s + '秒' : m + '分' + s + '秒';
}

function startClock() {
  timer = setInterval(() => {
    nowStr.value = new Date().toLocaleString('zh-CN');
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    uptime.value = fmtUptime((uptimeSeconds.value || 0) + elapsed);
  }, 1000);
}

// ---- P2 看板按 tab 懒加载 ----
const loadedOpsKeys = ref<string[]>([]);
const opsLoading = ref(false);
async function loadOpsTab(tabKey: string) {
  if (!tabKey || loadedOpsKeys.value.includes(tabKey)) return; // 已加载不重复拉
  opsLoading.value = true;
  try {
    const myModules = roleModules.value;
    if (tabKey === 'room' && myModules.includes('rent')) {
      const r = await request.get('/properties/rooms/stats', { silent: true } as any);
      roomStats.value = r.data || { total: 0, statusCounts: {}, occupancyRate: 0, buildingStats: [] };
    } else if (tabKey === 'prop' && myModules.includes('property')) {
      const r = await request.get('/property-analytics/dashboard', { silent: true } as any);
      propOps.value = r.data || { trends: {}, structure: {}, prediction: {} };
    } else if (tabKey === 'fire' && myModules.includes('fire')) {
      const r = await request.get('/fire-safety/dashboard', { silent: true } as any);
      fireDash.value = r.data || { totalEquipment: 0, expiringEquipment: 0, pendingViolations: 0, monthInspections: 0, equipmentByStatus: [], inspectionByResult: [], violationBySeverity: [], expiringList: [], pendingList: [] };
    }
    loadedOpsKeys.value = [...loadedOpsKeys.value, tabKey];
  } catch (e: any) {
    // 无权限接口 403 或有错误：静默保留默认空对象，不阻塞
    console.error('[首页] 看板 tab 数据加载失败:', tabKey, e?.message || e);
  } finally {
    opsLoading.value = false;
  }
}
// 切换 P2 tab 时懒加载
watch(opsTab, (tab) => { loadOpsTab(tab); });

let wsRefreshTimer: any;
function scheduleRefresh() {
  // 300ms 防抖：批量状态变更可能一次广播 N 条事件，合并为一次刷新
  if (wsRefreshTimer) clearTimeout(wsRefreshTimer);
  wsRefreshTimer = setTimeout(() => loadDashboardData(true), 300);
}

function startAutoRefresh() {
  // 60s 弱轮询兜底 + WebSocket 事件触发（静默刷新，不闪加载态）
  refreshTimer = setInterval(() => loadDashboardData(true), 60000);
  const { on } = useWebSocket();
  const events = ['room:status-changed', 'room:batch-status-changed', 'contract:created', 'contract:deleted', 'contract:renewed', 'contract:status-changed', 'dunning:new'];
  events.forEach((ev) => {
    wsUnsubs.push(on(ev, scheduleRefresh));
  });
}

onMounted(async () => {
  resolveOpsTab(); // 按角色落到首个有权限的看板 tab
  await loadDashboardData();
  loadRecommended();
  startClock();
  startAutoRefresh();
});

let dashboardRetried = false;

async function loadDashboardData(silent = false) {
  if (!silent) dashboardLoading.value = true;
  const myModules = roleModules.value;
  try {
    // 基础组：均为 authMiddleware 下所有登录角色可访问，用 Promise.all 并发
    const [rentRes, overviewRes, alertsRes, todoRes] = await Promise.all([
      request.get('/dashboard/rent', { params: { trendMonths: 36 }, silent: true } as any),
      request.get('/dashboard/overview', { silent: true } as any),
      request.get('/dashboard/alerts', { silent: true } as any),
      request.get('/dashboard/todo-summary', { silent: true } as any),
    ]);
    const d = rentRes.data;
    const o = overviewRes.data;
    const a = alertsRes.data || {};
    // P1 今日待办（字段已与后端实测核对，做空数组兜底）
    const t = todoRes.data || {};
    // 权限隔离：仅展示当前角色可访问模块的待办项（避免低权限角色看到高权限模块计数）
    const permitted = (t.list || []).filter((x: any) => !x.module || myModules.includes(x.module));
    todoList.value = permitted;
    todoTotal.value = permitted.reduce((s: number, x: any) => s + (x.count || 0), 0);
    // P2 看板数据按 tab 懒加载（见 loadOpsTab），此处不预拉，避免对无权限角色白跑 403
    const firstTab = opsTabList.value[0];
    if (firstTab) await loadOpsTab(firstTab.key);

    const trend = d.trend || [];
    let dueTrend = 0, collectedTrend = 0;
    if (trend.length >= 2) {
      const t = trend[trend.length - 1], l = trend[trend.length - 2];
      dueTrend = l.due > 0 ? Math.round(((t.due - l.due) / l.due) * 100) : 0;
      collectedTrend = l.collected > 0 ? Math.round(((t.collected - l.collected) / l.collected) * 100) : 0;
    }
    // 收缴率：金额口径（已缴金额/应收金额），比份数比更能反映资金回笼
    const cr = d.collectionRate || 0;
    const crAmount = o.monthlyDue > 0 ? parseFloat(((o.monthlyCollected / o.monthlyDue) * 100).toFixed(1)) : 0;
    const crVal = crAmount > 0 ? crAmount : cr;
    // 入住率：后端已按「已出租房源/总房源」口径算好（Property.status='已出租'）
    const occRate = o.occupancyRate != null ? o.occupancyRate : (o.totalProperties > 0 ? Math.round((o.activeContracts / o.totalProperties) * 100) : 0);
    // 在租合同占比：执行中合同 / 全部合同
    const rentRate = o.totalContracts > 0 ? Math.round((o.activeContracts / o.totalContracts) * 100) : 0;
    // 进度条颜色随数值方向（高=绿、中=黄/橙、低=红）
    const barColor = (v: number) => v >= 90 ? '#4f7cf7' : v >= 70 ? '#60a5fa' : v >= 50 ? '#38bdf8' : '#7ba0f9';
    const trendColor = (t: number) => t > 0 ? '#4f7cf7' : t < 0 ? '#ef4444' : '#909399';

    kpis.value = [
      { label: '房源总数', value: String(o.totalProperties || 0), color: '#4f7cf7', icon: 'home', link: '/rent/properties', trend: 0, percent: occRate, barColor: barColor(occRate), trendColor: trendColor(0) },
      { label: '在租合同', value: String(o.activeContracts || 0), color: '#38bdf8', icon: 'users', link: '/contract/list', trend: 0, percent: rentRate, barColor: barColor(rentRate), trendColor: trendColor(0) },
      { label: '当月应收(万)', value: ((d.monthlyDue || 0) / 10000).toFixed(1), color: '#60a5fa', icon: 'money', link: '/rent/bills', trend: dueTrend, percent: crVal, barColor: barColor(crVal), trendColor: trendColor(dueTrend) },
      { label: '收缴率', value: crVal + '%', color: '#3b82f6', icon: 'trend', link: '/rent/dashboard', trend: collectedTrend, percent: crVal, barColor: barColor(crVal), trendColor: trendColor(collectedTrend) },
    ];

    if (d.dunningStats) dunningStats.value = d.dunningStats.map((s: any, i: number) => ({
      ...s, count: s.count || 0, color: dunningStats.value[i]?.color || '#999',
    }));

    // 逾期账单预警 + 到期合同（统一复用 /dashboard/alerts，随刷新联动）
    overdueBills.value = a.overdueBills || [];
    overdueCount.value = a.overdueCount || 0;
    const nowTs = Date.now();
    expiringContracts.value = (a.expiringContracts || []).map((c: any) => ({
      ...c,
      daysLeft: Math.ceil((new Date(c.endDate).getTime() - nowTs) / 86400000),
    }));

    // 系统版本/运行时长（后端动态）
    systemVersion.value = o.version || '';
    uptimeSeconds.value = o.uptimeSeconds || 0;

    const overdueTrend = d.overdueTrend || [];
    fullTrend.value = trend.map((t: any) => {
      const o = overdueTrend.find((ot: any) => ot.period === t.period);
      return { period: t.period, due: t.due, collected: t.collected, rate: o?.rate || 0 };
    });
    dashboardRetried = false;
  } catch (e: any) {
    console.error('[首页] 看板数据加载失败:', e?.message || e);
    if (!dashboardRetried) {
      dashboardRetried = true;
      setTimeout(() => loadDashboardData(true), 2000);
      return;
    }
  } finally {
    dashboardLoading.value = false;
  }
}

onUnmounted(() => {
  clearInterval(timer);
  if (refreshTimer) clearInterval(refreshTimer);
  if (wsRefreshTimer) clearTimeout(wsRefreshTimer);
  wsUnsubs.forEach((u) => u());
  wsUnsubs = [];
});

const quickLinks = [
  { label: '房源管理', path: '/rent/properties', icon: 'home' },
  { label: '租客管理', path: '/rent/tenants', icon: 'users' },
  { label: '收租管理', path: '/rent/bills', icon: 'money' },
  { label: '智能催缴', path: '/rent/dunning', icon: 'bell' },
  { label: '合同管理', path: '/contract/list', icon: 'doc' },
  { label: '报表中心', path: '/finance/reports', icon: 'chart' },
  { label: '收租看板', path: '/rent/dashboard', icon: 'trend' },
  { label: '财务看板', path: '/finance/dashboard', icon: 'coin' },
  { label: '合同审批', path: '/contract/approval', icon: 'check' },
];
</script>

<style lang="scss" scoped>
.page-title { font-size: 18px; font-weight: 700; color: #1f2430; margin-bottom: 16px; }

.section-card { background: rgba(255,255,255,.62); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); border: 1px solid rgba(255,255,255,.72); box-shadow: 0 8px 32px rgba(31,41,55,.14), inset 0 1px 0 rgba(255,255,255,.55); border-radius: 20px; padding: 16px 20px; }
.section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
.section-title { font-size: 14px; font-weight: 600; color: #303133; }

// ---- KPI ----
.kpi-card {
  background: rgba(255,255,255,.62); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); border: 1px solid rgba(255,255,255,.72); box-shadow: 0 8px 32px rgba(31,41,55,.14), inset 0 1px 0 rgba(255,255,255,.55); border-radius: 20px; padding: 20px 16px; text-align: center;
  cursor: pointer;
  transition: transform 0.25s, box-shadow 0.25s;
  &:hover { transform: translateY(-4px); box-shadow: 0 14px 40px rgba(31,41,55,.18), inset 0 1px 0 rgba(255,255,255,.6); }
  &:active { transform: scale(0.98); }
}
.kpi-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.kpi-icon { width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 18px; color: #fff; }
.kpi-trend { font-size: 11px; font-weight: 600; padding: 1px 6px; border-radius: 10px; }
.kpi-trend.up { color: #4f7cf7; background: #ecf1fe; }
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
  background: rgba(255,255,255,.5); border: 1px solid rgba(255,255,255,.6); margin-bottom: 12px; user-select: none; font-size: 13px; color: #3a4354;
  &:hover { background: rgba(255,255,255,.82); transform: translateY(-3px); box-shadow: 0 8px 24px rgba(79,124,247,0.18); }
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
.expiry-item { display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; border-radius: 12px; cursor: pointer; transition: background 0.2s; background: rgba(255,255,255,.5);
  &:hover { background: rgba(255,255,255,.85); } }
.expiry-no { font-size: 13px; color: #303133; font-weight: 500; }
.expiry-date { font-size: 12px; color: #909399; }
.overdue-amt { font-size: 12px; color: #e74c3c; font-weight: 600; }

// ---- 系统信息 ----
.sys-info-card { margin-top: 16px; }
.sys-info-row { display: flex; align-items: center; flex-wrap: wrap; font-size: 12px; color: #909399; }
.sys-dot { width: 6px; height: 6px; border-radius: 50%; background: #4f7cf7; display: inline-block; margin-right: 4px; }
.sys-sep { margin: 0 14px; color: #dcdfe6; }

// ---- 迷你趋势图 ----
.mini-trend { display: flex; align-items: flex-end; gap: 16px; height: 130px; padding: 0 8px; position: relative; }
.mini-trend-bar { display: flex; flex-direction: column; align-items: center; flex: 1; height: 100%; }
.bar-stack { flex: 1; width: 100%; max-width: 40px; display: flex; flex-direction: column; justify-content: flex-end; gap: 2px; border-radius: 4px 4px 0 0; overflow: hidden; background: #f5f7fa; }
.bar-due { background: #a0c4ff; border-radius: 2px 2px 0 0; transition: height 0.6s ease; min-height: 2px; }
.bar-collected { background: #4f7cf7; border-radius: 2px 2px 0 0; transition: height 0.6s ease; min-height: 2px; }
.bar-label { font-size: 10px; color: #909399; margin-top: 4px; }
.trend-legend { position: absolute; top: 0; right: 8px; display: flex; gap: 12px; font-size: 11px; color: #606266; }
.legend-dot { display: inline-block; width: 8px; height: 8px; border-radius: 2px; margin-right: 4px; }
.due-dot { background: #a0c4ff; }
.collected-dot { background: #4f7cf7; }
.chart-controls { display: flex; align-items: center; }

// ---- 今日待办 ----
.todo-item { display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-radius: 14px; background: rgba(255,255,255,.5); border: 1px solid rgba(255,255,255,.6); cursor: pointer; transition: all 0.2s;
  &:hover { background: rgba(255,255,255,.85); transform: translateY(-2px); box-shadow: 0 6px 20px rgba(79,124,247,0.14); } }
.todo-icon { width: 34px; height: 34px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 18px; color: #fff; flex-shrink: 0; }
.todo-body { flex: 1; min-width: 0; }
.todo-title { font-size: 13px; font-weight: 600; color: #303133; display: flex; align-items: center; gap: 6px; }
.todo-sub { font-size: 12px; color: #909399; margin-top: 2px; }
.todo-count { font-size: 20px; font-weight: 700; flex-shrink: 0; }

// ---- 多模块看板 ----
.room-legend { display: flex; flex-direction: column; gap: 10px; }
.room-legend-item { display: flex; align-items: center; gap: 8px; }
.room-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.room-name { font-size: 12px; color: #606266; width: 46px; flex-shrink: 0; }
.room-bar-wrap { flex: 1; height: 8px; background: #f0f0f0; border-radius: 4px; overflow: hidden; }
.room-bar-fill { display: block; height: 100%; border-radius: 4px; transition: width 0.6s ease; min-width: 2px; }
.room-count { font-size: 13px; font-weight: 700; width: 28px; text-align: right; }
.ops-kpi-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.ops-kpi { background: rgba(255,255,255,.5); border: 1px solid rgba(255,255,255,.6); border-radius: 14px; padding: 12px 14px; text-align: center; }
.ops-kpi-val { font-size: 22px; font-weight: 700; color: #1f2430; }
.ops-kpi-label { font-size: 12px; color: #909399; margin-top: 4px; }
.structure-list { display: flex; flex-direction: column; gap: 10px; }
.structure-item { display: flex; align-items: center; gap: 8px; }
.structure-name { font-size: 12px; color: #606266; width: 70px; flex-shrink: 0; }
.structure-val { font-size: 13px; font-weight: 700; width: 30px; text-align: right; }

// ---- 空状态（准则 Rule 5：精美空态） ----
.empty-state { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 26px 0; }
.empty-title { font-size: 14px; font-weight: 600; color: #3a4354; }
.empty-sub { font-size: 12px; color: #8b93a3; }
</style>
