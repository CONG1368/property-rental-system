<template>
  <div class="deposit-page">
    <el-row :gutter="16" class="stat-cards">
      <el-col :span="6"><div class="stat-card"><div class="stat-num">{{ stats.total }}</div><div class="stat-label">押金笔数</div></div></el-col>
      <el-col :span="6"><div class="stat-card"><div class="stat-num">{{ stats.inCustody }}</div><div class="stat-label">在管笔数</div></div></el-col>
      <el-col :span="6"><div class="stat-card"><div class="stat-num refund">{{ fmt(stats.refunded) }}</div><div class="stat-label">已退还金额</div></div></el-col>
      <el-col :span="6"><div class="stat-card"><div class="stat-num deduct">{{ fmt(stats.deducted) }}</div><div class="stat-label">已扣除金额</div></div></el-col>
    </el-row>

    <div class="toolbar">
      <div class="search-group">
        <el-input v-model="searchKeyword" placeholder="搜索租客/合同号" clearable style="width:220px" @keyup.enter="fetchData" />
        <el-select v-model="filterStatus" placeholder="状态" clearable style="width:130px" @change="fetchData">
          <el-option label="在管" value="在管" /><el-option label="部分退还" value="部分退还" />
          <el-option label="已退还" value="已退还" /><el-option label="已抵扣" value="已抵扣" />
        </el-select>
        <el-button type="primary" @click="fetchData">查询</el-button>
      </div>
      <div class="action-group">
        <el-button type="primary" @click="showCreate">登记押金</el-button>
      </div>
    </div>

    <TableSkeleton v-if="loading && !tableData.length" :rows="8" :columns="7" />
    <el-table v-show="!(loading && !tableData.length)" :data="tableData" stripe v-loading="loading">
      <el-table-column label="合同号" width="130" show-overflow-tooltip><template #default="{ row }">{{ row.contract?.contractNo }}</template></el-table-column>
      <el-table-column label="租客" width="110"><template #default="{ row }">{{ row.tenant?.name }}</template></el-table-column>
      <el-table-column label="房源" width="140" show-overflow-tooltip><template #default="{ row }">{{ row.property?.name }}</template></el-table-column>
      <el-table-column prop="amount" label="押金金额" width="120" align="right"><template #default="{ row }">{{ fmt(row.amount) }}</template></el-table-column>
      <el-table-column prop="refundedAmount" label="已退还" width="110" align="right"><template #default="{ row }">{{ fmt(row.refundedAmount) }}</template></el-table-column>
      <el-table-column prop="deductionAmount" label="已扣除" width="110" align="right"><template #default="{ row }">{{ fmt(row.deductionAmount) }}</template></el-table-column>
      <el-table-column label="可退余额" width="120" align="right"><template #default="{ row }"><b class="balance">{{ fmt(row.balance) }}</b></template></el-table-column>
      <el-table-column prop="status" label="状态" width="90"><template #default="{ row }"><el-tag :type="statusType(row.status)" size="small">{{ row.status }}</el-tag></template></el-table-column>
      <el-table-column label="操作" width="160" fixed="right">
        <template #default="{ row }">
          <el-button size="small" link :disabled="Number(row.balance) <= 0" @click="showDispose(row, 'refund')">退还</el-button>
          <el-button size="small" link :disabled="Number(row.balance) <= 0" @click="showDispose(row, 'deduct')">扣除</el-button>
          <el-button size="small" link @click="onDetail(row)">详情</el-button>
        </template>
      </el-table-column>
          <template #empty>
        <EmptyState title="暂无押金记录" description="合同签订并收取押金后，台账会在此显示" />
      </template>
    </el-table>
    <el-pagination v-model:current-page="page" :total="total" :page-size="pageSize" @current-change="fetchData" layout="total, prev, pager, next" style="margin-top:16px; justify-content:flex-end" />

    <!-- 新增押金 -->
    <el-dialog title="登记押金" v-model="createVisible" width="520px" @closed="resetCreate">
      <el-form :model="createForm" label-width="100px">
        <el-form-item label="关联合同" required>
          <el-select v-model="createForm.contractId" filterable style="width:100%" @change="onContractChange" placeholder="选择合同">
            <el-option v-for="c in contracts" :key="c.id" :label="`${c.contractNo}（${c.tenantName || ''}）`" :value="c.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="押金金额"><el-input-number v-model="createForm.amount" :min="0" :precision="2" style="width:100%" /></el-form-item>
        <el-form-item label="收款日期"><el-date-picker v-model="createForm.paidDate" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item>
        <el-form-item label="备注"><el-input v-model="createForm.notes" type="textarea" :rows="2" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="createVisible = false">取消</el-button><el-button type="primary" @click="handleCreate">提交</el-button></template>
    </el-dialog>

    <!-- 退还/扣除 -->
    <el-dialog :title="disposeMode === 'refund' ? '退还押金' : '扣除押金'" v-model="disposeVisible" width="460px">
      <el-form :model="disposeForm" label-width="100px">
        <el-form-item label="可退余额"><b>{{ fmt(disposeBalance) }}</b></el-form-item>
        <el-form-item label="金额"><el-input-number v-model="disposeForm.amount" :min="0" :max="disposeBalance" :precision="2" style="width:100%" /></el-form-item>
        <el-form-item label="日期"><el-date-picker v-model="disposeForm.date" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item>
        <el-form-item label="原因"><el-input v-model="disposeForm.reason" type="textarea" :rows="2" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="disposeVisible = false">取消</el-button><el-button type="primary" @click="handleDispose">确认</el-button></template>
    </el-dialog>

    <!-- 详情 -->
    <el-dialog title="押金详情" v-model="detailVisible" width="520px">
      <el-descriptions :column="1" border>
        <el-descriptions-item label="合同号">{{ current?.contract?.contractNo }}</el-descriptions-item>
        <el-descriptions-item label="租客">{{ current?.tenant?.name }}</el-descriptions-item>
        <el-descriptions-item label="房源">{{ current?.property?.name }}</el-descriptions-item>
        <el-descriptions-item label="押金金额">{{ fmt(current?.amount) }}</el-descriptions-item>
        <el-descriptions-item label="已退还">{{ fmt(current?.refundedAmount) }}（{{ current?.refundReason || '无记录' }}）</el-descriptions-item>
        <el-descriptions-item label="已扣除">{{ fmt(current?.deductionAmount) }}</el-descriptions-item>
        <el-descriptions-item label="状态">{{ current?.status }}</el-descriptions-item>
        <el-descriptions-item label="备注">{{ current?.notes || '—' }}</el-descriptions-item>
      </el-descriptions>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import request from '@/api/request';

