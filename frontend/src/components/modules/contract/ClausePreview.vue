<template>
  <div class="clause-preview">
    <div v-for="(c, i) in list" :key="i" class="clause-item">
      <div class="clause-title">
        <span class="clause-no">{{ cn(i + 1) }}</span>
        <span>{{ c.title || '条款' }}</span>
      </div>
      <p v-for="(p, j) in lines(c.content)" :key="j" class="clause-p">{{ p }}</p>
    </div>
    <EmptyState v-if="!list.length" compact title="暂无条款" description="可在合同起草页从模板载入或批量导入" />
  </div>
</template>

<script setup lang="ts">
// A 类（合同）业务组件：条款列表预览 —— 兼容 JSON 字符串、自动编号、多段落。
// 之前合同详情/审批/起草三处各写一套，这里收口为一处。
import { computed } from 'vue';
import EmptyState from '@/components/common/EmptyState.vue';

const props = defineProps<{ clauses?: any; numbered?: boolean }>();

const list = computed<any[]>(() => {
  let v = props.clauses;
  if (typeof v === 'string') { try { v = JSON.parse(v); } catch { v = []; } }
  return Array.isArray(v) ? v : [];
});
const CN = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
function cn(n: number) { return props.numbered === false ? '' : '第' + (CN[n - 1] || n) + '条'; }
function lines(content: any): string[] {
  return String(content || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter((s) => s.trim());
}
</script>

<style lang="scss" scoped>
.clause-preview { display: flex; flex-direction: column; gap: 12px; }
.clause-item { border: 1px solid $n-200; border-radius: $r-box; padding: 12px 14px; background: $n-0; }
.clause-title { display: flex; align-items: baseline; gap: 8px; font-size: $fs-section; font-weight: 600; color: $n-900; margin-bottom: 6px; }
.clause-no { font-size: $fs-meta; color: $brand-600; font-weight: 600; }
.clause-p { margin: 4px 0; text-indent: 2em; color: $n-700; font-size: $fs-body; line-height: $lh-body; white-space: pre-wrap; }
</style>
