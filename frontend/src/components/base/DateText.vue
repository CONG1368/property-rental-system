<template>
  <span class="date-text" :title="text">{{ display }}</span>
</template>

<script setup lang="ts">
// 日期统一展示：绝对/相对、账期格式化、等宽数字。
// 取代各页手写的 slice(0,10).replace('T',' ')（全项目 43 处）。
import { computed } from 'vue';

const props = withDefaults(defineProps<{
  value?: string | number | Date | null;
  format?: 'date' | 'datetime' | 'time' | 'month' | 'year';
  /** 30 天内显示「今天/昨天/N 天前」 */
  relative?: boolean;
  placeholder?: string;
}>(), { format: 'date', relative: false, placeholder: '-' });

const dt = computed<Date | null>(() => {
  const v = props.value;
  if (v === null || v === undefined || v === '') return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  if (typeof v === 'number') { const n = new Date(v); return Number.isNaN(n.getTime()) ? null : n; }
  const s = String(v).trim();
  // 纯日期 / 账期串按「本地时间」解析：new Date('2026-09-11') 会按 UTC 解析，
  // 在负时区（UTC-x）整体退一天——DATEONLY 字段（如 contract.endDate）正是这种串。
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (dm) return new Date(Number(dm[1]), Number(dm[2]) - 1, Number(dm[3]));
  const mm = /^(\d{4})-(\d{2})$/.exec(s);
  if (mm) return new Date(Number(mm[1]), Number(mm[2]) - 1, 1);
  const d = new Date(s.replace(' ', 'T'));
  return Number.isNaN(d.getTime()) ? null : d;
});
const p2 = (n: number) => String(n).padStart(2, '0');
const text = computed(() => {
  const d = dt.value;
  if (!d) return props.placeholder;
  const y = d.getFullYear(); const m = p2(d.getMonth() + 1); const day = p2(d.getDate());
  if (props.format === 'year') return String(y);
  if (props.format === 'month') return y + '-' + m;
  if (props.format === 'time') return p2(d.getHours()) + ':' + p2(d.getMinutes());
  if (props.format === 'datetime') return y + '-' + m + '-' + day + ' ' + p2(d.getHours()) + ':' + p2(d.getMinutes());
  return y + '-' + m + '-' + day;
});
const rel = computed(() => {
  const d = dt.value;
  if (!d) return '';
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const target = new Date(d); target.setHours(0, 0, 0, 0);
  const days = Math.round((target.getTime() - today.getTime()) / 86400000);
  if (days === 0) return '今天';
  if (days === 1) return '明天';
  if (days === -1) return '昨天';
  if (days > 1 && days <= 30) return days + ' 天后';
  if (days < -1 && days >= -30) return Math.abs(days) + ' 天前';
  return '';
});
const display = computed(() => (props.relative && rel.value ? rel.value : text.value));
</script>

<style scoped>
.date-text { font-variant-numeric: tabular-nums; }
</style>
