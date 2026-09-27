<template>
  <div class="bill-lifecycle">
    <div v-for="(s, i) in stages" :key="s.key" class="lc-stage" :class="{ done: s.done, current: s.current, danger: s.danger }">
      <span class="lc-dot" />
      <span class="lc-text">{{ s.label }}</span>
      <span v-if="s.at" class="lc-at">{{ s.at }}</span>
      <span v-if="i < stages.length - 1" class="lc-line" />
    </div>
  </div>
</template>

<script setup lang="ts">
// A 类（收租）业务组件：账单生命周期 —— 生成 → 到期 → 收款 → 结清。
// 之前账单详情/列表抽屉各写一套状态判断，这里收口为一处。
import { computed } from 'vue';

const props = defineProps<{ bill?: any | null }>();

const stages = computed(() => {
  const b = props.bill || {};
  const paid = b.status === '已缴';
  const partial = b.status === '部分缴';
  const overdue = b.status === '逾期';
  const settled = paid && !Number(b.lateFee || 0);
  return [
    { key: 'created', label: '已生成', at: b.period || '', done: true, current: false, danger: false },
    { key: 'due', label: overdue ? '已逾期' : '到期', at: b.dueDate || '', done: true, current: !paid && !partial, danger: overdue },
    { key: 'paid', label: partial ? '部分收款' : '已收款', at: b.paidDate || '', done: paid || partial, current: partial, danger: false },
    { key: 'settled', label: '已结清', at: '', done: settled, current: false, danger: false },
  ];
});
</script>

<style lang="scss" scoped>
.bill-lifecycle { display: flex; align-items: center; flex-wrap: wrap; gap: 4px 0; }
.lc-stage { position: relative; display: flex; align-items: center; gap: 6px; padding-right: 26px; }
.lc-dot { width: 8px; height: 8px; border-radius: 50%; background: $n-300; flex-shrink: 0; }
.lc-stage.done .lc-dot { background: $brand-600; }
.lc-stage.danger .lc-dot { background: $bad-600; }
.lc-text { font-size: $fs-meta; color: $n-600; }
.lc-stage.done .lc-text { color: $n-900; }
.lc-stage.danger .lc-text { color: $bad-600; }
.lc-at { font-size: $fs-meta; color: $n-600; font-variant-numeric: tabular-nums; }
.lc-line { position: absolute; right: 8px; top: 50%; width: 14px; height: 1px; background: $n-200; }
</style>
