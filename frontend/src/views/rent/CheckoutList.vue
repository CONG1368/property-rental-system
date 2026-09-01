<template>
  <div class="checkout-page">
    <div class="toolbar">
      <div class="search-group">
        <el-select v-model="filterStatus" placeholder="状态" clearable style="width:140px" @change="fetchData">
          <el-option label="待处理" value="待处理" /><el-option label="已受理" value="已受理" />
          <el-option label="交接中" value="交接中" /><el-option label="已完成" value="已完成" />
          <el-option label="已取消" value="已取消" />
        </el-select>
        <el-button type="primary" @click="fetchData">查询</el-button>
      </div>
      <div class="action-group"><el-button type="primary" @click="showCreate">提交退租申请</el-button></div>
    </div>

    <TableSkeleton v-if="loading && !tableData.length" :rows="8" :columns="7" />
    <el-table v-show="!(loading && !tableData.length)" :data="tableData" stripe v-loading="loading">
      <el-table-column label="合同号" width="130" show-overflow-tooltip><template #default="{ row }">{{ row.contract?.contractNo }}</template></el-table-column>
      <el-table-column label="租客" width="110"><template #default="{ row }">{{ row.tenant?.name }}</template></el-table-column>
      <el-table-column label="房源" width="150" show-overflow-tooltip><template #default="{ row }">{{ row.property?.name }}</template></el-table-column>
      <el-table-column prop="applyDate" label="申请日期" width="110" />
      <el-table-column prop="reason" label="退租原因" min-width="140" show-overflow-tooltip />
      <el-table-column prop="status" label="状态" width="90"><template #default="{ row }"><el-tag :type="statusType(row.status)" size="small">{{ row.status }}</el-tag></template></el-table-column>
      <el-table-column label="操作" width="220" fixed="right">
        <template #default="{ row }">
          <el-button size="small" link v-if="row.status === '待处理'" @click="advance(row, '已受理')">受理</el-button>
          <el-button size="small" link v-if="row.status === '已受理'" @click="advance(row, '交接中')">开始交接</el-button>
          <el-button size="small" link type="success" v-if="row.status === '交接中'" @click="onDetail(row)">完成</el-button>
          <el-button size="small" link type="danger" v-if="row.status === '待处理'" @click="advance(row, '已取消')">取消</el-button>
          <el-button size="small" link @click="onDetail(row)">详情</el-button>
        </template>
      </el-table-column>
          <template #empty>
        <EmptyState title="暂无退租单" description="发起退租流程后可在此跟踪交接与押金结算" />
      </template>
    </el-table>
    <el-pagination v-model:current-page="page" :total="total" :page-size="pageSize" @current-change="fetchData" layout="total, prev, pager, next" style="margin-top:16px; justify-content:flex-end" />

    <!-- 申请退租 -->
    <el-dialog title="提交退租申请" v-model="createVisible" width="520px" @closed="resetCreate">
      <el-form :model="createForm" label-width="100px">
        <el-form-item label="关联合同" required>
          <el-select v-model="createForm.contractId" filterable style="width:100%" placeholder="选择执行中的合同" @change="onContractChange">
            <el-option v-for="c in contracts" :key="c.id" :label="`${c.contractNo}（${c.tenantName || ''}）`" :value="c.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="申请日期"><el-date-picker v-model="createForm.applyDate" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item>
        <el-form-item label="退租原因"><el-input v-model="createForm.reason" type="textarea" :rows="3" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="createVisible = false">取消</el-button><el-button type="primary" @click="handleCreate">提交</el-button></template>
    </el-dialog>

    <!-- 详情/交接/完成 -->
    <el-dialog title="退租单处理" v-model="detailVisible" width="640px">
      <template v-if="current">
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="合同号">{{ current.contract?.contractNo }}</el-descriptions-item>
          <el-descriptions-item label="租客">{{ current.tenant?.name }}</el-descriptions-item>
          <el-descriptions-item label="房源">{{ current.property?.name }}</el-descriptions-item>
          <el-descriptions-item label="状态">{{ current.status }}</el-descriptions-item>
          <el-descriptions-item label="申请日期">{{ current.applyDate }}</el-descriptions-item>
          <el-descriptions-item label="交接日期">{{ current.handoverDate || '—' }}</el-descriptions-item>
        </el-descriptions>

        <el-divider content-position="left">交接清单</el-divider>
        <div v-for="(item, i) in detailChecklist" :key="i" class="check-item">
          <el-checkbox v-model="item.ok" :disabled="current.status === '已完成'">{{ item.item }}</el-checkbox>
          <el-button size="small" link type="danger" v-if="current.status !== '已完成'" @click="detailChecklist.splice(i,1)">移除</el-button>
        </div>
        <div class="check-add" v-if="current.status !== '已完成'">
          <el-input v-model="newCheckItem" placeholder="新增交接项" size="small" style="width:200px" />
          <el-button size="small" @click="detailChecklist.push({ item: newCheckItem, ok: false }); newCheckItem = ''">添加</el-button>
        </div>

        <el-divider content-position="left">费用清算</el-divider>
        <el-table :data="detailCosts" size="small" border>
          <el-table-column prop="name" label="项目" />
          <el-table-column prop="type" label="类型" width="90" />
          <el-table-column prop="amount" label="金额" width="110" align="right"><template #default="{ row }">{{ fmt(row.amount) }}</template></el-table-column>
        </el-table>
        <div class="check-add" v-if="current.status !== '已完成'">
          <el-input v-model="newCost.name" placeholder="项目" size="small" style="width:120px" />
          <el-select v-model="newCost.type" size="small" style="width:110px"><el-option label="扣除" value="扣除" /><el-option label="退还" value="退还" /></el-select>
          <el-input-number v-model="newCost.amount" :min="0" :precision="2" size="small" />
          <el-button size="small" @click="detailCosts.push({ ...newCost }); newCost = { name:'', type:'扣除', amount:0 }">添加</el-button>
        </div>

        <el-divider content-position="left">押金退还</el-divider>
        <el-form label-width="90px" size="small">
          <el-form-item label="退还金额"><el-input-number v-model="depositRefund" :min="0" :precision="2" :disabled="current.status === '已完成'" /></el-form-item>
        </el-form>

        <div class="complete-bar" v-if="current.status === '交接中'">
          <el-button type="success" @click="doComplete">完成退租结算</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import request from '@/api/request';

