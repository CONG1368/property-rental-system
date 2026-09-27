<template>
  <div class="voucher-entry-rows">
    <el-table :data="rows" size="small" border>
      <el-table-column type="index" label="#" width="45" />
      <el-table-column label="摘要" min-width="160">
        <template #default="{ row }"><el-input v-model="row.summary" size="small" placeholder="摘要" /></template>
      </el-table-column>
      <el-table-column label="会计科目" min-width="200">
        <template #default="{ row }">
          <el-select v-model="row.accountId" size="small" filterable clearable placeholder="搜索科目名称/编码"
            :remote="remote" :remote-method="search" :loading="loading" :reserve-keyword="remote" style="width:100%">
            <el-option v-for="a in accounts" :key="a.id" :label="a.code + ' ' + a.name" :value="a.id" />
          </el-select>
        </template>
      </el-table-column>
      <el-table-column label="借方金额" width="140">
        <template #default="{ row }"><el-input-number v-model="row.debitAmount" size="small" :min="0" :precision="2" controls-position="right" style="width:100%" /></template>
      </el-table-column>
      <el-table-column label="贷方金额" width="140">
        <template #default="{ row }"><el-input-number v-model="row.creditAmount" size="small" :min="0" :precision="2" controls-position="right" style="width:100%" /></template>
      </el-table-column>
      <el-table-column label="操作" width="70">
        <template #default="{ $index }"><el-button size="small" type="danger" @click="removeRow($index)">删</el-button></template>
      </el-table-column>
    </el-table>
    <div class="ver-foot">
      <el-button size="small" @click="addRow">添加分录行</el-button>
      <span class="ver-sum">借方合计 <MoneyText :value="totalDebit" :currency="false" /> ｜ 贷方合计 <MoneyText :value="totalCredit" :currency="false" /></span>
      <StatusTag :value="balanced ? '平衡' : '不平衡'" :map="BALANCE_MAP" />
    </div>
  </div>
</template>

<script setup lang="ts">
// A 类（财务）业务组件：凭证分录行录入 —— 增删行 + 借贷合计 + 平衡校验。
// 科目下拉支持「远程搜索」与「本地列表」两种模式。
import { computed } from 'vue';
import MoneyText from '@/components/base/MoneyText.vue';
import StatusTag from '@/components/base/StatusTag.vue';
import type { StatusTagItem } from '@/components/base/types';

const props = withDefaults(defineProps<{
  modelValue: any[];
  accounts?: any[];
  /** 科目走远程搜索（配合 search / loading） */
  remote?: boolean;
  loading?: boolean;
  search?: (q: string) => void;
}>(), { accounts: () => [], remote: false, loading: false });

const emit = defineEmits<{
  (e: 'update:modelValue', v: any[]): void;
  (e: 'change', balanced: boolean): void;
}>();

const BALANCE_MAP: Record<string, StatusTagItem> = { 平衡: { type: 'success' }, 不平衡: { type: 'danger' } };
const rows = computed(() => props.modelValue || []);
const sum = (k: string) => rows.value.reduce((s, r) => s + Number(r[k] || 0), 0);
const totalDebit = computed(() => sum('debitAmount'));
const totalCredit = computed(() => sum('creditAmount'));
const balanced = computed(() => Math.abs(totalDebit.value - totalCredit.value) < 0.005 && totalDebit.value > 0);

function emitRows(next: any[]) { emit('update:modelValue', next); }
function addRow() { emitRows([...rows.value, { accountId: null, summary: '', debitAmount: 0, creditAmount: 0 }]); }
function removeRow(i: number) { const next = [...rows.value]; next.splice(i, 1); emitRows(next); }
</script>

<style lang="scss" scoped>
.voucher-entry-rows { display: flex; flex-direction: column; gap: 10px; }
.ver-foot { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.ver-sum { font-size: $fs-meta; color: $n-600; }
</style>
