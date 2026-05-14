<template>
  <div class="budget-list">
    <div class="toolbar">
      <div class="search-group">
        <el-input v-model="searchYear" placeholder="预算年度" clearable style="width:140px" @keyup.enter="fetchData" />
        <el-button type="primary" @click="fetchData">查询</el-button>
      </div>
      <div class="action-group">
        <el-button type="primary" @click="$router.push('/finance/budgets/edit')">新增预算</el-button>
      </div>
    </div>

    <!-- 批量操作栏 -->
    <div class="batch-bar" v-if="selectedIds.length > 0">
      <span class="batch-info">已选 {{ selectedIds.length }} 项</span>
      <el-button size="small" type="danger" @click="batchDelete">批量删除</el-button>
      <el-button size="small" @click="clearSelection">取消选择</el-button>
    </div>

    <el-table :data="tableData" stripe v-loading="loading" @selection-change="(rows: any[]) => selectedRows = rows" ref="tableRef">
      <el-table-column type="selection" width="45" />
      <el-table-column label="账套" width="150">
        <template #default="{ row }">{{ row.book?.name || row.bookId }}</template>
      </el-table-column>
      <el-table-column label="会计科目" width="180">
        <template #default="{ row }">{{ row.account?.code }} {{ row.account?.name }}</template>
      </el-table-column>
      <el-table-column prop="year" label="年度" width="90" />
      <el-table-column label="预算金额" width="150"><template #default="{ row }">¥{{ Number(row.budgetAmount || 0).toFixed(2) }}</template></el-table-column>
      <el-table-column label="已用金额" width="150"><template #default="{ row }">¥{{ Number(row.actualAmount || 0).toFixed(2) }}</template></el-table-column>
      <el-table-column label="执行率" width="100"><template #default="{ row }">
        <el-progress :percentage="row.budgetAmount > 0 ? Math.min(100, Number((row.actualAmount / row.budgetAmount) * 100)) : 0" :status="row.actualAmount > row.budgetAmount ? 'exception' : undefined" />
      </template></el-table-column>
      <el-table-column label="状态" width="100">
        <template #default="{ row }"><el-tag :type="row.status === '已批准' ? 'success' : row.status === '待审核' ? 'warning' : 'info'" size="small">{{ row.status || '编制中' }}</el-tag></template>
      </el-table-column>
      <el-table-column label="操作" width="200" fixed="right">
        <template #default="{ row }">
          <el-button size="small" @click="$router.push(`/finance/budgets/edit/${row.id}`)">编辑</el-button>
          <el-popconfirm title="确定删除?" @confirm="handleDelete(row.id)"><template #reference><el-button size="small" type="danger">删除</el-button></template></el-popconfirm>
        </template>
      </el-table-column>
    </el-table>
    <el-pagination v-model:current-page="page" :total="total" :page-size="pageSize" @current-change="fetchData" layout="total, prev, pager, next" style="margin-top:16px; justify-content:flex-end" />
  </div>
</template>

<script setup lang="ts">
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
.toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 8px; }
.search-group { display: flex; gap: 8px; align-items: center; }
.action-group { display: flex; gap: 8px; }
.batch-bar { display: flex; gap: 10px; align-items: center; padding: 8px 16px; margin-bottom: 12px; background: #ecf5ff; border-radius: 6px; border: 1px solid #b3d8ff; }
.batch-info { font-size: 13px; color: #409eff; font-weight: 600; margin-right: 8px; }
</style>
