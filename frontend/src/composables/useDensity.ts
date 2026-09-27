// 表格密度（密/标/松）：全局单选，持久化到 localStorage，DataTable 默认读取它。
import { ref, watch } from 'vue';
import type { Density } from '@/components/base/types';

const KEY = 'ui-density';
function read(): Density {
  const v = typeof localStorage === 'undefined' ? null : localStorage.getItem(KEY);
  return v === 'compact' || v === 'loose' ? v : 'default';
}
const density = ref<Density>(read());
watch(density, (v) => { try { localStorage.setItem(KEY, v); } catch { /* 忽略 */ } });

export function useDensity() {
  return { density, setDensity: (v: Density) => { density.value = v; } };
}
