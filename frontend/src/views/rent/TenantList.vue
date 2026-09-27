<template>
  <div class="tenant-list">
    <PageHeader title="租客管理" :breadcrumb="[{ label: '收租管理' }, { label: '租客管理' }]" />
    <FilterBar v-model:keyword="filters.keyword" :fields="FILTERS" v-model:values="filters" placeholder="搜索姓名/手机号" :keyword-width="200" @search="fetchData" @reset="onReset">
      <template #actions><el-button type="primary" @click="openDialog()">新增租客</el-button></template>
    </FilterBar>

    <DataTable :data="tableData" :loading="loading" :columns="COLUMNS" row-key="id" selectable :page="page" :total="total"
      :page-size="pageSize" empty-title="暂无租客" empty-description="新增租客后即可签订合同、生成账单"
      @selection-change="rows => selectedRows = rows" @row-click="onRowClick" @page-change="fetchData">
      <template #score="{ row }">
        <span class="mono">{{ row.creditScore ?? '-' }}</span>
        <StatusTag :value="row.creditGrade" :map="GRADE" style="margin-left:4px" />
      </template>
      <template #batch><el-button size="small" type="danger" @click="onBatchDelete(selectedRows)">批量删除</el-button></template>
      <template #ops="{ row }">
        <el-button size="small" @click.stop="openDialog(row)">编辑</el-button>
        <el-popconfirm title="确定删除该租客?" @confirm="handleDelete(row.id)">
          <template #reference><el-button size="small" type="danger" @click.stop>删除</el-button></template>
        </el-popconfirm>
      </template>
    </DataTable>

    <TenantFormDialog v-model="dialogVisible" :tenant="editing" @saved="fetchData" />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import request from '@/api/request';
import FilterBar from '@/components/base/FilterBar.vue';
import PageHeader from '@/components/base/PageHeader.vue';
import DataTable from '@/components/base/DataTable.vue';
import StatusTag from '@/components/base/StatusTag.vue';
import TenantFormDialog from '@/components/modules/rent/TenantFormDialog.vue';
import { useBatchDelete } from '@/composables/useBatchDelete';
import type { FilterField, TableColumn, StatusTagItem } from '@/components/base/types';

const STATUS_OPTIONS = ['待入住', '在租中', '已退租'];
const GRADE: Record<string, StatusTagItem> = { A: { type: 'success' }, B: { type: 'primary' }, C: { type: 'warning' }, D: { type: 'danger' } };
const TENANT_STATUS: Record<string, StatusTagItem> = { 在租中: { type: 'success' }, 待入住: { type: 'warning' }, 已退租: { type: 'info' } };
const FILTERS: FilterField[] = [
  { key: 'creditGrade', label: '信用等级', type: 'select', width: 120, options: ['A', 'B', 'C', 'D'].map(v => ({ label: v + '级', value: v })) },
  { key: 'status', label: '状态', type: 'select', width: 120, options: STATUS_OPTIONS.map(v => ({ label: v, value: v })) },
];
const COLUMNS: TableColumn[] = [
  { prop: 'name', label: '姓名', width: 100 }, { prop: 'idType', label: '证件类型', width: 100 },
  { prop: 'idNumber', label: '证件号', width: 180, tooltip: true }, { prop: 'phone', label: '手机号', width: 130 },
  { label: '信用评分', width: 130, slot: 'score' },
  { prop: 'status', label: '状态', width: 90, type: 'status', statusMap: TENANT_STATUS },
  { label: '操作', width: 200, fixed: 'right', slot: 'ops' },
];

const router = useRouter();
const filters = reactive<Record<string, any>>({ keyword: '', creditGrade: '', status: '' });
const tableData = ref<any[]>([]); const loading = ref(false);
const page = ref(1); const pageSize = ref(20); const total = ref(0);
const selectedRows = ref<any[]>([]);
const dialogVisible = ref(false); const editing = ref<any | null>(null);

const onBatchDelete = useBatchDelete({ noun: '租客', remove: r => request.delete('/tenants/' + r.id), label: r => r.name, onDone: fetchData });

function onReset() { page.value = 1; }
function openDialog(row?: any) { editing.value = row || null; dialogVisible.value = true; }
async function fetchData() {
  loading.value = true;
  try {
    const params: any = { page: page.value, pageSize: pageSize.value };
    if (filters.keyword) params.keyword = filters.keyword;
    if (filters.creditGrade) params.creditGrade = filters.creditGrade;
    if (filters.status) params.status = filters.status;
    const res = await request.get('/tenants', { params });
    tableData.value = res.data?.list || []; total.value = res.data?.total || 0;
  } catch { /* ignore */ } finally { loading.value = false; }
}
async function handleDelete(id: number) {
  try { await request.delete('/tenants/' + id); ElMessage.success('已删除'); fetchData(); }
  catch (err: any) { ElMessage.error('删除失败: ' + (err?.response?.data?.message || '未知错误')); }
}
function onRowClick(row: any, _col: any, event: Event) {
  const t = event.target as HTMLElement;
  if (t?.closest('.el-checkbox') || t?.closest('.el-button') || t?.closest('.el-popconfirm')) return;
  router.push('/rent/tenants/' + row.id);
}
onMounted(() => fetchData());
</script>

<style lang="scss" scoped>
.mono { font-variant-numeric: tabular-nums; }
:deep(.el-table__row) { cursor: pointer; }
</style>
