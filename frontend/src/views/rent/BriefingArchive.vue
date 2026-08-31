<template>
  <div class="archive-page">
    <div class="head-row">
      <h2 class="page-title">月度经营简报归档</h2>
      <div>
        <el-button type="warning" :loading="generating" @click="generate">立即生成本月简报</el-button>
      </div>
    </div>
    <el-alert type="info" :closable="false" style="margin-bottom:16px">系统每月 1 日上午自动生成并归档当月经营简报 PDF（文字版，可搜索）。</el-alert>

    <el-table :data="list" stripe v-loading="loading">
      <el-table-column label="文件" min-width="220"><template #default="{ row }"><el-icon><Document /></el-icon> {{ row.name }}</template></el-table-column>
      <el-table-column label="大小" width="120"><template #default="{ row }">{{ fmt(row.size) }}</template></el-table-column>
      <el-table-column label="生成时间" width="200"><template #default="{ row }">{{ fmtTime(row.mtime) }}</template></el-table-column>
      <el-table-column label="操作" width="120" fixed="right"><template #default="{ row }"><el-button size="small" type="primary" link @click="download(row)">下载</el-button></template></el-table-column>
    </el-table>
    <el-empty v-if="!loading && list.length === 0" description="暂无归档简报，点击右上角生成" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { Document } from '@element-plus/icons-vue';
import request, { apiBaseURL } from '@/api/request';

const list = ref<any[]>([]); const loading = ref(false); const generating = ref(false);
function fmt(size: number): string { return size ? (size / 1024).toFixed(1) + ' KB' : '—'; }
function fmtTime(t: string): string { return t ? new Date(t).toLocaleString('zh-CN') : '—'; }

async function loadList() {
  loading.value = true;
  try { const r = await request.get('/briefing-reports/list', { silent: true }); list.value = r.data?.list || []; }
  catch { /* 静默 */ } finally { loading.value = false; }
}
async function generate() {
  generating.value = true;
  try { const r = await request.post('/briefing-reports/generate', {}); ElMessage.success('已生成本月简报'); loadList(); }
  catch (err: any) { ElMessage.error(err?.response?.data?.message || '生成失败'); } finally { generating.value = false; }
}
async function download(row: any) {
  const token = localStorage.getItem('accessToken') || '';
  try {
    const resp = await fetch(apiBaseURL + '/briefing-reports/download/' + encodeURIComponent(row.name), { headers: token ? { Authorization: 'Bearer ' + token } : {} });
    if (!resp.ok) return ElMessage.error('下载失败');
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = row.name; a.click();
    URL.revokeObjectURL(url);
  } catch { ElMessage.error('下载失败'); }
}
onMounted(() => loadList());
</script>

<style lang="scss" scoped>
.archive-page { padding: 0; }
.head-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.page-title { font-size: 20px; font-weight: 700; color: #1f2430; margin: 0; }
</style>