<template>
  <div class="property-detail">
    <el-page-header @back="$router.back()" :title="property?.name || '房源详情'" />
    <el-card class="info-card" style="margin-top:16px">
      <template #header>
        <span>基本信息</span>
        <el-tag :type="statusTagType(property?.status)" style="margin-left:12px">{{ property?.status }}</el-tag>
      </template>
      <el-descriptions :column="3" v-if="property">
        <el-descriptions-item label="房源名称">{{ property.name }}</el-descriptions-item>
        <el-descriptions-item label="业态类型">{{ property.type }}</el-descriptions-item>
        <el-descriptions-item label="面积">{{ property.area }} ㎡</el-descriptions-item>
        <el-descriptions-item label="地址">{{ property.address }}</el-descriptions-item>
        <el-descriptions-item label="楼层">{{ property.floor }}</el-descriptions-item>
        <el-descriptions-item label="单元">{{ property.unit }}</el-descriptions-item>
        <el-descriptions-item label="业主">{{ property.owner }}</el-descriptions-item>
        <el-descriptions-item label="子类型">{{ property.subType }}</el-descriptions-item>
        <el-descriptions-item label="备注">{{ property.notes }}</el-descriptions-item>
      </el-descriptions>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { getProperty } from '@/api/properties';

const route = useRoute();
const property = ref<any>(null);

function statusTagType(s: string): string {
  const m: Record<string,string> = { '空置':'info','已预订':'warning','已出租':'success','维修中':'danger','退租中':'danger' };
  return m[s] || 'info';
}

onMounted(async () => {
  try { const res = await getProperty(Number(route.params.id)); property.value = res.data; } catch {}
});
</script>
