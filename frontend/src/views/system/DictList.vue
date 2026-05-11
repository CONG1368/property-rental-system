<template>
  <div class="dict-list">
    <h2 class="page-title">数据字典</h2>
    <el-table :data="dictTypes" stripe v-loading="loading" @row-click="(row: any) => { selectedType = row.code; fetchItems(); }" highlight-current-row>
      <el-table-column prop="code" label="字典编码" width="180" />
      <el-table-column prop="name" label="字典名称" />
    </el-table>
    <h3 style="margin-top:24px" v-if="selectedType">{{ selectedType }} - 字典项</h3>
    <el-table :data="dictItems" stripe v-if="selectedType">
      <el-table-column prop="code" label="编码" width="150" />
      <el-table-column prop="name" label="名称" />
      <el-table-column prop="sortOrder" label="排序" width="80" />
      <el-table-column label="启用" width="80"><template #default="{ row }"><el-tag :type="row.isEnabled ? 'success' : 'info'" size="small">{{ row.isEnabled ? '是' : '否' }}</el-tag></template></el-table-column>
    </el-table>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import request from '@/api/request';

const dictTypes = ref<any[]>([]); const dictItems = ref<any[]>([]);
const loading = ref(false); const selectedType = ref('');

async function fetchTypes() {
  loading.value = true;
  try { const res = await request.get('/dicts/types'); dictTypes.value = res.data.list; } catch {} finally { loading.value = false; }
}

async function fetchItems() {
  try { const res = await request.get('/dicts/items', { params: { typeCode: selectedType.value } }); dictItems.value = res.data.list; } catch {}
}

onMounted(() => fetchTypes());
</script>

<style lang="scss" scoped>
.page-title { font-size: 18px; font-weight: 700; color: #0A3D62; margin-bottom: 16px; }
</style>
