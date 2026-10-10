<template>
  <div class="bill-list">
    <PageHeader title="账单列表" :breadcrumb="[{ label: '收租管理' }, { label: '账单列表' }]" />
    <FilterBar v-model:keyword="filters.keyword" :fields="FILTERS" v-model:values="filters" placeholder="账单期间(YYYY-MM)" :keyword-width="160" @search="fetchData" @reset="onReset">
      <template #actions>
        <el-button @click="$router.push('/rent/bills/calendar')">收租日历</el-button>
        <el-button type="primary" @click="createVisible = true">手动创建</el-button>
        <el-button type="primary" @click="handleGenerate">生成账单</el-button>
      </template>
    </FilterBar>

    <DataTable :data="tableData" :loading="loading" :columns="COLUMNS" row-key="id" selectable show-density :page="page" :total="total"
      :page-size="pageSize" :skeleton-columns="9" empty-title="暂无账单" empty-description="可点击右上角「生成账单」按合同批量生成，或手动创建单张账单"
      @selection-change="rows => selectedRows = rows" @page-change="fetchData">
      <template #batch><el-button size="small" type="danger" @click="batchDelete">批量删除</el-button></template>
      <template #bill="{ row }">
        <div style="cursor:pointer" @click="$router.push('/contract/detail/' + row.contract?.id)">
          <div class="bill-no">{{ row.billNo }}</div>
          <div class="bill-sub">{{ row.contract?.tenant?.name || '-' }} / {{ row.contract?.property?.name || '-' }}</div>
        </div>
      </template>
      <template #fees="{ row }">
        <span class="bill-sub">租{{ Math.round(Number(row.rentAmount || 0)) }}+水{{ Math.round(Number(row.waterFee || 0)) }}+电{{ Math.round(Number(row.electricFee || 0)) }}+物{{ Math.round(Number(row.propertyFee || 0)) }}</span>
      </template>
      <template #ops="{ row }">
        <el-button v-if="row.status !== '已缴'" size="small" @click="showPayDialog(row)">收款</el-button>
        <el-button size="small" @click="showDetail(row)">详情</el-button>
        <el-dropdown style="margin-left:4px" @command="(cmd: string) => handlePrint(row, cmd)">
          <el-button size="small" :type="row.status === '已缴' ? 'success' : 'warning'" plain>打印<el-icon><ArrowDown /></el-icon></el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="native"><el-icon><Printer /></el-icon> 直接打印</el-dropdown-item>
              <el-dropdown-item command="pdf"><el-icon><Download /></el-icon> 导出PDF</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </template>
    </DataTable>

    <el-dialog title="手动创建账单" v-model="createVisible" width="520px" @open="onCreateOpen">
      <el-form :model="createForm" label-width="100px">
        <el-form-item label="选择合同">
          <el-select v-model="createForm.contractId" filterable placeholder="搜索合同" style="width:100%">
            <el-option v-for="c in contractOptions" :key="c.id" :label="c.contractNo + ' — ' + (c.tenant?.name || '-') + ' / ' + (c.property?.name || '-')" :value="c.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="账期"><el-date-picker v-model="createForm.period" type="month" value-format="YYYY-MM" placeholder="选择月份" style="width:100%" /></el-form-item>
        <el-form-item label="到期日"><el-date-picker v-model="createForm.dueDate" type="date" value-format="YYYY-MM-DD" placeholder="选择日期" style="width:100%" /></el-form-item>
        <el-form-item v-for="f in AMOUNT_FIELDS" :key="f.key" :label="f.label">
          <el-input-number v-model="createForm[f.key]" :min="0" :precision="2" style="width:100%" />
        </el-form-item>
        <el-form-item label="费用合计"><MoneyText :value="computedCreateTotal" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="createVisible = false">取消</el-button><el-button type="primary" :loading="creating" @click="handleCreate">确认创建</el-button></template>
    </el-dialog>

    <el-dialog title="记录收款" v-model="payDialogVisible" width="450px">
      <el-form :model="payForm" label-width="100px">
        <el-form-item label="账单编号"><span>{{ currentBill?.billNo }}</span></el-form-item>
        <el-form-item label="应缴金额"><MoneyText :value="currentBill?.totalAmount" /></el-form-item>
        <el-form-item label="收款金额"><el-input-number v-model="payForm.amount" :min="0" :precision="2" style="width:100%" /></el-form-item>
        <el-form-item label="收款渠道">
          <el-select v-model="payForm.channel" style="width:100%"><el-option v-for="c in CHANNELS" :key="c.v" :label="c.l" :value="c.v" /></el-select>
        </el-form-item>
        <el-form-item label="交易号"><el-input v-model="payForm.transactionNo" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="payDialogVisible = false">取消</el-button><el-button type="primary" :loading="paying" @click="handlePay">确认收款</el-button></template>
    </el-dialog>

    <el-dialog title="编辑费用明细" v-model="feeEditVisible" width="900px">
      <div class="fee-row fee-head">
        <span style="width:150px">费用名称</span><span style="width:130px">单价</span><span style="width:110px">数量</span>
        <span style="width:130px">单位</span><span style="width:100px">月数</span>
        <span style="width:110px;text-align:right">金额</span><span style="width:56px"></span>
      </div>
      <div v-for="(f, i) in feeRows" :key="i" class="fee-row">
        <el-input v-model="f.name" size="small" style="width:150px" placeholder="如：物业费" />
        <el-input-number v-model="f.unitPrice" :min="0" :precision="2" :controls="false" size="small" style="width:130px" />
        <el-input-number v-model="f.quantity" :min="0" :precision="2" :controls="false" size="small" style="width:110px" />
        <el-select v-model="f.unit" size="small" style="width:130px">
          <el-option v-for="u in FEE_UNITS" :key="u" :label="u" :value="u" />
        </el-select>
        <el-input-number v-model="f.months" :min="0" :precision="0" :controls="false" size="small" style="width:100px" />
        <span class="fee-amount">¥{{ rowAmount(f).toFixed(2) }}</span>
        <el-button size="small" text type="danger" @click="feeRows.splice(i, 1)">删除</el-button>
      </div>
      <el-button size="small" style="margin-top:8px" @click="feeRows.push({ name: '', unit: '元/月', unitPrice: 0, quantity: 0, months: 0 })">+ 添加费用行</el-button>
      <p class="fee-tip">
        单行金额 ＝ 单价 × 数量 ×（月数，留 0 视为 1）。元/月：数量填月数；元/㎡/月：数量填计费面积、月数填覆盖月数；
        元/吨、元/度：数量填用量。保存后按明细重算账单的租金/水费/电费/物业费/其他与合计。
      </p>
      <template #footer>
        <el-button @click="feeEditVisible = false">取消</el-button>
        <el-button type="primary" :loading="feeSaving" @click="saveFeeItems">保存明细</el-button>
      </template>
    </el-dialog>

    <el-drawer title="账单详情" v-model="detailVisible" size="520px">
      <template v-if="billDetail">
        <BillLifecycle :bill="billDetail" class="bill-lc" />
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item v-for="d in detailRows" :key="d.label" :label="d.label">{{ d.value }}</el-descriptions-item>
          <el-descriptions-item label="状态"><StatusTag :value="billDetail.status" :map="BILL_STATUS" /></el-descriptions-item>
        </el-descriptions>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-top:20px">
          <h4 style="margin:0">费用明细</h4>
          <el-button size="small" type="primary" plain @click="showFeeEdit">编辑明细</el-button>
        </div>
        <DataTable :data="billDetail.items || []" :columns="FEE_COLUMNS" density="compact" row-key="id"
          empty-title="暂无费用明细" empty-description="老账单没有明细，点「编辑明细」可按现有金额补出明细行" />

        <h4 style="margin-top:20px">收款记录</h4>
        <DataTable :data="billDetail.paymentRecords || []" :columns="PAY_COLUMNS" density="compact" empty-title="暂无收款记录" />
      </template>
      <el-empty v-else description="加载中..." />
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Printer, ArrowDown, Download } from '@element-plus/icons-vue';
import { getBills, getBill, payBill, generateBills, createBill } from '@/api/bills';
import request from '@/api/request';
import { printBillDocument } from '@/utils/bill-print';
import FilterBar from '@/components/base/FilterBar.vue';
import PageHeader from '@/components/base/PageHeader.vue';
import DataTable from '@/components/base/DataTable.vue';
import MoneyText from '@/components/base/MoneyText.vue';
import StatusTag from '@/components/base/StatusTag.vue';
import BillLifecycle from '@/components/modules/rent/BillLifecycle.vue';
import type { FilterField, TableColumn, StatusTagItem } from '@/components/base/types';

