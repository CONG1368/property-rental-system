<template>
  <div class="data-table" :class="'density-' + effDensity">
    <div v-if="selectable && selectedCount" class="batch-bar">
      <span class="batch-info">已选 {{ selectedCount }} 项</span>
      <slot name="batch" :count="selectedCount" />
      <el-button size="small" @click="clearSelection">取消选择</el-button>
    </div>

    <div v-if="showDensity" class="density-bar">
      <span class="density-label">行密度</span>
      <el-select v-model="currentDensity" size="small" style="width:92px">
        <el-option label="密" value="compact" /><el-option label="标" value="default" /><el-option label="松" value="loose" />
      </el-select>
    </div>

    <TableSkeleton v-if="loading && !data.length" :rows="skeletonRows" :columns="skeletonColumns" />
    <el-table
      v-show="!(loading && !data.length)"
      ref="tableRef"
      :data="data"
      :row-key="rowKey"
      :size="tableSize"
      stripe
      v-loading="loading"
      @selection-change="onSelection"
      @sort-change="(e: any) => emit('sort-change', e)"
      @row-click="(row: any, col: any, ev: Event) => emit('row-click', row, col, ev)"
    >
      <el-table-column v-if="selectable" type="selection" width="45" />
      <el-table-column
        v-for="c in columns"
        :key="c.key || c.prop || c.label"
        :prop="c.prop"
        :label="c.label"
        :width="c.width"
        :min-width="c.minWidth"
        :fixed="c.fixed"
        :sortable="c.sortable"
        :show-overflow-tooltip="c.tooltip"
        :align="c.align || (c.type === 'money' ? 'right' : 'left')"
        :header-align="c.align || (c.type === 'money' ? 'right' : 'left')"
      >
        <template v-if="hasCustom(c)" #default="scope">
          <slot v-if="c.slot" :name="c.slot" v-bind="scope" />
          <MoneyText v-else-if="c.type === 'money'" :value="getByPath(scope.row, c.prop)" :precision="c.precision" :currency="c.currency" />
          <StatusTag v-else-if="c.type === 'status'" :value="getByPath(scope.row, c.prop)" :map="c.statusMap" />
          <DateText v-else-if="c.type === 'date'" :value="getByPath(scope.row, c.prop)" :format="c.dateFormat || 'date'" />
          <span v-else-if="c.type === 'index'" class="mono">{{ scope.$index + 1 }}</span>
          <span v-else class="mono">{{ mono(scope.row, c.prop) }}</span>
        </template>
      </el-table-column>
      <template #empty>
        <EmptyState :title="emptyTitle" :description="emptyDescription" />
      </template>
    </el-table>

    <el-pagination
      v-if="total !== undefined"
      class="data-table-pager"
      :current-page="page"
      :total="total"
      :page-size="pageSize"
      layout="total, prev, pager, next"
      @current-change="onPage"
    />
  </div>
</template>

<script setup lang="ts">
// 列表页表格统一实现：列配置（含 money/status/mono 内置渲染）、批量选择、
// 骨架屏、统一空态、分页、三档密度、等宽数字。base 层，不含业务词汇。
import { computed, ref } from 'vue';
import type { TableColumn, Density } from './types';
import { useDensity } from '@/composables/useDensity';
import TableSkeleton from '@/components/common/TableSkeleton.vue';
import EmptyState from '@/components/common/EmptyState.vue';
import MoneyText from './MoneyText.vue';
import StatusTag from './StatusTag.vue';
import DateText from './DateText.vue';

const props = withDefaults(defineProps<{
  data?: any[];
  columns?: TableColumn[];
  loading?: boolean;
  selectable?: boolean;
  rowKey?: string;
  /** 不传则读全局密度设置 */
  density?: Density;
  /** 显示「密/标/松」行密度切换 */
  showDensity?: boolean;
  skeletonRows?: number;
  skeletonColumns?: number;
  emptyTitle?: string;
  emptyDescription?: string;
  total?: number;
  page?: number;
  pageSize?: number;
}>(), {
  data: () => [], columns: () => [], loading: false, selectable: false,
  showDensity: false, skeletonRows: 8, skeletonColumns: 6,
  emptyTitle: '暂无数据', emptyDescription: '', page: 1, pageSize: 20,
});

const emit = defineEmits<{
  (e: 'selection-change', rows: any[]): void;
  (e: 'sort-change', payload: any): void;
  (e: 'row-click', row: any, column: any, event: Event): void;
  (e: 'update:page', p: number): void;
  (e: 'page-change', p: number): void;
}>();

const { density: globalDensity, setDensity } = useDensity();
const effDensity = computed<Density>(() => props.density || globalDensity.value);
const currentDensity = computed<Density>({ get: () => effDensity.value, set: (v) => setDensity(v) });

const tableRef = ref();
const selectedCount = ref(0);
const tableSize = computed<'small' | 'default' | 'large'>(() =>
  effDensity.value === 'compact' ? 'small' : effDensity.value === 'loose' ? 'large' : 'default'
);

function hasCustom(c: TableColumn): boolean {
  return !!c.slot || c.type === 'money' || c.type === 'status' || c.type === 'mono' || c.type === 'date' || c.type === 'index';
}
function getByPath(obj: any, path?: string) {
  if (!obj || !path) return undefined;
  if (path.indexOf('.') < 0) return obj[path];
  return path.split('.').reduce((o: any, k: string) => (o === null || o === undefined ? undefined : o[k]), obj);
}
function mono(row: any, prop?: string) {
  const v = getByPath(row, prop);
  return v === null || v === undefined || v === '' ? '-' : v;
}
function onSelection(rows: any[]) { selectedCount.value = rows.length; emit('selection-change', rows); }
function clearSelection() { tableRef.value?.clearSelection(); selectedCount.value = 0; }
function onPage(p: number) { emit('update:page', p); emit('page-change', p); }
defineExpose({ clearSelection, tableRef });
</script>

<style scoped>
.data-table { position: relative; }
.batch-bar { display: flex; gap: 10px; align-items: center; padding: 8px 16px; margin-bottom: 12px; background: $brand-100; border: 1px solid $brand-100; border-radius: $r-ctl; }
.batch-info { font-size: 13px; color: $brand-600; font-weight: 600; margin-right: 8px; }
.density-bar { display: flex; align-items: center; gap: 8px; justify-content: flex-end; margin-bottom: 8px; }
.density-label { font-size: $fs-meta; color: $n-600; }
.mono { font-variant-numeric: tabular-nums; }
.data-table-pager { margin-top: 16px; display: flex; justify-content: flex-end; }
.density-compact :deep(.el-table__cell) { padding: 4px 0; }
.density-loose :deep(.el-table__cell) { padding: 14px 0; }
</style>
