<template>
  <div class="payment-record">
    <div class="toolbar">
      <div class="search-group">
        <el-input v-model="searchBillNo" placeholder="账单编号" clearable style="width:160px" @keyup.enter="fetchData" />
        <el-select v-model="filterChannel" placeholder="收款渠道" clearable style="width:130px" @change="fetchData">
          <el-option label="银行转账" value="银行转账" />
          <el-option label="微信" value="微信" />
          <el-option label="支付宝" value="支付宝" />
          <el-option label="现金" value="现金" />
          <el-option label="POS刷卡" value="POS" />
          <el-option label="支票" value="支票" />
        </el-select>
        <el-date-picker v-model="dateRange" type="daterange" range-separator="至" start-placeholder="开始日期" end-placeholder="结束日期" style="width:260px" @change="fetchData" />
        <el-button type="primary" @click="fetchData">查询</el-button>
      </div>
      <div class="action-group">
        <el-button type="primary" @click="showPayDialog()">记录收款</el-button>
      </div>
    </div>

    <DataTable :data="tableData" :loading="loading" :columns="COLUMNS" row-key="id" v-model:page="page" :total="total" :page-size="pageSize" @page-change="fetchData" empty-title="暂无数据" empty-description="调整筛选条件或新增记录后，数据会显示在这里">
      <template #c1="{ row }"><span v-if="row.bill">{{ row.bill.billNo }}</span></template>
      <template #c2="{ row }">¥{{ Number(row.amount).toFixed(2) }}</template>
      <template #c5="{ row }">{{ row.paidAt?.slice(0, 16)?.replace('T', ' ') }}</template>
    </DataTable>

    <el-dialog title="记录收款" v-model="payDialogVisible" width="500px">
      <el-form :model="payForm" ref="payFormRef" :rules="payRules" label-width="100px">
        <el-form-item label="账单编号" prop="billId">
          <el-select v-model="payForm.billId" placeholder="选择账单" filterable style="width:100%">
            <el-option v-for="b in unpaidBills" :key="b.id" :label="`${b.billNo} (¥${b.totalAmount})`" :value="b.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="收款金额" prop="amount">
          <el-input-number v-model="payForm.amount" :min="0.01" :precision="2" style="width:100%" />
        </el-form-item>
        <el-form-item label="收款渠道" prop="channel">
          <el-select v-model="payForm.channel" style="width:100%">
            <el-option label="银行转账" value="银行转账" />
            <el-option label="微信" value="微信" />
            <el-option label="支付宝" value="支付宝" />
            <el-option label="现金" value="现金" />
            <el-option label="POS刷卡" value="POS" />
            <el-option label="支票" value="支票" />
          </el-select>
        </el-form-item>
        <el-form-item label="交易号" prop="transactionNo">
          <el-input v-model="payForm.transactionNo" placeholder="银行流水号/微信订单号" />
        </el-form-item>
        <el-form-item label="备注" prop="notes">
          <el-input v-model="payForm.notes" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="payDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handlePay">确认收款</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import DataTable from '@/components/base/DataTable.vue';
import type { TableColumn } from '@/components/base/types';

const COLUMNS: TableColumn[] = [
  { label: '账单编号', width: 150, slot: 'c1' },
  { prop: 'amount', label: '收款金额', width: 130, slot: 'c2' },
  { prop: 'channel', label: '收款渠道', width: 110 },
  { prop: 'transactionNo', label: '交易号', width: 180, tooltip: true },
  { prop: 'paidAt', label: '收款时间', width: 170, slot: 'c5' },
  { prop: 'notes', label: '备注', minWidth: 150, tooltip: true },
];

import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import request from '@/api/request';

const tableData = ref<any[]>([]);
const loading = ref(false);
const page = ref(1);
const pageSize = ref(20);
const total = ref(0);

const searchBillNo = ref('');
const filterChannel = ref('');
const dateRange = ref<[Date, Date] | null>(null);

const payDialogVisible = ref(false);
const payFormRef = ref();
const payForm = ref({
  billId: null as number | null,
  amount: 0,
  channel: '银行转账',
  transactionNo: '',
  notes: '',
});
const unpaidBills = ref<any[]>([]);

const payRules = {
  billId: [{ required: true, message: '请选择账单', trigger: 'change' }],
  amount: [{ required: true, message: '请输入收款金额', trigger: 'blur' }],
  channel: [{ required: true, message: '请选择收款渠道', trigger: 'change' }],
};

async function fetchData() {
  loading.value = true;
  try {
    const params: any = { page: page.value, pageSize: pageSize.value };
    if (searchBillNo.value) params.keyword = searchBillNo.value;
    if (filterChannel.value) params.channel = filterChannel.value;
    if (dateRange.value) {
      params.startDate = dateRange.value[0].toISOString().slice(0, 10);
      params.endDate = dateRange.value[1].toISOString().slice(0, 10);
    }
    const res = await request.get('/payment-records', { params });
    tableData.value = res.data?.list || [];
    total.value = res.data?.total || 0;
  } catch { /* ignore */ }
  finally { loading.value = false; }
}

async function showPayDialog(existingBill?: any) {
  payForm.value = { billId: existingBill?.id || null, amount: existingBill ? Number(existingBill.totalAmount) : 0, channel: '银行转账', transactionNo: '', notes: '' };
  try {
    const res = await request.get('/bills', { params: { status: '未缴,部分缴', pageSize: 200 } });
    unpaidBills.value = res.data?.list || [];
  } catch { unpaidBills.value = []; }
  payDialogVisible.value = true;
}

async function handlePay() {
  await payFormRef.value?.validate();
  try {
    await request.post('/payment-records', payForm.value);
    ElMessage.success('收款记录已创建');
    payDialogVisible.value = false;
    fetchData();
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.message || '收款失败');
  }
}

onMounted(() => { fetchData(); });
</script>

<style lang="scss" scoped>
.payment-record { padding: 0; }
.toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 8px; }
.search-group { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.action-group { display: flex; gap: 8px; }
</style>
