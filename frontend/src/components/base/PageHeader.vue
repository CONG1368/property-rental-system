<template>
  <div class="page-header">
    <div class="page-header-left">
      <el-breadcrumb v-if="breadcrumb && breadcrumb.length" separator="/" class="page-header-crumb">
        <el-breadcrumb-item v-for="(b, i) in breadcrumb" :key="i" :to="b.to">{{ b.label }}</el-breadcrumb-item>
      </el-breadcrumb>
      <div class="page-header-title-row">
        <h1 class="page-header-title">{{ title }}</h1>
        <span v-if="subtitle" class="page-header-subtitle">{{ subtitle }}</span>
      </div>
    </div>
    <div class="page-header-actions"><slot name="actions" /></div>
  </div>
</template>

<script setup lang="ts">
// 页头统一壳：面包屑 + 页面标题 + 主操作区。
// 约定：actions 槽内**每屏只放一个主按钮**（其余用 secondary），颜色留给状态。
export interface Crumb { label: string; to?: string | object }

withDefaults(defineProps<{
  title: string;
  subtitle?: string;
  breadcrumb?: Crumb[];
}>(), { subtitle: '', breadcrumb: () => [] });
</script>

<style scoped>
.page-header { display: flex; justify-content: space-between; align-items: flex-end; gap: 12px; flex-wrap: wrap; margin-bottom: var(--pad-page, 16px); }
.page-header-crumb { margin-bottom: 6px; font-size: $fs-meta; }
.page-header-title-row { display: flex; align-items: baseline; gap: 10px; }
.page-header-title { font-size: $fs-page; font-weight: 700; color: $n-900; letter-spacing: -0.01em; margin: 0; }
.page-header-subtitle { font-size: $fs-meta; color: $n-600; }
.page-header-actions { display: flex; gap: 8px; align-items: center; }
</style>
