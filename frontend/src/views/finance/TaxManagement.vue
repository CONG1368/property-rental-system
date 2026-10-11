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
      <DataTable :data="taxDetails" :loading="loading" :columns="COLUMNS" row-key="id" empty-title="暂无数据" empty-description="调整筛选条件或新增记录后，数据会显示在这里">
        <template #c2="{ row }">¥{{ Number(row.base || 0).toFixed(2) }}</template>
        <template #c4="{ row }">¥{{ Number(row.amount || 0).toFixed(2) }}</template>
        <template #c6="{ row }"><el-button size="small" @click="exportTax(row.category, calcPeriod)">导出</el-button></template>
      </DataTable>
    </el-card>

    <!-- 税率参数（用户 2026-10-11 要求：税率不写死，可按当地/本企业口径修改）-->
    <el-card style="margin-top:16px">
      <template #header>
        <span>税率参数</span>
        <span class="rate-hint">按当地税务口径填写；留空/未配置时用默认值（默认值即系统原先写死的费率，老库结果不变）</span>
      </template>
      <el-form label-width="150px" style="max-width:720px">
        <el-form-item v-for="m in rateMeta" :key="m.key" :label="m.label">
          <el-input-number
            v-model="rateForm[m.field]"
            :min="0"
            :precision="m.unit === '%' ? 4 : 2"
            :step="m.unit === '%' ? 0.1 : 0.5"
            style="width:200px"
          />
          <span class="rate-unit">{{ m.unit }}</span>
          <span class="rate-desc">{{ m.desc }}</span>
        </el-form-item>
      </el-form>
      <div class="rate-actions">
        <el-button type="primary" :loading="savingRates" @click="saveRates">保存税率</el-button>
        <el-button @click="resetRatesToDefault">恢复默认</el-button>
        <span class="rate-tip">保存需输入当前登录密码二次确认，并写入审计日志；保存后税务计算与导出报表立即按新费率执行。</span>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import DataTable from '@/components/base/DataTable.vue';
import type { TableColumn } from '@/components/base/types';

const COLUMNS: TableColumn[] = [
  { prop: 'category', label: '税种', width: 150 },
  { prop: 'base', label: '计税基础', width: 180, slot: 'c2' },
  { prop: 'rate', label: '税率', width: 100 },
  { prop: 'amount', label: '应纳税额', width: 180, slot: 'c4' },
  { prop: 'period', label: '期间', width: 100 },
  { label: '操作', width: 180, slot: 'c6' },
];

import { ref, computed, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import request from '@/api/request';
import { confirmWithPassword } from '@/utils/confirm-password';
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

// ===== 税率参数（GET/PUT /tax/rates）=====
const rateMeta = ref<any[]>([]);
const rateForm = ref<Record<string, number>>({});
const rateDefaults = ref<Record<string, number>>({});
const savingRates = ref(false);

/** 库里的费率是小数（0.01），百分比字段在界面上按「1.0000」展示，保存时再除回 100 */
function toDisplay(unit: string, value: number): number {
  return unit === '%' ? Number((Number(value || 0) * 100).toFixed(4)) : Number(Number(value || 0).toFixed(2));
}
function fillForm(source: Record<string, number>): void {
  const form: Record<string, number> = {};
  for (const m of rateMeta.value) form[m.field] = toDisplay(m.unit, Number(source?.[m.field] ?? 0));
  rateForm.value = form;
}
async function loadRates(): Promise<void> {
  try {
    const res = await request.get('/tax/rates');
    rateMeta.value = res.data?.meta || [];
    rateDefaults.value = res.data?.defaults || {};
    fillForm(res.data?.rates || {});
  } catch { /* 拦截器已提示 */ }
}
function resetRatesToDefault(): void {
  fillForm(rateDefaults.value);
  ElMessage.info('已填入默认费率，点「保存税率」后生效');
}
async function saveRates(): Promise<void> {
  const pwd = await confirmWithPassword('修改税务费率会影响税务计算结果与导出报表，请输入当前登录密码确认');
  if (!pwd) return;
  const body: Record<string, number> = {};
  for (const m of rateMeta.value) {
    const v = Number(rateForm.value[m.field] ?? 0);
    body[m.field] = m.unit === '%' ? v / 100 : v;
  }
  savingRates.value = true;
  try {
    await request.put('/tax/rates', { ...body, confirmPassword: pwd });
    ElMessage.success('税率已保存，税务计算与导出报表按新费率执行');
    await Promise.all([loadRates(), fetchTaxData()]);
  } catch { /* 拦截器已提示 */ } finally { savingRates.value = false; }
}

onMounted(() => { fetchTaxData(); loadRates(); });
</script>

<style lang="scss" scoped>
.page-title { font-size: 18px; font-weight: 700; color: $n-900; margin-bottom: 16px; }
.rate-hint { margin-left: 12px; font-size: 12px; color: $n-600; font-weight: 400; }
.rate-unit { margin-left: 8px; color: $n-700; }
.rate-desc { margin-left: 12px; font-size: 12px; color: $n-600; }
.rate-actions { display: flex; align-items: center; gap: 12px; }
.rate-tip { font-size: 12px; color: $n-600; }
</style>
