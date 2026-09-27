<template>
  <span class="money" :class="{ 'is-neg': negative, 'is-right': align === 'right' }">
    <template v-if="uppercase">{{ chinese }}</template>
    <template v-else>{{ text }}</template>
  </span>
</template>

<script setup lang="ts">
// 财务口径唯一实现：千分位、等宽数字、右对齐、负数着色、中文大写。
// 无业务词汇（base 层约束）。
import { computed } from 'vue';

const props = withDefaults(defineProps<{
  value?: number | string | null;
  currency?: boolean;
  precision?: number;
  uppercase?: boolean;
  colorNegative?: boolean;
  align?: 'left' | 'right';
}>(), { currency: true, precision: 2, uppercase: false, colorNegative: true, align: 'right' });

const num = computed(() => {
  const n = Number(props.value === null || props.value === undefined || props.value === '' ? 0 : props.value);
  return Number.isFinite(n) ? n : 0;
});
const text = computed(() =>
  (props.currency ? '¥' : '') +
  num.value.toLocaleString('zh-CN', { minimumFractionDigits: props.precision, maximumFractionDigits: props.precision })
);
const negative = computed(() => props.colorNegative && num.value < 0);

const CN_NUM = ['零', '壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖'];
const CN_UNIT = ['', '拾', '佰', '仟'];
const CN_BIG = ['', '万', '亿', '兆'];
function section(n: number): string {
  const d = [Math.floor(n / 1000), Math.floor(n / 100) % 10, Math.floor(n / 10) % 10, n % 10];
  let s = ''; let zero = false;
  for (let i = 0; i < 4; i++) {
    if (d[i] === 0) { zero = true; continue; }
    if (zero && s) s += '零';
    zero = false;
    s += CN_NUM[d[i]] + CN_UNIT[3 - i];
  }
  return s;
}
function integerPart(n: number): string {
  if (n === 0) return '零';
  const groups: number[] = [];
  while (n > 0) { groups.push(n % 10000); n = Math.floor(n / 10000); }
  let s = '';
  for (let i = groups.length - 1; i >= 0; i--) {
    if (groups[i] === 0) { if (s && s.slice(-1) !== '零') s += '零'; continue; }
    let part = section(groups[i]);
    if (s && groups[i] < 1000) part = '零' + part;
    s += part + CN_BIG[i];
  }
  return s.replace(/零+$/, '');
}
const chinese = computed(() => {
  const n = num.value;
  const neg = n < 0;
  const abs = Math.abs(n);
  const yuan = Math.floor(abs + 1e-6);
  const cents = Math.round((abs - yuan) * 100);
  let s = integerPart(yuan) + '元';
  const jiao = Math.floor(cents / 10); const fen = cents % 10;
  if (jiao === 0 && fen === 0) s += '整';
  else {
    if (jiao) s += CN_NUM[jiao] + '角';
    else if (yuan) s += '零';
    if (fen) s += CN_NUM[fen] + '分';
  }
  return (neg ? '负' : '') + s;
});
</script>

<style lang="scss" scoped>
.money { font-variant-numeric: tabular-nums; }
.money.is-right { display: inline-block; width: 100%; text-align: right; }
.money.is-neg { color: $bad-600; }
</style>
