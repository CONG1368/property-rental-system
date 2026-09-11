<template>
  <div class="filter-bar">
    <div class="filter-fields">
      <el-input
        v-if="keyword !== undefined"
        :model-value="keyword"
        :placeholder="placeholder"
        clearable
        :style="{ width: keywordWidth + 'px' }"
        @update:model-value="(v: string) => emit('update:keyword', v)"
        @keyup.enter="emit('search')"
        @clear="emit('search')"
      />
      <template v-for="f in fields" :key="f.key">
        <el-select
          v-if="f.type === 'select'"
          :model-value="values[f.key]"
          :placeholder="f.placeholder || f.label"
          :multiple="f.multiple"
          :collapse-tags="f.multiple"
          clearable
          :style="{ width: (f.width || 140) + 'px' }"
          @update:model-value="(v: any) => setField(f.key, v)"
          @change="emit('search')"
        >
          <el-option v-for="o in (f.options || [])" :key="o.value" :label="o.label" :value="o.value" />
        </el-select>
        <el-date-picker
          v-else-if="f.type === 'month'"
          :model-value="values[f.key]"
          type="month"
          value-format="YYYY-MM"
          :placeholder="f.placeholder || f.label"
          clearable
          :style="{ width: (f.width || 140) + 'px' }"
          @update:model-value="(v: any) => setField(f.key, v)"
          @change="emit('search')"
        />
        <el-date-picker
          v-else-if="f.type === 'daterange'"
          :model-value="values[f.key]"
          type="daterange"
          value-format="YYYY-MM-DD"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          clearable
          :style="{ width: (f.width || 260) + 'px' }"
          @update:model-value="(v: any) => setField(f.key, v)"
          @change="emit('search')"
        />
        <el-input
          v-else
          :model-value="values[f.key]"
          :placeholder="f.placeholder || f.label"
          clearable
          :style="{ width: (f.width || 140) + 'px' }"
          @update:model-value="(v: string) => setField(f.key, v)"
          @keyup.enter="emit('search')"
        />
      </template>
      <el-button type="primary" @click="emit('search')">查询</el-button>
      <el-button v-if="showReset" @click="onReset">重置</el-button>
    </div>
    <div class="filter-actions"><slot name="actions" /></div>
  </div>
</template>

<script setup lang="ts">
// 列表页筛选区统一实现：关键字 / 下拉 / 月份 / 日期范围 + 查询 + 重置。
import type { FilterField } from './types';

const props = withDefaults(defineProps<{
  keyword?: string;
  placeholder?: string;
  keywordWidth?: number;
  fields?: FilterField[];
  values?: Record<string, any>;
  showReset?: boolean;
}>(), { placeholder: '关键字搜索', keywordWidth: 180, fields: () => [], values: () => ({}), showReset: true });

const emit = defineEmits<{
  (e: 'update:keyword', v: string): void;
  (e: 'update:values', v: Record<string, any>): void;
  (e: 'search'): void;
  (e: 'reset'): void;
}>();

function setField(key: string, v: any) {
  emit('update:values', { ...props.values, [key]: v });
}
function onReset() {
  const next: Record<string, any> = {};
  for (const f of props.fields || []) next[f.key] = f.type === 'daterange' ? null : '';
  emit('update:values', next);
  emit('update:keyword', '');
  emit('reset');
  emit('search');
}
</script>

<style scoped>
.filter-bar { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; margin-bottom: 16px; }
.filter-fields { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.filter-actions { display: flex; gap: 8px; }
</style>
