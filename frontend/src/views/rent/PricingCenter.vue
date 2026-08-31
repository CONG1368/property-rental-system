<template>
  <div class="pricing-page">
    <el-row :gutter="16">
      <!-- 定价推荐 -->
      <el-col :span="8">
        <el-card shadow="never">
          <template #header><b>定价推荐</b></template>
          <el-form label-width="80px">
            <el-form-item label="业态"><el-select v-model="quote.type" style="width:100%"><el-option label="公寓" value="公寓" /><el-option label="厂房" value="厂房" /><el-option label="商铺" value="商铺" /></el-select></el-form-item>
            <el-form-item label="面积(㎡)"><el-input-number v-model="quote.area" :min="0" :precision="2" style="width:100%" /></el-form-item>
            <el-form-item label="单价(元/㎡)"><el-input-number v-model="quote.unitPrice" :min="0" :precision="2" style="width:100%" /></el-form-item>
            <el-form-item><el-button type="primary" @click="doQuote">计算推荐月租</el-button></el-form-item>
          </el-form>
          <el-alert v-if="quoteResult" type="success" :closable="false">推荐月租：<b>{{ fmt(quoteResult.recommended) }}</b> 元/月（{{ quote.area }}㎡ × {{ fmt(quote.unitPrice) }}元）</el-alert>
        </el-card>
      </el-col>

      <!-- 批量调价 -->
      <el-col :span="16">
        <el-card shadow="never">
          <template #header><b>批量调价</b></template>
          <div class="toolbar">
            <el-select v-model="priceType" placeholder="按业态筛选" clearable style="width:140px" @change="loadContracts">
              <el-option label="公寓" value="公寓" /><el-option label="厂房" value="厂房" /><el-option label="商铺" value="商铺" />
            </el-select>
            <el-input-number v-model="adjustRate" :min="-50" :max="100" :precision="1" placeholder="调价%" style="width:140px" />
            <span class="hint">调价比例（%：正为涨、负为降）</span>
            <el-select v-model="selectedIds" multiple collapse-tags filterable placeholder="选择执行中合同" style="flex:1">
              <el-option v-for="c in contracts" :key="c.id" :label="`${c.contractNo}（${c.tenant?.name || ''} ${c.property?.name || ''}）`" :value="c.id" />
            </el-select>
            <el-button type="warning" :loading="adjusting" @click="doAdjust">执行调价</el-button>
          </div>
          <el-table :data="contracts" stripe size="small" max-height="320">
            <el-table-column type="selection" width="40" @selection-change="(rows:any[])=>selectedIds=rows.map((r:any)=>r.id)" />
            <el-table-column prop="contractNo" label="合同号" width="130" />
            <el-table-column label="租客" width="110"><template #default="{ row }">{{ row.tenant?.name || '-' }}</template></el-table-column>
            <el-table-column label="房源" min-width="140"><template #default="{ row }">{{ row.property?.name || '-' }}</template></el-table-column>
            <el-table-column label="业态" width="80"><template #default="{ row }">{{ row.property?.type || '-' }}</template></el-table-column>
            <el-table-column prop="rentAmount" label="月租金" width="110" align="right"><template #default="{ row }">{{ fmt(row.rentAmount) }}</template></el-table-column>
                      <template #empty>
              <EmptyState title="暂无数据" description="调整筛选条件或新增记录后，数据会显示在这里" />
            </template>
          </el-table>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import request from '@/api/request';

const quote = ref({ type: '公寓', area: 50, unitPrice: 50 });
const quoteResult = ref<any>(null);
const contracts = ref<any[]>([]); const priceType = ref(''); const adjustRate = ref(5); const selectedIds = ref<number[]>([]); const adjusting = ref(false);
function fmt(v: any): string { return Number(v || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 }); }
async function doQuote() {
  try { const r = await request.get('/pricing/quote', { params: { area: quote.value.area, unitPrice: quote.value.unitPrice } }); quoteResult.value = r.data; }
  catch { ElMessage.error('计算失败'); }
}
async function loadContracts() {
  try { const r = await request.get('/pricing/contracts', { params: { type: priceType.value || undefined }, silent: true }); contracts.value = r.data?.list || []; }
  catch { /* 静默 */ }
}
async function doAdjust() {
  if (!selectedIds.value.length) return ElMessage.warning('请选择合同');
  adjusting.value = true;
  try {
    const r = await request.post('/pricing/batch-adjust', { contractIds: selectedIds.value, rate: adjustRate.value });
    ElMessage.success('调价完成'); loadContracts();
  } catch (err: any) { ElMessage.error(err?.response?.data?.message || '调价失败'); } finally { adjusting.value = false; }
}
onMounted(() => loadContracts());
</script>

<style lang="scss" scoped>
.pricing-page { padding: 0; }
.toolbar { display: flex; gap: 12px; align-items: center; margin-bottom: 12px; flex-wrap: wrap; }
.hint { color: #909399; font-size: 12px; }
</style>