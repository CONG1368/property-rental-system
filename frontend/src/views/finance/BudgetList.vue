<template>
  <div class="budget-list">
    <FilterBar>
      <el-input v-model="searchYear" placeholder="预算年度" clearable style="width:140px" @keyup.enter="fetchData" />
      <el-button type="primary" @click="fetchData">查询</el-button>
      <template #actions>
        <el-button type="primary" @click="$router.push('/finance/budgets/edit')">新增预算</el-button>
      </template>
    </FilterBar>

    <!-- 批量操作栏 -->
    <div class="batch-bar" v-if="selectedIds.length > 0">
      <span class="batch-info">已选 {{ selectedIds.length }} 项</span>
      <el-button size="small" type="danger" @click="batchDelete">批量删除</el-button>
      <el-button size="small" @click="clearSelection">取消选择</el-button>
    </div>

    <DataTable :data="tableData" :loading="loading" :columns="COLUMNS" row-key="id" selectable @selection-change="(rows: any[]) => selectedRows = rows" v-model:page="page" :total="total" :page-size="pageSize" @page-change="fetchData" empty-title="暂无预算" empty-description="编制预算并提交审批后可跟踪执行进度">
      <template #c1="{ row }">{{ row.book?.name || row.bookId }}</template>
      <template #c2="{ row }">{{ row.account?.code }} {{ row.account?.name }}</template>
      <template #c4="{ row }">¥{{ Number(row.budgetAmount || 0).toFixed(2) }}</template>
      <template #c5="{ row }">¥{{ Number(row.actualAmount || 0).toFixed(2) }}</template>
      <template #c6="{ row }"><el-progress :percentage="row.budgetAmount > 0 ? Math.min(100, Number((row.actualAmount / row.budgetAmount) * 100)) : 0" :status="row.actualAmount > row.budgetAmount ? 'exception' : undefined" /></template>
      <template #c7="{ row }"><el-tag :type="row.status === '已批准' ? 'success' : row.status === '待审核' ? 'warning' : 'info'" size="small">{{ row.status || '编制中' }}</el-tag></template>
      <template #c8="{ row }"><el-button size="small" @click="$router.push(`/finance/budgets/edit/${row.id}`)">编辑</el-button>
              <el-popconfirm title="确定删除?" @confirm="handleDelete(row.id)"><template #reference><el-button size="small" type="danger">删除</el-button></template></el-popconfirm></template>
    </DataTable>
  </div>
</template>

<script setup lang="ts">
import FilterBar from '@/components/base/FilterBar.vue';
import DataTable from '@/components/base/DataTable.vue';
import type { TableColumn } from '@/components/base/types';

const COLUMNS: TableColumn[] = [
  { label: '账套', width: 150, slot: 'c1' },
  { label: '会计科目', width: 180, slot: 'c2' },
  { prop: 'year', label: '年度', width: 90 },
  { label: '预算金额', width: 150, slot: 'c4' },
  { label: '已用金额', width: 150, slot: 'c5' },
  { label: '执行率', width: 100, slot: 'c6' },
  { label: '状态', width: 100, slot: 'c7' },
  { label: '操作', width: 200, fixed: 'right', slot: 'c8' },
];

import { ref, computed, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import request from '@/api/request';

const tableData = ref<any[]>([]); const loading = ref(false);
const page = ref(1); const pageSize = ref(20); const total = ref(0);
const searchYear = ref('');
const tableRef = ref();
const selectedRows = ref<any[]>([]);
const selectedIds = computed(() => selectedRows.value.map(r => r.id));

async function fetchData() {
  loading.value = true;
  try {
    const params: any = { page: page.value, pageSize: pageSize.value };
    if (searchYear.value) params.year = searchYear.value;
    const res = await request.get('/budgets', { params });
    tableData.value = res.data?.list || [];
    total.value = res.data?.total || 0;
  } catch { /* ignore */ } finally { loading.value = false; }
}

async function handleDelete(id: number) { try { await request.delete(`/budgets/${id}`); ElMessage.success('已删除'); fetchData(); } catch (err: any) { ElMessage.error('删除失败: ' + (err?.response?.data?.message || '未知错误')); } }

function clearSelection() { tableRef.value?.clearSelection(); }

async function batchDelete() {
  const total = selectedIds.value.length;
  try { await ElMessageBox.confirm(`确定批量删除 ${total} 条预算? 此操作不可恢复!`, '批量删除', { type: 'warning' }); } catch { return; }
  let done = 0; const skipped: string[] = [];
  for (const row of selectedRows.value) {
    try { await request.delete(`/budgets/${row.id}`); done++; } catch { skipped.push(`ID${row.id}: 删除失败`); }
  }
  if (skipped.length > 0) {
    ElMessage.warning(`成功删除 ${done} 条，跳过 ${skipped.length} 条`);
  } else {
    ElMessage.success(`已删除 ${done} 条预算`);
  }
  clearSelection();
  fetchData();
}

onMounted(() => { fetchData(); });
</script>

<style lang="scss" scoped>
.budget-list { padding: 0; }
.batch-bar { display: flex; gap: 10px; align-items: center; padding: 8px 16px; margin-bottom: 12px; background: $brand-100; border-radius: 6px; border: 1px solid $brand-100; }
.batch-info { font-size: 13px; color: $brand-600; font-weight: 600; margin-right: 8px; }
</style>
