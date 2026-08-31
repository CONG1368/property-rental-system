<template>
  <div class="audit-log">
    <h2 class="page-title">审计日志</h2>

    <el-form :inline="true" class="filter-bar" @submit.prevent>
      <el-form-item label="模块">
        <el-input v-model="filters.module" placeholder="模块" clearable style="width: 130px" />
      </el-form-item>
      <el-form-item label="用户ID">
        <el-input v-model="filters.userId" placeholder="用户ID" clearable style="width: 130px" />
      </el-form-item>
      <el-form-item label="关键词">
        <el-input v-model="filters.keyword" placeholder="动作/对象/IP关键词" clearable style="width: 180px" />
      </el-form-item>
      <el-form-item label="状态">
        <el-select v-model="filters.status" placeholder="全部" clearable style="width: 110px">
          <el-option label="全部" value="" />
          <el-option label="成功" value="success" />
          <el-option label="失败" value="fail" />
        </el-select>
      </el-form-item>
      <el-form-item label="日期">
        <el-date-picker v-model="dateRange" type="daterange" value-format="YYYY-MM-DD" start-placeholder="开始日期" end-placeholder="结束日期" style="width: 240px" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="handleSearch">查询</el-button>
        <el-button @click="handleReset">重置</el-button>
        <el-button type="success" @click="exportData">导出</el-button>
      </el-form-item>
    </el-form>

    <el-table :data="logs" stripe v-loading="loading">
      <el-table-column prop="userId" label="用户ID" width="80" />
      <el-table-column prop="module" label="模块" width="100" />
      <el-table-column prop="action" label="操作" width="80" />
      <el-table-column label="结果" width="80">
        <template #default="{ row }">
          <el-tag :type="isFail(row) ? 'danger' : 'success'">{{ isFail(row) ? '失败' : '成功' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="targetType" label="对象类型" width="100" />
      <el-table-column prop="targetId" label="对象ID" width="80" />
      <el-table-column prop="ip" label="IP地址" width="130" />
      <el-table-column prop="createdAt" label="时间" width="170" />
    </el-table>
    <el-pagination v-model:current-page="page" :total="total" :page-size="pageSize" @current-change="fetchData" layout="total, prev, pager, next" style="margin-top:16px; justify-content:flex-end" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import request from '@/api/request';
import { ElMessage } from 'element-plus';
import { downloadWithAuth } from '@/utils/download';

const logs = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(50);
const loading = ref(false);

const filters = ref<{ module: string; userId: string; keyword: string; status: string }>({
  module: '',
  userId: '',
  keyword: '',
  status: '',
});
const dateRange = ref<string[] | null>(null);

// 判断操作结果：action 含"(失败)"标记即为失败
function isFail(row: any): boolean {
  return !!row.action && row.action.includes('(失败)');
}

// 收集当前筛选参数（不含分页），过滤空值
function commonFilters(): Record<string, string> {
  const f = filters.value;
  const p: Record<string, string> = {};
  if (f.module) p.module = f.module;
  if (f.userId) p.userId = f.userId;
  if (f.keyword) p.keyword = f.keyword;
  if (f.status) p.status = f.status;
  if (dateRange.value && dateRange.value[0]) p.startDate = dateRange.value[0];
  if (dateRange.value && dateRange.value[1]) p.endDate = dateRange.value[1];
  return p;
}

// 拼装查询字符串（用于导出 URL）
function buildQuery(): string {
  const p = commonFilters();
  return Object.keys(p)
    .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(p[k])}`)
    .join('&');
}

async function fetchData() {
  loading.value = true;
  try {
    const res = await request.get('/audit-logs', { params: { page: page.value, pageSize: pageSize.value, ...commonFilters() } });
    logs.value = res.data.list;
    total.value = res.data.total;
  } catch {} finally { loading.value = false; }
}

function handleSearch() {
  page.value = 1;
  fetchData();
}

function handleReset() {
  filters.value = { module: '', userId: '', keyword: '', status: '' };
  dateRange.value = null;
  page.value = 1;
  fetchData();
}

async function exportData() {
  try {
    await downloadWithAuth('/audit-logs/export', commonFilters(), 'audit_logs.csv');
    ElMessage.success('导出成功');
  } catch (err: any) {
    ElMessage.error(err?.message || '导出失败');
  }
}

onMounted(() => fetchData());
</script>

<style lang="scss" scoped>
.page-title { font-size: 18px; font-weight: 700; color: #0A3D62; margin-bottom: 16px; }
.filter-bar { margin-bottom: 12px; }
</style>
