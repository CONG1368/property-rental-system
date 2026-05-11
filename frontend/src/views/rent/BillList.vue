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
        <el-button type="primary" @click="handleGenerate">生成账单</el-button>
      </div>
    </div>

    <el-table :data="tableData" stripe v-loading="loading">
      <el-table-column prop="billNo" label="账单编号" width="150" />
      <el-table-column prop="period" label="期间" width="90" />
      <el-table-column prop="totalAmount" label="总金额" width="120" />
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

    <el-dialog title="记录收款" v-model="payDialogVisible" width="450px">
      <el-form :model="payForm" ref="payFormRef" label-width="100px">
        <el-form-item label="账单编号"><span>{{ currentBill?.billNo }}</span></el-form-item>
        <el-form-item label="应缴金额"><span>{{ currentBill?.totalAmount }}</span></el-form-item>
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
        <el-form-item label="交易号" prop="transactionNo"><el-input v-model="payForm.transactionNo" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="payDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handlePay" :loading="paying">确认收款</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { getBills, payBill, generateBills } from '@/api/bills';

const loading = ref(false); const tableData = ref<any[]>([]);
const total = ref(0); const page = ref(1); const pageSize = ref(20);
const searchPeriod = ref(''); const filterStatus = ref('');
const payDialogVisible = ref(false); const paying = ref(false);
const currentBill = ref<any>(null);
const payForm = reactive({ amount: 0, channel: '银行转账', transactionNo: '' });

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

function showDetail(row: any) { /* TODO */ }

async function handleGenerate() {
  try { await generateBills(); ElMessage.success('账单生成已触发'); fetchData(); } catch {}
}

onMounted(() => fetchData());
</script>

<style lang="scss" scoped>
.toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.search-group { display: flex; gap: 10px; align-items: center; }
.action-group { display: flex; gap: 10px; }
</style>
