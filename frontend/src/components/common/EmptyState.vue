<template>
  <!-- 统一空态（设计准则 Rule 5：精美空态，图标 + 标题 + 说明 + 可选操作） -->
  <div class="empty-state" :style="{ padding: compact ? '20px 0' : '38px 0' }">
    <div class="empty-icon">
      <el-icon :size="compact ? 26 : 34"><component :is="iconComp" /></el-icon>
    </div>
    <div class="empty-title">{{ title }}</div>
    <div class="empty-desc" v-if="description">{{ description }}</div>
    <el-button v-if="actionText" type="primary" size="small" class="empty-action" @click="emit('action')">
      {{ actionText }}
    </el-button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { Component } from 'vue';
import { DocumentDelete, Search, Box, Warning, CircleCheck, Files } from '@element-plus/icons-vue';

const props = withDefaults(defineProps<{
  /** 标题文案 */
  title?: string;
  /** 补充说明 */
  description?: string;
  /** 图标类型：empty(默认) / search / box / warn / done / files */
  icon?: 'empty' | 'search' | 'box' | 'warn' | 'done' | 'files';
  /** 操作按钮文案，留空则不显示按钮 */
  actionText?: string;
  /** 紧凑模式（用于卡片内小区域） */
  compact?: boolean;
}>(), {
  title: '暂无数据',
  description: '',
  icon: 'empty',
  actionText: '',
  compact: false,
});

const emit = defineEmits<{ (e: 'action'): void }>();

const iconMap: Record<string, Component> = {
  empty: DocumentDelete, search: Search, box: Box,
  warn: Warning, done: CircleCheck, files: Files,
};
const iconComp = computed(() => iconMap[props.icon] || DocumentDelete);
</script>

<style lang="scss" scoped>
.empty-state {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 8px; text-align: center;
}
.empty-icon {
  width: 56px; height: 56px; border-radius: 18px;
  display: flex; align-items: center; justify-content: center;
  background: rgba(255, 255, 255, 0.55);
  border: 1px solid rgba(255, 255, 255, 0.72);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.6);
  color: #7ba0f9;
}
.empty-title { font-size: 14px; font-weight: 600; color: #3a4354; }
.empty-desc { font-size: 12px; color: #5b6472; max-width: 42ch; line-height: 1.6; }
.empty-action { margin-top: 4px; }
</style>