const tableData = ref<any[]>([]); const loading = ref(false);
const page = ref(1); const pageSize = ref(20); const total = ref(0);
const searchKeyword = ref(''); const filterStatus = ref('');
const stats = ref({ total: 0, inCustody: 0, refunded: 0, deducted: 0 });
const contracts = ref<any[]>([]);

const createVisible = ref(false);
const createForm = ref({ contractId: null, amount: 0, paidDate: '', notes: '' });

const disposeVisible = ref(false); const disposeMode = ref<'refund' | 'deduct'>('refund');
const disposeForm = ref({ amount: 0, date: '', reason: '' }); const disposeId = ref<number | null>(null); const disposeBalance = ref(0);
const detailVisible = ref(false); const current = ref<any>(null);

function fmt(v: any): string { return Number(v || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 }); }
function statusType(s: string): string { return ({ '在管': 'success', '部分退还': 'warning', '已退还': 'info', '已抵扣': 'danger' } as Record<string, string>)[s] || 'info'; }

async function fetchData() {
  loading.value = true;
  try {
    const params: any = { page: page.value, pageSize: pageSize.value };
    if (searchKeyword.value) params.keyword = searchKeyword.value;
    if (filterStatus.value) params.status = filterStatus.value;
    const res = await request.get('/deposits', { params });
    tableData.value = res.data?.list || [];
    total.value = res.data?.total || 0;
    const s = await request.get('/deposits/stats');
    stats.value = s.data || { total: 0, inCustody: 0, refunded: 0, deducted: 0 };
  } catch { /* 静默 */ } finally { loading.value = false; }
}

async function loadContracts() {
  try {
    const res = await request.get('/contracts', { params: { pageSize: 200 } });
    contracts.value = (res.data?.list || []).map((c: any) => ({ ...c, tenantName: c.tenant?.name || c.tenantName || '' }));
  } catch { /* 静默 */ }
}

function showCreate() { createVisible.value = true; }
function onContractChange(id: number) {
  const c = contracts.value.find(x => x.id === id);
  if (c) { createForm.value.amount = Number(c.depositAmount || 0); }
}
function resetCreate() { createForm.value = { contractId: null, amount: 0, paidDate: '', notes: '' }; }

async function handleCreate() {
  if (!createForm.value.contractId) return ElMessage.warning('请选择关联合同');
  const c = contracts.value.find(x => x.id === createForm.value.contractId);
  if (!c) return ElMessage.error('未找到合同');
  try {
    await request.post('/deposits', {
      contractId: c.id, tenantId: c.tenantId, propertyId: c.propertyId,
      amount: createForm.value.amount, paidDate: createForm.value.paidDate || new Date().toISOString().slice(0, 10),
      notes: createForm.value.notes, status: '在管',
    });
    ElMessage.success('押金登记成功'); createVisible.value = false; fetchData();
  } catch (err: any) { ElMessage.error(err?.response?.data?.message || '操作失败'); }
}

function showDispose(row: any, mode: 'refund' | 'deduct') {
  disposeMode.value = mode; disposeId.value = row.id; disposeBalance.value = Number(row.balance);
  disposeForm.value = { amount: Number(row.balance), date: new Date().toISOString().slice(0, 10), reason: '' };
  disposeVisible.value = true;
}
async function handleDispose() {
  if (disposeForm.value.amount <= 0) return ElMessage.warning('请输入金额');
  try {
    const url = disposeMode.value === 'refund' ? `/deposits/${disposeId.value}/refund` : `/deposits/${disposeId.value}/deduct`;
    await request.post(url, { amount: disposeForm.value.amount, date: disposeForm.value.date, reason: disposeForm.value.reason });
    ElMessage.success(disposeMode.value === 'refund' ? '退还成功' : '扣除成功'); disposeVisible.value = false; fetchData();
  } catch (err: any) { ElMessage.error(err?.response?.data?.message || '操作失败'); }
}

function onDetail(row: any) { current.value = row; detailVisible.value = true; }

onMounted(() => { fetchData(); loadContracts(); });
</script>

<style lang="scss" scoped>
.deposit-page { padding: 0; }
.stat-cards { margin-bottom: 16px; }
.stat-card { background: #fff; border: 1px solid #ebeef5; border-radius: 8px; padding: 18px; text-align: center; }
.stat-num { font-size: 24px; font-weight: 700; color: #1f2430; }
.stat-num.refund { color: #409EFF; }
.stat-num.deduct { color: #E6A23C; }
.stat-label { margin-top: 6px; color: #909399; font-size: 13px; }
.toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 8px; }
.search-group { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.action-group { display: flex; gap: 8px; }
.balance { color: #E6A23C; }
</style>