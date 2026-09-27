<template>
  <div class="voucher-list">
    <PageHeader title="凭证管理" :breadcrumb="[{ label: '财务' }, { label: '凭证管理' }]" />

    <FilterBar :fields="FILTERS" v-model:values="filters" @search="fetchData" @reset="page = 1">
      <template #actions>
        <el-button type="primary" @click="$router.push('/finance/vouchers/edit')">新增凭证</el-button>
        <el-button type="warning" @click="autoVisible = true">自动生成凭证</el-button>
      </template>
    </FilterBar>

    <DataTable :data="tableData" :loading="loading" :columns="COLUMNS" row-key="id" :page="page" :total="total"
      :page-size="pageSize" empty-title="暂无凭证" empty-description="业务单据审核通过后自动生成凭证，也可手工录入" @page-change="fetchData">
      <template #type="{ row }"><el-tag size="small">{{ row.type }}</el-tag></template>
      <template #ops="{ row }">
        <el-button size="small" @click="$router.push('/finance/vouchers/edit/' + row.id)">编辑</el-button>
        <el-button v-if="row.status === '待审核'" size="small" type="success" @click="changeStatus(row, '已过账')">过账</el-button>
      </template>
    </DataTable>

    <VoucherAutoGenerate v-model="autoVisible" @done="fetchData" />
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import request from '@/api/request';
import { confirmWithPassword } from '@/utils/confirm-password';
import FilterBar from '@/components/base/FilterBar.vue';
import PageHeader from '@/components/base/PageHeader.vue';
import DataTable from '@/components/base/DataTable.vue';
import VoucherAutoGenerate from '@/components/modules/finance/VoucherAutoGenerate.vue';
import type { FilterField, TableColumn, StatusTagItem } from '@/components/base/types';

// 状态映射：收成一张表，取代散落的 :type 三元表达式
const VOUCHER_STATUS: Record<string, StatusTagItem> = { 草稿: { type: 'info' }, 待复核: { type: 'warning' }, 待审核: { type: 'warning' }, 已过账: { type: 'success' }, 已作废: { type: 'danger' } };
const FILTERS: FilterField[] = [
  { key: 'status', label: '状态', type: 'select', width: 120, options: ['草稿', '待复核', '待审核', '已过账'].map(v => ({ label: v, value: v })) },
  { key: 'type', label: '类型', type: 'select', width: 100, options: ['收', '付', '转'].map(v => ({ label: v, value: v })) },
  { key: 'period', label: '期间', type: 'text', width: 150, placeholder: '期间(YYYY-MM)' },
];
const COLUMNS: TableColumn[] = [
  { prop: 'voucherNo', label: '凭证号', width: 150, type: 'mono' }, { prop: 'date', label: '日期', width: 110, type: 'date' },
  { prop: 'period', label: '期间', width: 90, type: 'mono' }, { prop: 'type', label: '类型', width: 60, slot: 'type' },
  { prop: 'summary', label: '摘要', minWidth: 200, tooltip: true },
  { prop: 'status', label: '状态', width: 100, type: 'status', statusMap: VOUCHER_STATUS }, { label: '操作', width: 200, slot: 'ops' },
];

const filters = reactive<Record<string, any>>({ status: '', type: '', period: '' });
const tableData = ref<any[]>([]); const total = ref(0); const page = ref(1); const pageSize = ref(20); const loading = ref(false); const autoVisible = ref(false);

async function fetchData() {
  loading.value = true;
  try {
    const res = await request.get('/vouchers', { params: { page: page.value, pageSize: pageSize.value, status: filters.status || undefined, type: filters.type || undefined, period: filters.period || undefined } });
    tableData.value = res.data.list; total.value = res.data.total;
  } catch {} finally { loading.value = false; }
}
async function changeStatus(row: any, status: string) {
  let pwd: string | null = null;   // 作废等不可逆状态需二次确认密码
  if (status === '已作废') { pwd = await confirmWithPassword('确定将凭证置为「已作废」? 此操作不可恢复，请输入登录密码。', '作废二次确认'); if (!pwd) return; }
  try { await request.put('/vouchers/' + row.id + '/status', { status, ...(pwd ? { confirmPassword: pwd } : {}) }); ElMessage.success('状态已更新'); fetchData(); } catch {}
}
onMounted(() => fetchData());
</script>
