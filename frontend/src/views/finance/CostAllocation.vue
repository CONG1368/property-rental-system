<template>
  <div class="alloc-page">
    <PageHeader title="成本分摊" :breadcrumb="[{ label: '财务' }, { label: '成本分摊' }]" />

    <el-card shadow="never" class="setting-card">
      <div class="form-row">
        <div class="field"><label>分摊总额</label><el-input-number v-model="totalCost" :min="0" :precision="2" style="width:160px" /></div>
        <div class="field">
          <label>分摊规则</label>
          <el-select v-model="rule" style="width:160px"><el-option label="按面积分摊" value="area" /><el-option label="平均分摊" value="equal" /></el-select>
        </div>
      </div>
      <div class="form-row">
        <div class="field">
          <label>分摊范围</label>
          <el-select v-model="propertyIds" multiple collapse-tags filterable placeholder="选择房源（不选则默认全部在租/退租中）" style="width:400px">
            <el-option v-for="p in properties" :key="p.id" :label="p.name + '（' + p.area + '㎡）'" :value="p.id" />
          </el-select>
        </div>
      </div>
      <el-button type="primary" :loading="loading" @click="compute">计算分摊</el-button>
    </el-card>

    <el-alert v-if="result" type="success" :closable="false">
      共 {{ result.items?.length }} 个房源参与分摊，总额 <MoneyText :value="result.totalCost" :currency="false" /> 元
    </el-alert>

        <DataTable :data="result?.items || []" :loading="loading" :columns="COLUMNS" row-key="propertyId"
      empty-title="尚未计算" empty-description="请填写分摊总额与规则后点击「计算分摊」">
      <template #prop="{ row }">{{ propName(row.propertyId) }}</template>
      <template #area="{ row }">{{ propArea(row.propertyId) }}</template>
      <template #ratio="{ row }">{{ ratio(row.amount) }}</template>
    </DataTable>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import request from '@/api/request';
import PageHeader from '@/components/base/PageHeader.vue';
import DataTable from '@/components/base/DataTable.vue';
import MoneyText from '@/components/base/MoneyText.vue';
import type { TableColumn } from '@/components/base/types';

const COLUMNS: TableColumn[] = [
  { label: '#', width: 60, type: 'index' }, { label: '房源', minWidth: 200, slot: 'prop' },
  { label: '面积(㎡)', width: 120, slot: 'area' }, { label: '占比', width: 100, slot: 'ratio' },
  { prop: 'amount', label: '分摊金额(元)', width: 160, type: 'money' },
];

const totalCost = ref(0); const rule = ref('area'); const propertyIds = ref<number[]>([]);
const properties = ref<any[]>([]); const result = ref<any>(null); const loading = ref(false);

const propName = (id: number) => properties.value.find(p => p.id === id)?.name || ('房源#' + id);
const propArea = (id: number) => { const p = properties.value.find(x => x.id === id); return p ? Number(p.area || 0) : '-'; };
const ratio = (amount: number) => (result.value && result.value.totalCost ? (amount / result.value.totalCost * 100).toFixed(1) : '-') + '%';

async function loadProps() {
  try { const res = await request.get('/cost-allocation/properties'); properties.value = res.data?.list || []; } catch { /* 静默 */ }
}
async function compute() {
  if (!totalCost.value || totalCost.value <= 0) return ElMessage.warning('请输入分摊总额');
  loading.value = true;
  try {
    const body: any = { totalCost: totalCost.value, rule: rule.value };
    if (propertyIds.value.length) body.propertyIds = propertyIds.value;
    const res = await request.post('/cost-allocation/allocate', body);
    result.value = res.data; ElMessage.success('分摊计算完成');
  } catch (err: any) { ElMessage.error(err?.response?.data?.message || '计算失败'); } finally { loading.value = false; }
}
onMounted(() => loadProps());
</script>

