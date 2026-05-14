<template>
  <div class="bill-list">
    <div class="toolbar">
      <div class="search-group">
        <el-input v-model="searchPeriod" placeholder="账单期间(YYYY-MM)" clearable style="width:160px" @keyup.enter="fetchData" />
        <el-select v-model="filterStatus" placeholder="状态" clearable style="width:120px" @change="fetchData">
          <el-option label="未缴" value="未缴" /><el-option label="部分缴" value="部分缴" />
          <el-option label="已缴" value="已缴" /><el-option label="逾期" value="逾期" />
        </el-select>
        <el-button type="primary" @click="fetchData">查询</el-button>
      </div>
      <div class="action-group">
        <el-button @click="$router.push('/rent/bills/calendar')">收租日历</el-button>
        <el-button type="primary" @click="showCreateDialog">手动创建</el-button>
        <el-button type="primary" @click="handleGenerate">生成账单</el-button>
      </div>
    </div>

    <!-- 批量操作栏 -->
    <div class="batch-bar" v-if="selectedIds.length > 0">
      <span class="batch-info">已选 {{ selectedIds.length }} 项</span>
      <el-button size="small" type="danger" @click="batchDelete">批量删除</el-button>
      <el-button size="small" @click="clearSelection">取消选择</el-button>
    </div>

    <el-table :data="tableData" stripe v-loading="loading" @selection-change="(rows: any[]) => selectedRows = rows" ref="tableRef">
      <el-table-column type="selection" width="45" />
      <el-table-column label="账单编号/租客" width="170">
        <template #default="{ row }">
          <div class="bill-no-cell" style="cursor:pointer" @click="$router.push('/contract/detail/' + row.contract?.id)">
            <div style="font-weight:600;color:#0A3D62;font-size:13px">{{ row.billNo }}</div>
            <div style="font-size:11px;color:#909399;margin-top:2px">{{ row.contract?.tenant?.name || '-' }} / {{ row.contract?.property?.name || '-' }}</div>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="period" label="期间" width="90" />
      <el-table-column label="租客" width="100"><template #default="{ row }">{{ row.contract?.tenant?.name || '-' }}</template></el-table-column>
      <el-table-column label="房源" width="120"><template #default="{ row }">{{ row.contract?.property?.name || '-' }}</template></el-table-column>
      <el-table-column prop="totalAmount" label="总金额" width="120"><template #default="{ row }">¥{{ Number(row.totalAmount).toFixed(2) }}</template></el-table-column>
      <el-table-column label="费用构成" width="190"><template #default="{ row }">
        <span style="font-size:11px">租{{ Number(row.rentAmount||0).toFixed(0) }}+水{{ Number(row.waterFee||0).toFixed(0) }}+电{{ Number(row.electricFee||0).toFixed(0) }}+物{{ Number(row.propertyFee||0).toFixed(0) }}</span>
      </template></el-table-column>
      <el-table-column prop="dueDate" label="到期日" width="110" />
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="row.status === '已缴' ? 'success' : row.status === '部分缴' ? 'warning' : row.status === '逾期' ? 'danger' : 'info'" size="small">{{ row.status }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="200" fixed="right">
        <template #default="{ row }">
          <el-button size="small" @click="showPayDialog(row)" v-if="row.status !== '已缴'">收款</el-button>
          <el-button size="small" @click="showDetail(row)">详情</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-pagination v-model:current-page="page" :total="total" :page-size="pageSize" @current-change="fetchData" layout="total, prev, pager, next" style="margin-top:16px; justify-content:flex-end" />

    <!-- 手动创建账单对话框 -->
    <el-dialog title="手动创建账单" v-model="createVisible" width="520px" @open="onCreateOpen">
      <el-form :model="createForm" label-width="100px">
        <el-form-item label="选择合同" prop="contractId">
          <el-select v-model="createForm.contractId" filterable placeholder="搜索合同" style="width:100%">
            <el-option v-for="c in contractOptions" :key="c.id" :label="`${c.contractNo} — ${c.tenant?.name || '-'} / ${c.property?.name || '-'}`" :value="c.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="账期" prop="period">
          <el-date-picker v-model="createForm.period" type="month" value-format="YYYY-MM" placeholder="选择月份" style="width:100%" />
        </el-form-item>
        <el-form-item label="到期日" prop="dueDate">
          <el-date-picker v-model="createForm.dueDate" type="date" value-format="YYYY-MM-DD" placeholder="选择日期" style="width:100%" />
        </el-form-item>
        <el-form-item label="租金"><el-input-number v-model="createForm.rentAmount" :min="0" :precision="2" style="width:100%" /></el-form-item>
        <el-form-item label="水费"><el-input-number v-model="createForm.waterFee" :min="0" :precision="2" style="width:100%" /></el-form-item>
        <el-form-item label="电费"><el-input-number v-model="createForm.electricFee" :min="0" :precision="2" style="width:100%" /></el-form-item>
        <el-form-item label="物业费"><el-input-number v-model="createForm.propertyFee" :min="0" :precision="2" style="width:100%" /></el-form-item>
        <el-form-item label="其他费用"><el-input-number v-model="createForm.otherAmount" :min="0" :precision="2" style="width:100%" /></el-form-item>
        <el-form-item label="费用合计"><span style="font-weight:600;color:#0A3D62;font-size:16px">¥{{ computedCreateTotal.toFixed(2) }}</span></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createVisible = false">取消</el-button>
        <el-button type="primary" @click="handleCreate" :loading="creating">确认创建</el-button>
      </template>
    </el-dialog>

    <!-- 收款对话框 -->
    <el-dialog title="记录收款" v-model="payDialogVisible" width="450px">
      <el-form :model="payForm" label-width="100px">
        <el-form-item label="账单编号"><span>{{ currentBill?.billNo }}</span></el-form-item>
        <el-form-item label="应缴金额"><span>¥{{ Number(currentBill?.totalAmount || 0).toFixed(2) }}</span></el-form-item>
        <el-form-item label="收款金额" prop="amount">
          <el-input-number v-model="payForm.amount" :min="0" :precision="2" style="width:100%" />
        </el-form-item>
        <el-form-item label="收款渠道" prop="channel">
          <el-select v-model="payForm.channel" style="width:100%">
            <el-option label="银行转账" value="银行转账" /><el-option label="微信" value="微信" />
            <el-option label="支付宝" value="支付宝" /><el-option label="现金" value="现金" />
            <el-option label="POS刷卡" value="POS" /><el-option label="支票" value="支票" />
          </el-select>
        </el-form-item>
        <el-form-item label="交易号"><el-input v-model="payForm.transactionNo" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="payDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handlePay" :loading="paying">确认收款</el-button>
      </template>
    </el-dialog>

    <!-- 账单详情抽屉 -->
    <el-drawer title="账单详情" v-model="detailVisible" size="520px">
      <template v-if="billDetail">
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="账单编号">{{ billDetail.billNo }}</el-descriptions-item>
          <el-descriptions-item label="期间">{{ billDetail.period }}</el-descriptions-item>
          <el-descriptions-item label="总金额">¥{{ Number(billDetail.totalAmount).toFixed(2) }}</el-descriptions-item>
          <el-descriptions-item label="到期日">{{ billDetail.dueDate }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="billDetail.status === '已缴' ? 'success' : billDetail.status === '部分缴' ? 'warning' : billDetail.status === '逾期' ? 'danger' : 'info'" size="small">{{ billDetail.status }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="收款渠道">{{ billDetail.paymentChannel || '-' }}</el-descriptions-item>
          <el-descriptions-item label="租客">{{ billDetail.contract?.tenant?.name || '-' }}</el-descriptions-item>
          <el-descriptions-item label="房源">{{ billDetail.contract?.property?.name || '-' }}</el-descriptions-item>
          <el-descriptions-item label="合同编号">{{ billDetail.contract?.contractNo || '-' }}</el-descriptions-item>
          <el-descriptions-item label="基础租金">{{ '¥' + Number(billDetail.rentAmount || 0).toFixed(2) }}</el-descriptions-item>
          <el-descriptions-item label="水费">{{ '¥' + Number(billDetail.waterFee || 0).toFixed(2) }}</el-descriptions-item>
          <el-descriptions-item label="电费">{{ '¥' + Number(billDetail.electricFee || 0).toFixed(2) }}</el-descriptions-item>
          <el-descriptions-item label="物业费">{{ '¥' + Number(billDetail.propertyFee || 0).toFixed(2) }}</el-descriptions-item>
          <el-descriptions-item label="其他费用">{{ '¥' + Number(billDetail.otherAmount || 0).toFixed(2) }}</el-descriptions-item>
          <el-descriptions-item label="滞纳金">{{ '¥' + Number(billDetail.lateFee || 0).toFixed(2) }}</el-descriptions-item>
          <el-descriptions-item label="实缴日期">{{ billDetail.paidDate || '-' }}</el-descriptions-item>
        </el-descriptions>

        <h4 style="margin-top:20px">收款记录</h4>
        <el-table :data="billDetail.paymentRecords || []" size="small" empty-text="暂无收款记录">
          <el-table-column prop="amount" label="金额" width="120"><template #default="{ row }">¥{{ Number(row.amount).toFixed(2) }}</template></el-table-column>
          <el-table-column prop="channel" label="渠道" width="100" />
          <el-table-column prop="transactionNo" label="交易号" width="160" show-overflow-tooltip />
          <el-table-column prop="paidAt" label="收款时间" width="160"><template #default="{ row }">{{ row.paidAt?.slice(0, 16)?.replace('T', ' ') }}</template></el-table-column>
        </el-table>
      </template>
      <el-empty v-else description="加载中..." />
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { getBills, getBill, payBill, generateBills, createBill } from '@/api/bills';
import request from '@/api/request';

const loading = ref(false); const tableData = ref<any[]>([]);
const total = ref(0); const page = ref(1); const pageSize = ref(20);
const searchPeriod = ref(''); const filterStatus = ref('');
const payDialogVisible = ref(false); const paying = ref(false);
const currentBill = ref<any>(null);
const payForm = reactive({ amount: 0, channel: '银行转账', transactionNo: '' });
const detailVisible = ref(false);
const billDetail = ref<any>(null);

// ---- 手动创建账单 ----
const createVisible = ref(false); const creating = ref(false);
const contractOptions = ref<any[]>([]);
const createForm = reactive({
  contractId: null as number | null,
  period: '',
  dueDate: '',
  rentAmount: 0,
  waterFee: 0,
  electricFee: 0,
  propertyFee: 0,
  otherAmount: 0,
});
const computedCreateTotal = computed(() =>
  createForm.rentAmount + createForm.waterFee + createForm.electricFee + createForm.propertyFee + createForm.otherAmount
);

async function onCreateOpen() {
  contractOptions.value = [];
  createForm.contractId = null;
  createForm.period = '';
  createForm.dueDate = '';
  createForm.rentAmount = 0;
  createForm.waterFee = 0;
  createForm.electricFee = 0;
  createForm.propertyFee = 0;
  createForm.otherAmount = 0;
  try {
    const res = await request.get('/contracts', { params: { status: '执行中', pageSize: 500 } });
    contractOptions.value = res.data.list || [];
  } catch {}
}

async function showCreateDialog() {
  createVisible.value = true;
}

async function handleCreate() {
  if (!createForm.contractId || !createForm.period || !createForm.dueDate) {
    ElMessage.warning('请选择合同、账期和到期日');
    return;
  }
  creating.value = true;
  try {
    await createBill({ ...createForm });
    ElMessage.success('账单创建成功');
    createVisible.value = false;
    fetchData();
  } catch {} finally { creating.value = false; }
}

async function fetchData() {
  loading.value = true;
  try {
    const res = await getBills({
      page: page.value, pageSize: pageSize.value,
      period: searchPeriod.value || undefined,
      status: filterStatus.value || undefined,
    });
    tableData.value = res.data.list; total.value = res.data.total;
  } catch {} finally { loading.value = false; }
}

function showPayDialog(row: any) {
  currentBill.value = row;
  payForm.amount = Number(row.totalAmount);
  payForm.channel = '银行转账';
  payForm.transactionNo = '';
  payDialogVisible.value = true;
}

async function handlePay() {
  paying.value = true;
  try {
    await payBill(currentBill.value.id, { ...payForm });
    ElMessage.success('收款成功');
    payDialogVisible.value = false;
    fetchData();
  } catch {} finally { paying.value = false; }
}

async function showDetail(row: any) {
  detailVisible.value = true;
  billDetail.value = null;
  try {
    const res = await getBill(row.id);
    billDetail.value = res.data;
  } catch {
    billDetail.value = row; // 降级：展示列表中的行数据
  }
}

async function handleGenerate() {
  try { await generateBills(); ElMessage.success('账单生成已触发'); fetchData(); } catch {}
}

// ---- 批量操作 ----
const tableRef = ref();
const selectedRows = ref<any[]>([]);
const selectedIds = computed(() => selectedRows.value.map(r => r.id));

function clearSelection() { tableRef.value?.clearSelection(); }

async function batchDelete() {
  const total = selectedIds.value.length;
  try { await ElMessageBox.confirm(`确定批量删除 ${total} 条账单?`, '批量删除', { type: 'warning' }); } catch { return; }
  let done = 0; const skipped: string[] = [];
  for (const row of selectedRows.value) {
    try { await request.delete(`/bills/${row.id}`); done++; } catch { skipped.push(`${row.billNo}: 删除失败`); }
  }
  if (skipped.length > 0) {
    ElMessage.warning(`成功删除 ${done} 条，跳过 ${skipped.length} 条\n${skipped.slice(0, 5).join('；')}`);
  } else {
    ElMessage.success(`已删除 ${done} 条账单`);
  }
  clearSelection();
  fetchData();
}

onMounted(() => fetchData());
</script>

<style lang="scss" scoped>
.toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.search-group { display: flex; gap: 10px; align-items: center; }
.action-group { display: flex; gap: 10px; }
h4 { margin: 0 0 8px; color: #0A3D62; font-size: 14px; }
.batch-bar { display: flex; gap: 10px; align-items: center; padding: 8px 16px; margin-bottom: 12px; background: #ecf5ff; border-radius: 6px; border: 1px solid #b3d8ff; }
.batch-info { font-size: 13px; color: #409eff; font-weight: 600; margin-right: 8px; }
</style>
