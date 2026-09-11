<template>
  <el-tag :type="cfg.type" :size="size" effect="light" disable-transitions>{{ cfg.label }}</el-tag>
</template>

<script setup lang="ts">
// 把散落在各页的 :type 三元表达式收成一张状态映射表；
// 映射表由调用方传入，组件本身不认识任何业务状态。
import { computed } from 'vue';
import type { StatusTagItem } from './types';

const props = withDefaults(defineProps<{
  value?: string | number | null;
  map?: Record<string, StatusTagItem>;
  size?: 'small' | 'default' | 'large';
  fallbackType?: StatusTagItem['type'];
}>(), { size: 'small', fallbackType: 'info' });

const cfg = computed<StatusTagItem>(() => {
  const key = props.value === null || props.value === undefined ? '' : String(props.value);
  const hit = props.map ? props.map[key] : undefined;
  return { type: hit?.type || props.fallbackType, label: hit?.label || key || '-' };
});
</script>