const tableData = ref<any[]>([]); const loading = ref(false);
const page = ref(1); const pageSize = ref(20); const total = ref(0);
const filterStatus = ref('');
const contracts = ref<any[]>([]);

const createVisible = ref(false);
const createForm = ref({ contractId: null, applyDate: '', reason: '' });

const detailVisible = ref(false); const current = ref<any>(null);
const detailChecklist = ref<any[]>([]); const detailCosts = ref<any[]>([]);
const depositRefund = ref(0); const newCheckItem = ref(''); const newCost = ref({ name: '', type: '扣除', amount: 0 });

function fmt(v: any): string { return Number(v || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 }); }
function statusType(s: string): string { return ({ '待处理': 'warning', '已受理': 'primary', '交接中': '', '已完成': 'success', '已取消': 'info' } as Record<string, string>)[s] || 'info'; }

async function fetchData() {
  loading.value = true;
  try {
    const params: any = { page: page.value, pageSize: pageSize.value };
    if (filterStatus.value) params.status = filterStatus.value;
    const res = await request.get('/checkouts', { params });
    tableData.value = res.data?.list || [];
    total.value = res.data?.total || 0;
  } catch { /* 静默 */ } finally { loading.value = false; }
}

async function loadContracts() {
  try {
    const res = await request.get('/contracts', { params: { pageSize: 200, status: '执行中' } });
    contracts.value = (res.data?.list || []).map((c: any) => ({ ...c, tenantName: c.tenant?.name || '' }));
  } catch { /* 静默 */ }
}

function showCreate() { createVisible.value = true; }
function onContractChange(id: number) { const c = contracts.value.find(x => x.id === id); if (c) { createForm.value.applyDate = new Date().toISOString().slice(0, 10); } }
function resetCreate() { createForm.value = { contractId: null, applyDate: '', reason: '' }; }

async function handleCreate() {
  if (!createForm.value.contractId) return ElMessage.warning('请选择合同');
  const c = contracts.value.find(x => x.id === createForm.value.contractId);
  if (!c) return ElMessage.error('未找到合同');
  try {
    await request.post('/checkouts', {
      contractId: c.id, tenantId: c.tenantId, propertyId: c.propertyId,
      applyDate: createForm.value.applyDate || new Date().toISOString().slice(0, 10),
      reason: createForm.value.reason,
    });
    ElMessage.success('退租申请已提交'); createVisible.value = false; fetchData();
  } catch (err: any) { ElMessage.error(err?.response?.data?.message || '操作失败'); }
}

async function advance(row: any, status: string) {
  try {
    await request.put(`/checkouts/${row.id}/status`, { status });
    ElMessage.success('已更新'); fetchData();
  } catch (err: any) { ElMessage.error(err?.response?.data?.message || '操作失败'); }
}

function onDetail(row: any) {
  current.value = row;
  detailChecklist.value = Array.isArray(row.checklist) ? row.checklist.map((c: any) => ({ ...c })) : [];
  detailCosts.value = Array.isArray(row.costs) ? row.costs.map((c: any) => ({ ...c })) : [];
  depositRefund.value = Number(row.depositRefundAmount || 0);
  detailVisible.value = true;
}

async function saveProgress() {
  try {
    await request.put(`/checkouts/${current.value.id}/status`, { status: current.value.status, checklist: detailChecklist.value, costs: detailCosts.value, handoverDate: current.value.handoverDate });
    return true;
  } catch { ElMessage.error('保存失败'); return false; }
}

async function doComplete() {
  try { await ElMessageBox.confirm('确认完成退租结算？将终止合同、租客设为退租、房源转为待保洁。', '结清退租', { type: 'warning' }); } catch { return; }
  const ok = await saveProgress();
  if (!ok) return;
  try {
    await request.post(`/checkouts/${current.value.id}/complete`, { handoverDate: new Date().toISOString().slice(0, 10), depositRefundAmount: depositRefund.value, checklist: detailChecklist.value, costs: detailCosts.value });
    ElMessage.success('退租流程已完成'); detailVisible.value = false; fetchData();
  } catch (err: any) { ElMessage.error(err?.response?.data?.message || '操作失败'); }
}

onMounted(() => { fetchData(); loadContracts(); });
</script>

<style lang="scss" scoped>
.checkout-page { padding: 0; }
.toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 8px; }
.search-group { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.action-group { display: flex; gap: 8px; }
.check-item { margin-bottom: 6px; display: flex; align-items: center; gap: 8px; }
.check-add { margin-top: 8px; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.complete-bar { margin-top: 20px; text-align: right; }
</style>