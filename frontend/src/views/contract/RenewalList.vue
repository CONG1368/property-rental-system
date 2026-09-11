<template>
  <div class="renewal-list">
    <div class="toolbar">
      <h2 class="page-title">续约管理</h2>
      <div class="search-group">
        <el-date-picker v-model="dateRange" type="daterange" range-separator="至" start-placeholder="开始日期" end-placeholder="结束日期" style="width:260px" @change="fetchData" />
        <el-button type="primary" @click="fetchData">查询</el-button>
      </div>
    </div>

    <DataTable :data="tableData" :loading="loading" :columns="COLUMNS" row-key="id" empty-title="暂无数据" empty-description="调整筛选条件或新增记录后，数据会显示在这里">
      <template #c2="{ row }">{{ row.property?.name || '-' }}</template>
      <template #c3="{ row }">{{ row.tenant?.name || '-' }}</template>
      <template #c5="{ row }"><el-tag :type="getRemaining(row.endDate) <= 0 ? 'danger' : getRemaining(row.endDate) <= 7 ? 'danger' : getRemaining(row.endDate) <= 30 ? 'warning' : getRemaining(row.endDate) <= 90 ? 'primary' : getRemaining(row.endDate) <= 180 ? '' : getRemaining(row.endDate) <= 365 ? 'success' : 'info'" size="small">{{ getRemaining(row.endDate) }}天</el-tag></template>
      <template #c6="{ row }">¥{{ Number(row.rentAmount || 0).toFixed(2) }}</template>
      <template #c7="{ row }"><el-tag size="small" :type="statusTagType(row.status)">{{ row.status }}</el-tag></template>
      <template #c8="{ row }"><el-button size="small" type="primary" @click="handleRenew(row)" :disabled="row.status === '起草中' || row.status === '审批中'">续约</el-button>
              <el-button size="small" @click="$router.push('/contract/detail/' + row.id)">详情</el-button></template>
    </DataTable>
    <el-empty v-if="!loading && tableData.length === 0" description="暂无待续约合同" />
    <el-pagination v-if="tableData.length > 0" v-model:current-page="page" :total="total" :page-size="pageSize" @current-change="fetchData" layout="total, prev, pager, next" style="margin-top:16px; justify-content:flex-end" />

    <el-dialog title="合同续约" v-model="renewDialogVisible" width="500px">
      <el-form :model="renewForm" label-width="100px">
        <el-form-item label="原合同编号"><span>{{ currentContract?.contractNo }}</span></el-form-item>
        <el-form-item label="原到期日"><span>{{ currentContract?.endDate }}</span></el-form-item>
        <el-form-item label="新到期日"><el-date-picker v-model="renewForm.newEndDate" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item>
        <el-form-item label="新月租金"><el-input-number v-model="renewForm.newRent" :min="0" :precision="2" style="width:100%" /></el-form-item>
        <el-form-item label="备注"><el-input v-model="renewForm.notes" type="textarea" :rows="2" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="renewDialogVisible = false">取消</el-button><el-button type="primary" @click="confirmRenew">确认续约</el-button></template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import DataTable from '@/components/base/DataTable.vue';
import type { TableColumn } from '@/components/base/types';

const COLUMNS: TableColumn[] = [
  { prop: 'contractNo', label: '合同编号', width: 180, tooltip: true },
  { label: '房源', width: 140, slot: 'c2' },
  { label: '租客', width: 100, slot: 'c3' },
  { prop: 'endDate', label: '到期日', width: 110 },
  { label: '剩余天数', width: 100, slot: 'c5' },
  { prop: 'rentAmount', label: '月租金', width: 120, slot: 'c6' },
  { prop: 'status', label: '状态', width: 100, slot: 'c7' },
  { label: '操作', width: 160, fixed: 'right', slot: 'c8' },
];

import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import request from '@/api/request';
import dayjs from 'dayjs';

const tableData = ref<any[]>([]); const loading = ref(false);
const page = ref(1); const pageSize = ref(20); const total = ref(0);
const dateRange = ref<[Date, Date] | null>(null);

const renewDialogVisible = ref(false);
const currentContract = ref<any>(null);
const renewForm = ref({ newEndDate: '', newRent: 0, notes: '' });

function getRemaining(endDate: string): number { return dayjs(endDate).diff(dayjs(), 'day'); }

function statusTagType(s: string) {
  const m: Record<string, string> = { '执行中': 'success', '审批中': 'warning', '已签订': 'primary', '已驳回': 'danger', '已到期': 'info', '已终止': 'info', '起草中': 'info' };
  return m[s] || 'info';
}

async function fetchData() {
  loading.value = true;
  try {
    const params: any = { page: page.value, pageSize: pageSize.value, status: '执行中,到期提醒,已到期' };
    if (dateRange.value) {
      params.endDateStart = dayjs(dateRange.value[0]).format('YYYY-MM-DD');
      params.endDateEnd = dayjs(dateRange.value[1]).format('YYYY-MM-DD');
    }
    const res = await request.get('/contracts', { params });
    const list = res.data?.list || [];
    // 按剩余天数升序排列（即将到期的在前）
    list.sort((a: any, b: any) => getRemaining(a.endDate) - getRemaining(b.endDate));
    tableData.value = list;
    total.value = res.data?.total || 0;
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || '加载续约列表失败');
  } finally { loading.value = false; }
}

function handleRenew(row: any) {
  currentContract.value = row;
  renewForm.value = { newEndDate: dayjs(row.endDate).add(1, 'year').format('YYYY-MM-DD'), newRent: Number(row.rentAmount || 0), notes: '' };
  renewDialogVisible.value = true;
}

async function confirmRenew() {
  try {
    await request.post('/contracts/' + currentContract.value.id + '/renew', renewForm.value);
    ElMessage.success('续约成功，新合同已创建'); renewDialogVisible.value = false; fetchData();
  } catch (e: any) { ElMessage.error(e?.response?.data?.message || '续约失败'); }
}

onMounted(() => { fetchData(); });
</script>

<style lang="scss" scoped>
.page-title { font-size: 18px; font-weight: 700; color: $n-900; margin: 0; flex: 1; }
.toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 8px; }
.search-group { display: flex; gap: 8px; align-items: center; }
</style>
