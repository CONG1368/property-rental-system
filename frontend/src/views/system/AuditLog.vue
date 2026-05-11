<template>
  <div class="audit-log">
    <h2 class="page-title">审计日志</h2>
    <el-table :data="logs" stripe v-loading="loading">
      <el-table-column prop="userId" label="用户ID" width="80" />
      <el-table-column prop="module" label="模块" width="100" />
      <el-table-column prop="action" label="操作" width="80" />
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

const logs = ref<any[]>([]); const total = ref(0); const page = ref(1); const pageSize = ref(50); const loading = ref(false);

async function fetchData() {
  loading.value = true;
  try { const res = await request.get('/audit-logs', { params: { page: page.value, pageSize: pageSize.value } }); logs.value = res.data.list; total.value = res.data.total; } catch {} finally { loading.value = false; }
}

onMounted(() => fetchData());
</script>

<style lang="scss" scoped>
.page-title { font-size: 18px; font-weight: 700; color: #0A3D62; margin-bottom: 16px; }
</style>