const BILL_STATUS: Record<string, StatusTagItem> = { 已缴: { type: 'success' }, 部分缴: { type: 'warning' }, 逾期: { type: 'danger' }, 未缴: { type: 'info' } };
const CHANNELS = [{ l: '银行转账', v: '银行转账' }, { l: '微信', v: '微信' }, { l: '支付宝', v: '支付宝' }, { l: '现金', v: '现金' }, { l: 'POS刷卡', v: 'POS' }, { l: '支票', v: '支票' }];
const AMOUNT_FIELDS = [{ key: 'rentAmount', label: '租金' }, { key: 'waterFee', label: '水费' }, { key: 'electricFee', label: '电费' }, { key: 'propertyFee', label: '物业费' }, { key: 'otherAmount', label: '其他费用' }];
const FILTERS: FilterField[] = [{ key: 'status', label: '状态', type: 'select', width: 120, options: ['未缴', '部分缴', '已缴', '逾期'].map(v => ({ label: v, value: v })) }];
const COLUMNS: TableColumn[] = [
  { label: '账单编号/租客', width: 170, slot: 'bill' }, { prop: 'period', label: '期间', width: 90, type: 'mono' },
  { prop: 'contract.tenant.name', label: '租客', width: 100 }, { prop: 'contract.property.name', label: '房源', width: 120 },
  { prop: 'totalAmount', label: '总金额', width: 120, type: 'money' }, { label: '费用构成', width: 190, slot: 'fees' },
  { prop: 'dueDate', label: '到期日', width: 110, type: 'date' },
  { prop: 'status', label: '状态', width: 100, type: 'status', statusMap: BILL_STATUS },
  { label: '操作', width: 260, fixed: 'right', slot: 'ops' },
];
const FEE_UNITS = ['元/月', '元/㎡/月', '元/吨', '元/度', '元/次', '元/年', '元/季', '一次性', '手工'];
const FEE_COLUMNS: TableColumn[] = [
  { prop: 'name', label: '费用项目', width: 120 },
  { prop: 'unitPrice', label: '单价', width: 100, type: 'money' },
  { prop: 'quantity', label: '数量', width: 80 },
  { prop: 'unit', label: '单位', width: 100 },
  { prop: 'months', label: '月数', width: 70 },
  { prop: 'amount', label: '金额', width: 110, type: 'money' },
  { prop: 'remark', label: '说明', minWidth: 140, tooltip: true },
];
const PAY_COLUMNS: TableColumn[] = [
  { prop: 'amount', label: '金额', width: 120, type: 'money' }, { prop: 'channel', label: '渠道', width: 100 },
  { prop: 'transactionNo', label: '交易号', width: 160, tooltip: true }, { prop: 'paidAt', label: '收款时间', width: 160, type: 'date', dateFormat: 'datetime' },
];

