<template>
  <!-- 表格骨架屏（设计准则 Rule 5：骨架 loading，禁用通用转圈） -->
  <div class="table-skeleton">
    <div class="sk-head">
      <span v-for="c in columns" :key="'h' + c" class="sk-cell sk-head-cell" />
    </div>
    <div class="sk-row" v-for="r in rows" :key="'r' + r" :style="{ animationDelay: r * 60 + 'ms' }">
      <span v-for="c in columns" :key="'c' + r + '-' + c" class="sk-cell" />
    </div>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  /** 骨架行数 */
  rows?: number;
  /** 骨架列数 */
  columns?: number;
}>(), { rows: 6, columns: 6 });
</script>

<style lang="scss" scoped>
.table-skeleton {
  border-radius: 14px; overflow: hidden;
  background: rgba(255, 255, 255, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.68);
}
.sk-head, .sk-row {
  display: flex; gap: 16px; padding: 12px 16px; align-items: center;
}
.sk-head { background: rgba(255, 255, 255, 0.55); }
.sk-row {
  border-top: 1px solid rgba(255, 255, 255, 0.6);
  animation: sk-in 0.4s ease both;
}
.sk-cell {
  flex: 1; height: 12px; border-radius: 6px;
  background: linear-gradient(90deg, rgba(198, 214, 253, 0.5) 25%, rgba(236, 241, 254, 0.9) 37%, rgba(198, 214, 253, 0.5) 63%);
  background-size: 400% 100%;
  animation: sk-shimmer 1.4s ease infinite;
}
.sk-head-cell { height: 10px; opacity: 0.75; }
@keyframes sk-shimmer {
  0% { background-position: 100% 50%; }
  100% { background-position: 0 50%; }
}
@keyframes sk-in {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: none; }
}
</style>
