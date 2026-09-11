<template>
  <div class="expiry-calendar">
    <h2 class="page-title">合同到期管理</h2>
    <el-row :gutter="12" style="margin-bottom:16px">
      <el-col :span="4"><el-card><el-statistic title="已到期未处理" :value="summary.expired" /></el-card></el-col>
      <el-col :span="4"><el-card><el-statistic title="7天内到期" :value="summary.expiring7" /></el-card></el-col>
      <el-col :span="4"><el-card><el-statistic title="30天内到期" :value="summary.expiring30" /></el-card></el-col>
      <el-col :span="4"><el-card><el-statistic title="90天内到期" :value="summary.expiring90" /></el-card></el-col>
      <el-col :span="4"><el-card><el-statistic title="180天内到期" :value="summary.expiring180" /></el-card></el-col>
      <el-col :span="4"><el-card><el-statistic title="365天内到期" :value="summary.expiring365" /></el-card></el-col>
    </el-row>
    <el-alert v-if="!wsConnected" title="实时连接已断开，数据可能不是最新" type="warning" :closable="false" show-icon style="margin-bottom:12px">
      <template #default><el-button size="small" @click="fetchAllData" :loading="loading">手动刷新</el-button></template>
    </el-alert>

    <el-card>
      <template #header><span>到期日历</span><el-select v-model="viewMonth" style="width:160px; margin-left:12px" @change="fetchMonthlyData"><el-option v-for="m in months" :key="m" :label="m" :value="m" /></el-select></template>
      <DataTable :data="tableData" :loading="loading" :columns="COLUMNS" row-key="id" empty-title="暂无数据" empty-description="调整筛选条件或新增记录后，数据会显示在这里">
        <template #c2="{ row }">{{ row.property?.name || '-' }}</template>
        <template #c3="{ row }">{{ row.tenant?.name || '-' }}</template>
        <template #c5="{ row }"><el-tag :type="tagByRemaining(row.endDate)" size="small">
                  {{ getRemaining(row.endDate) < 0 ? '已逾期' + Math.abs(getRemaining(row.endDate)) + '天' : getRemaining(row.endDate) + '天' }}
                </el-tag></template>
        <template #c6="{ row }">¥{{ Number(row.rentAmount || 0).toFixed(2) }}</template>
        <template #c7="{ row }"><el-tag size="small">{{ row.status }}</el-tag></template>
        <template #c8="{ row }"><el-button size="small" @click="$router.push(`/contract/detail/${row.id}`)">详情</el-button>
                  <el-button size="small" type="primary" @click="$router.push(`/contract/renewals`)">续约</el-button></template>
      </DataTable>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import DataTable from '@/components/base/DataTable.vue';
import type { TableColumn } from '@/components/base/types';

const COLUMNS: TableColumn[] = [
  { prop: 'contractNo', label: '合同编号', width: 150 },
  { label: '房源', width: 140, slot: 'c2' },
  { label: '租客', width: 100, slot: 'c3' },
  { prop: 'endDate', label: '到期日', width: 110 },
  { label: '剩余天数', width: 120, slot: 'c5' },
  { prop: 'rentAmount', label: '月租金', width: 120, slot: 'c6' },
  { prop: 'status', label: '状态', width: 100, slot: 'c7' },
  { label: '操作', width: 160, fixed: 'right', slot: 'c8' },
];

import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import request from '@/api/request';
import { useWebSocket } from '@/composables/useWebSocket';
import dayjs from 'dayjs';

const tableData = ref<any[]>([]); const loading = ref(false);
const allContracts = ref<any[]>([]);
const viewMonth = ref(dayjs().format('YYYY-MM'));
const wsConnected = ref(true);

const months = computed(() => {
  const now = dayjs(); const list: string[] = [];
  for (let i = 36; i > 0; i--) { list.push(now.subtract(i, 'month').format('YYYY-MM')); }
  for (let i = 0; i < 12; i++) { list.push(now.add(i, 'month').format('YYYY-MM')); }
  return list;
});

const summary = computed(() => {
  const today = dayjs();
  let expired = 0, expiring7 = 0, expiring30 = 0, expiring90 = 0, expiring180 = 0, expiring365 = 0;
  const source = allContracts.value.length > 0 ? allContracts.value : tableData.value;
  for (const c of source) {
    const remaining = dayjs(c.endDate).diff(today, 'day');
    if (remaining < 0) expired++;
    else if (remaining <= 7) { expiring7++; expiring30++; expiring90++; expiring180++; expiring365++; }
    else if (remaining <= 30) { expiring30++; expiring90++; expiring180++; expiring365++; }
    else if (remaining <= 90) { expiring90++; expiring180++; expiring365++; }
    else if (remaining <= 180) { expiring180++; expiring365++; }
    else if (remaining <= 365) expiring365++;
  }
  return { expired, expiring7, expiring30, expiring90, expiring180, expiring365 };
});

function getRemaining(endDate: string): number { return dayjs(endDate).diff(dayjs(), 'day'); }
function tagByRemaining(endDate: string) {
  const r = getRemaining(endDate);
  if (r < 0) return 'danger';
  if (r <= 7) return 'danger';
  if (r <= 30) return 'warning';
  if (r <= 90) return 'primary';
  if (r <= 180) return '';
  if (r <= 365) return 'success';
  return 'info';
}

async function fetchMonthlyData() {
  loading.value = true;
  try {
    const [year, month] = viewMonth.value.split('-');
    const startDate = `${year}-${month}-01`;
    const endDate = dayjs(startDate).endOf('month').format('YYYY-MM-DD');
    const res = await request.get('/contracts', { params: { endDateStart: startDate, endDateEnd: endDate, pageSize: 200 } });
    tableData.value = res.data?.list || [];
  } catch { /* ignore */ } finally { loading.value = false; }
}

async function fetchSummaryData() {
  try {
    const res = await request.get('/contracts', { params: { status: '执行中,到期提醒,已到期,已签订', pageSize: 500 } });
    allContracts.value = res.data?.list || [];
  } catch { /* ignore */ }
}

async function fetchAllData() {
  await Promise.all([fetchMonthlyData(), fetchSummaryData()]);
}

const { on: wsOn, isConnected } = useWebSocket();

watch(isConnected, (v) => { wsConnected.value = v; }, { immediate: true });

let unsubContractChanged: (() => void) | null = null;

onMounted(() => {
  fetchAllData();
  unsubContractChanged = wsOn('contract:status-changed', () => { fetchAllData(); });
  const unsubCreated = wsOn('contract:created', () => { fetchAllData(); });
  const unsubRenewed = wsOn('contract:renewed', () => { fetchAllData(); });
  const unsubDeleted = wsOn('contract:deleted', () => { fetchAllData(); });
  const orig = unsubContractChanged;
  unsubContractChanged = () => { orig?.(); unsubCreated?.(); unsubRenewed?.(); unsubDeleted?.(); };
});

onUnmounted(() => {
  unsubContractChanged?.();
});
</script>

<style lang="scss" scoped>
.page-title { font-size: 18px; font-weight: 700; color: $n-900; margin-bottom: 16px; }
</style>
