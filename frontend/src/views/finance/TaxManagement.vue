<template>
  <div class="tax-management">
    <h2 class="page-title">税务管理</h2>

    <el-row :gutter="16" style="margin-bottom:16px">
      <el-col :span="6"><el-card><el-statistic title="本期应纳税额" :value="taxSummary.totalTaxDue" prefix="¥" :precision="2" /></el-card></el-col>
      <el-col :span="6"><el-card><el-statistic title="增值税" :value="taxSummary.vat" prefix="¥" :precision="2" /></el-card></el-col>
      <el-col :span="6"><el-card><el-statistic title="房产税" :value="taxSummary.propertyTax" prefix="¥" :precision="2" /></el-card></el-col>
      <el-col :span="6"><el-card><el-statistic title="印花税" :value="taxSummary.stampTax" prefix="¥" :precision="2" /></el-card></el-col>
    </el-row>

    <el-card>
      <template #header><span>税务计算</span><el-select v-model="calcPeriod" style="width:140px; margin-left:12px" @change="fetchTaxData"><el-option v-for="m in months" :key="m" :label="m" :value="m" /></el-select><el-button type="primary" style="margin-left:12px" @click="fetchTaxData">计算</el-button></template>
      <el-table :data="taxDetails" stripe v-loading="loading">
        <el-table-column prop="category" label="税种" width="150" />
        <el-table-column prop="base" label="计税基础" width="180"><template #default="{ row }">¥{{ Number(row.base || 0).toFixed(2) }}</template></el-table-column>
        <el-table-column prop="rate" label="税率" width="100" />
        <el-table-column prop="amount" label="应纳税额" width="180"><template #default="{ row }">¥{{ Number(row.amount || 0).toFixed(2) }}</template></el-table-column>
        <el-table-column prop="period" label="期间" width="100" />
        <el-table-column label="操作" width="180">
          <template #default="{ row }">
            <el-button size="small" @click="exportTax(row.category, calcPeriod)">导出</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import request from '@/api/request';
import dayjs from 'dayjs';

const loading = ref(false);
const calcPeriod = ref(dayjs().format('YYYY-MM'));
const taxDetails = ref<any[]>([]);

const taxSummary = computed(() => {
  const data = taxDetails.value;
  return {
    vat: data.filter(d => d.category === '增值税').reduce((s, d) => s + Number(d.amount || 0), 0),
    propertyTax: data.filter(d => d.category === '房产税').reduce((s, d) => s + Number(d.amount || 0), 0),
    stampTax: data.filter(d => d.category === '印花税').reduce((s, d) => s + Number(d.amount || 0), 0),
    totalTaxDue: data.reduce((s, d) => s + Number(d.amount || 0), 0),
  };
});

const months = computed(() => {
  const now = dayjs();
  const list: string[] = [];
  for (let i = 11; i >= 0; i--) { list.push(now.subtract(i, 'month').format('YYYY-MM')); }
  return list;
});

async function fetchTaxData() {
  loading.value = true;
  try {
    const res = await request.get('/tax/calculations', { params: { period: calcPeriod.value } });
    const d = res.data;
    // 将后端扁平数据转为表格明细数组
    const period = calcPeriod.value;
    taxDetails.value = [
      { category: '增值税', base: d.vat?.output || 0, rate: '1%', amount: d.vat?.payable || 0, period },
      { category: '房产税', base: d.propertyTax ? Math.round(d.propertyTax / 0.12 * 100) / 100 : 0, rate: '12%', amount: d.propertyTax || 0, period },
      { category: '城镇土地使用税', base: 0, rate: '1.5元/㎡', amount: d.urbanLandTax || 0, period },
      { category: '印花税', base: d.stampTax ? Math.round(d.stampTax / 0.001 * 100) / 100 : 0, rate: '0.1%', amount: d.stampTax || 0, period },
    ];
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.message || '计算失败');
    taxDetails.value = [];
  } finally { loading.value = false; }
}

async function exportTax(category: string, period: string) {
  try {
    const typeMap: Record<string, string> = { '增值税': 'vat', '房产税': 'property-tax', '印花税': 'stamp-tax', '土地使用税': 'land-tax', '企业所得税': 'cit' };
    const res = await request.get('/tax/export', { params: { type: typeMap[category] || 'vat', period, format: 'excel' }, responseType: 'blob' });
    if (res instanceof Blob) {
      const url = window.URL.createObjectURL(res);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${category}_${period}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    }
    ElMessage.success('导出成功');
  } catch (err: any) { ElMessage.error(err?.response?.data?.message || '导出失败'); }
}

onMounted(() => { fetchTaxData(); });
</script>

<style lang="scss" scoped>
.page-title { font-size: 18px; font-weight: 700; color: #0A3D62; margin-bottom: 16px; }
</style>
