<template>
  <div class="alloc-page">
    <div class="toolbar">
      <el-card shadow="never" class="setting-card">
        <div class="form-row">
          <div class="field"><label>分摊总额</label><el-input-number v-model="totalCost" :min="0" :precision="2" style="width:160px" /></div>
          <div class="field"><label>分摊规则</label>
            <el-select v-model="rule" style="width:160px">
              <el-option label="按面积分摊" value="area" /><el-option label="平均分摊" value="equal" />
            </el-select>
          </div>
        </div>
        <div class="form-row">
          <div class="field"><label>分摊范围</label>
            <el-select v-model="propertyIds" multiple collapse-tags filterable placeholder="选择房源（不选则默认全部在租/退租中）" style="width:400px">
              <el-option v-for="p in properties" :key="p.id" :label="`${p.name}（${p.area}㎡）`" :value="p.id" />
            </el-select>
          </div>
        </div>
        <el-button type="primary" :loading="loading" @click="compute">计算分摊</el-button>
      </el-card>
    </div>

    <el-alert v-if="result" type="success" :closable="false" style="margin-bottom:12px">
      共 {{ result.items?.length }} 个房源参与分摊，总额 {{ fmt(result.totalCost) }} 元
    </el-alert>

    <el-table :data="result?.items || []" stripe v-loading="loading">
      <el-table-column type="index" label="#" width="60" />
      <el-table-column label="房源" min-width="200">
        <template #default="{ row }">{{ propName(row.propertyId) }}</template>
      </el-table-column>
      <el-table-column label="面积(㎡)" width="120"><template #default="{ row }">{{ propArea(row.propertyId) }}</template></el-table-column>
      <el-table-column label="占比" width="100"><template #default="{ row }">{{ result && result.totalCost ? (row.amount / result.totalCost * 100).toFixed(1) : '-' }}%</template></el-table-column>
      <el-table-column prop="amount" label="分摊金额(元)" width="160" align="right"><template #default="{ row }"><b>{{ fmt(row.amount) }}</b></template></el-table-column>
    </el-table>
    <el-empty v-if="!result && !loading" description="请填写总额与规则后计算" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import request from '@/api/request';

const totalCost = ref(0); const rule = ref('area'); const propertyIds = ref<number[]>([]);
const properties = ref<any[]>([]); const result = ref<any>(null); const loading = ref(false);

function fmt(v: any): string { return Number(v || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 }); }
function propName(id: number): string { return properties.value.find(p => p.id === id)?.name || ('房源#' + id); }
function propArea(id: number): string { const p = properties.value.find(x => x.id === id); return p ? Number(p.area || 0) + '' : '-'; }

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

<style lang="scss" scoped>
.alloc-page { padding: 0; }
.toolbar { margin-bottom: 16px; }
.setting-card { max-width: 640px; }
.form-row { display: flex; gap: 20px; margin-bottom: 16px; flex-wrap: wrap; }
.field { display: flex; flex-direction: column; gap: 6px; }
.field label { font-size: 13px; color: #606266; }
</style>