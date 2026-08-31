<template>
  <div class="search-page">
    <div class="search-bar">
      <el-input v-model="q" placeholder="全局检索：房源/租客/合同/账单/工单/投诉/住户/线索…" size="large" :prefix-icon="Search" clearable @keyup.enter="doSearch" />
      <el-button type="primary" size="large" :loading="loading" @click="doSearch">搜索</el-button>
    </div>
    <el-empty v-if="!searched" description="输入关键词，跨模块全局检索" />
    <div v-else>
      <el-alert v-if="!groups.length" type="info" :closable="false">未找到相关结果</el-alert>
      <el-row :gutter="16" v-for="g in groups" :key="g.group" style="margin-bottom:16px">
        <el-col :span="24">
          <el-card shadow="never">
            <template #header><b>{{ g.group }}（{{ g.items.length }}）</b></template>
            <div class="res-item" v-for="it in g.items" :key="it.id" @click="go(it.route)">
              <el-icon><ArrowRight /></el-icon><span>{{ it.label }}</span>
            </div>
          </el-card>
        </el-col>
      </el-row>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { Search, ArrowRight } from '@element-plus/icons-vue';
import { useRouter } from 'vue-router';
import request from '@/api/request';
const q = ref(''); const groups = ref<any[]>([]); const loading = ref(false); const searched = ref(false);
const router = useRouter();
async function doSearch() {
  if (!q.value.trim()) return;
  loading.value = true;
  try { const r = await request.get('/search', { params: { q: q.value } }); groups.value = r.data?.groups || []; searched.value = true; }
  catch { /* 静默 */ } finally { loading.value = false; }
}
function go(route: string) { router.push(route).catch(() => {}); }
</script>

<style lang="scss" scoped>
.search-page { padding: 0; }
.search-bar { display: flex; gap: 10px; margin-bottom: 20px; }
.res-item { display: flex; align-items: center; gap: 8px; padding: 8px 4px; border-bottom: 1px solid #f5f7fa; cursor: pointer; color: #0A3D62; }
.res-item:hover { background: #ecf5ff; }
</style>