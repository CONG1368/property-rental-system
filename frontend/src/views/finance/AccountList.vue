<template>
  <div class="account-list">
    <h2 class="page-title">科目管理</h2>
    <el-tree :data="treeData" node-key="id" default-expand-all :props="{ label: 'label', children: 'children' }">
      <template #default="{ node, data }">
        <span class="account-node">
          <el-tag :type="data.type === '资产' ? '' : data.type === '负债' ? 'warning' : data.type === '收入' ? 'success' : 'info'" size="small">{{ data.type }}</el-tag>
          <span class="account-code">{{ data.code }}</span>
          <span>{{ data.name }}</span>
          <span class="account-direction">{{ data.direction === '借' ? '[借]' : '[贷]' }}</span>
        </span>
      </template>
    </el-tree>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import request from '@/api/request';

const treeData = ref<any[]>([]);

function buildTree(accounts: any[]): any[] {
  const map = new Map<number, any>();
  accounts.forEach((a: any) => map.set(a.id, { ...a, label: a.code + ' ' + a.name, children: [] }));
  const roots: any[] = [];
  map.forEach((item: any) => {
    if (item.parentId && map.has(item.parentId)) { map.get(item.parentId).children.push(item); }
    else { roots.push(item); }
  });
  return roots;
}

onMounted(async () => {
  try { const res = await request.get('/accounts'); treeData.value = buildTree(res.data.list); } catch {}
});
</script>

<style lang="scss" scoped>
.page-title { font-size: 18px; font-weight: 700; color: #0A3D62; margin-bottom: 16px; }
.account-node { display: flex; gap: 8px; align-items: center; font-size: 13px; }
.account-code { color: #0A3D62; font-weight: 600; }
.account-direction { color: #7F8C8D; font-size: 10px; }
</style>