const filters = reactive<Record<string, any>>({ keyword: '', status: '' });
const loading = ref(false); const tableData = ref<any[]>([]);
const total = ref(0); const page = ref(1); const pageSize = ref(20);
const selectedRows = ref<any[]>([]);
const paying = ref(false); const payDialogVisible = ref(false); const currentBill = ref<any>(null);
const payForm = reactive({ amount: 0, channel: '银行转账', transactionNo: '' });
const creating = ref(false); const createVisible = ref(false); const contractOptions = ref<any[]>([]);
const createForm = reactive<any>({ contractId: null, period: '', dueDate: '', ...Object.fromEntries(AMOUNT_FIELDS.map(f => [f.key, 0])) });
const computedCreateTotal = computed(() => AMOUNT_FIELDS.reduce((s, f) => s + Number(createForm[f.key] || 0), 0));
const detailVisible = ref(false); const billDetail = ref<any>(null);
const detailRows = computed(() => {
  const b = billDetail.value || {};
  const money = (v: any) => '¥' + Number(v || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return [
    { label: '账单编号', value: b.billNo }, { label: '期间', value: b.period }, { label: '总金额', value: money(b.totalAmount) }, { label: '到期日', value: b.dueDate },
    { label: '收款渠道', value: b.paymentChannel || '-' }, { label: '租客', value: b.contract?.tenant?.name || '-' },
    { label: '房源', value: b.contract?.property?.name || '-' }, { label: '合同编号', value: b.contract?.contractNo || '-' },
    { label: '基础租金', value: money(b.rentAmount) }, { label: '水费', value: money(b.waterFee) }, { label: '电费', value: money(b.electricFee) },
    { label: '物业费', value: money(b.propertyFee) }, { label: '其他费用', value: money(b.otherAmount) }, { label: '违约金', value: money(b.lateFee) },
    { label: '实缴日期', value: b.paidDate || '-' },
  ];
});

// ===== 费用明细编辑（用户 2026-10-10，方案 B）=====
const feeEditVisible = ref(false); const feeSaving = ref(false); const feeRows = ref<any[]>([]);
/** 单行金额 = 单价 × 数量 ×（月数，留 0 视为 1） */
function rowAmount(f: any) {
  const m = Number(f?.months || 0) > 0 ? Number(f.months) : 1;
  return Number((Number(f?.unitPrice || 0) * Number(f?.quantity || 0) * m).toFixed(2));
}
function showFeeEdit() {
  const items = billDetail.value?.items || [];
  const b = billDetail.value || {};
  // 老账单没有明细：按现有固定金额先补出明细行，改成正确的再保存
  const fallback = [
    { name: '租金', amount: b.rentAmount }, { name: '水费', amount: b.waterFee },
    { name: '电费', amount: b.electricFee }, { name: '物业费', amount: b.propertyFee },
    { name: '其他费用', amount: b.otherAmount },
  ].filter(x => Number(x.amount || 0) > 0)
    .map(x => ({ name: x.name, unit: '元/月', unitPrice: Number(x.amount), quantity: 1, months: 0 }));
  const src = items.length > 0
    ? items.map((it: any) => ({ name: it.name, unit: it.unit || '元/月', unitPrice: Number(it.unitPrice || 0), quantity: Number(it.quantity || 0), months: Number(it.months || 0) }))
    : fallback;
  feeRows.value = src.length > 0 ? src : [{ name: '', unit: '元/月', unitPrice: 0, quantity: 0, months: 0 }];
  feeEditVisible.value = true;
}
async function saveFeeItems() {
  const items = feeRows.value
    .filter(f => String(f.name || '').trim())
    .map((f, i) => ({
      name: String(f.name).trim(), unit: f.unit || '', unitPrice: Number(f.unitPrice || 0),
      quantity: Number(f.quantity || 0), months: Number(f.months || 0), amount: rowAmount(f), sortOrder: i,
    }));
  if (items.length === 0) return ElMessage.warning('至少保留一行费用');
  feeSaving.value = true;
  try {
    const res = await request.put('/bills/' + billDetail.value.id, { items });
    billDetail.value = res.data;
    ElMessage.success('费用明细已保存');
    feeEditVisible.value = false;
    fetchData();
  } catch { /* 拦截器已提示 */ } finally { feeSaving.value = false; }
}

function onReset() { page.value = 1; }
async function fetchData() {
  loading.value = true;
  try {
    const res = await getBills({ page: page.value, pageSize: pageSize.value, period: filters.keyword || undefined, status: filters.status || undefined });
    tableData.value = res.data.list; total.value = res.data.total;
  } catch {} finally { loading.value = false; }
}
function showPayDialog(row: any) {
  currentBill.value = row; payForm.amount = Number(row.totalAmount); payForm.channel = '银行转账'; payForm.transactionNo = ''; payDialogVisible.value = true;
}
async function handlePay() {
  paying.value = true;
  try { await payBill(currentBill.value.id, { ...payForm }); ElMessage.success('收款成功'); payDialogVisible.value = false; fetchData(); }
  catch {} finally { paying.value = false; }
}
async function showDetail(row: any) {
  detailVisible.value = true; billDetail.value = null;
  try { const res = await getBill(row.id); billDetail.value = res.data; } catch { billDetail.value = row; }
}
async function handlePrint(row: any, mode: string) {
  try {
    // 列表数据不含费用明细，打印前先取详情，让票面按明细出
    let bill = row;
    try { const res = await getBill(row.id); bill = res.data; } catch { /* 退回列表行数据 */ }
    await printBillDocument(bill, mode as 'native' | 'pdf');
    ElMessage.success(mode === 'native' ? '已发送到打印机' : 'PDF导出成功');
  } catch (e: any) { ElMessage.error(e?.message || '打印失败'); }
}
async function handleGenerate() { try { await generateBills(); ElMessage.success('账单生成已触发'); fetchData(); } catch {} }
async function onCreateOpen() {
  Object.assign(createForm, { contractId: null, period: '', dueDate: '' });
  AMOUNT_FIELDS.forEach(f => { createForm[f.key] = 0; });
  try { const res = await request.get('/contracts', { params: { status: '执行中', pageSize: 500 } }); contractOptions.value = res.data.list || []; } catch {}
}
async function handleCreate() {
  if (!createForm.contractId || !createForm.period || !createForm.dueDate) return ElMessage.warning('请选择合同、账期和到期日');
  creating.value = true;
  try { await createBill({ ...createForm }); ElMessage.success('账单创建成功'); createVisible.value = false; fetchData(); }
  catch {} finally { creating.value = false; }
}
async function batchDelete() {
  const n = selectedRows.value.length;
  try { await ElMessageBox.confirm('确定批量删除 ' + n + ' 条账单?', '批量删除', { type: 'warning' }); } catch { return; }
  let done = 0; const skipped: string[] = [];
  for (const row of selectedRows.value) { try { await request.delete('/bills/' + row.id); done++; } catch { skipped.push(row.billNo + ': 删除失败'); } }
  if (skipped.length) ElMessage.warning('成功删除 ' + done + ' 条，跳过 ' + skipped.length + ' 条\n' + skipped.slice(0, 5).join('；'));
  else ElMessage.success('已删除 ' + done + ' 条账单');
  fetchData();
}
onMounted(() => fetchData());
</script>

<style lang="scss" scoped>
.bill-no { font-weight: 600; color: $n-900; font-size: 13px; }
.bill-sub { font-size: 11px; color: $n-600; margin-top: 2px; }
h4 { margin: 0 0 8px; color: $n-900; font-size: 14px; }
.bill-lc { margin-bottom: 14px; }
.fee-row { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }
.fee-head { font-size: 12px; color: $n-600; }
.fee-amount { width: 110px; text-align: right; font-variant-numeric: tabular-nums; }
.fee-tip { margin: 12px 0 0; font-size: 12px; color: $n-600; line-height: 1.7; }
</style>
