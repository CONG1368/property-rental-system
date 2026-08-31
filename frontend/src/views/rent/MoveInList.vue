<template>
  <div class="movein-page">
    <div class="toolbar">
      <div class="search-group">
        <el-select v-model="filterStatus" placeholder="交接状态" clearable style="width:140px" @change="fetchData">
          <el-option label="待交接" value="待交接" />
          <el-option label="已完成" value="已完成" />
        </el-select>
        <el-input v-model="keyword" placeholder="合同号/租客/房源" clearable style="width:200px" @keyup.enter="fetchData" @clear="fetchData" />
        <el-button type="primary" @click="fetchData">查询</el-button>
      </div>
      <div class="action-group">
        <el-button type="primary" @click="showDialog(null)">新增交接</el-button>
      </div>
    </div>

    <el-table :data="list" stripe v-loading="loading">
      <el-table-column label="合同号" width="130" show-overflow-tooltip><template #default="{ row }">{{ row.contract?.contractNo }}</template></el-table-column>
      <el-table-column label="租客" width="110"><template #default="{ row }">{{ row.tenant?.name }}</template></el-table-column>
      <el-table-column label="房源" min-width="150" show-overflow-tooltip><template #default="{ row }">{{ row.property?.name }}</template></el-table-column>
      <el-table-column label="入住日期" width="110"><template #default="{ row }">{{ row.moveInDate || '—' }}</template></el-table-column>
      <el-table-column label="押金" width="120" align="right"><template #default="{ row }">¥{{ fmt(row.depositAmount) }}</template></el-table-column>
      <el-table-column label="交接状态" width="100"><template #default="{ row }"><el-tag :type="row.status === '已完成' ? 'success' : 'warning'" size="small">{{ row.status }}</el-tag></template></el-table-column>
      <el-table-column label="操作" width="180" fixed="right">
        <template #default="{ row }">
          <el-button size="small" link type="success" v-if="row.status === '待交接'" @click="complete(row)">交接</el-button>
          <el-button size="small" link @click="showDialog(row)">编辑</el-button>
          <el-popconfirm title="确认删除?" @confirm="handleDelete(row.id)"><template #reference><el-button size="small" link type="danger">删除</el-button></template></el-popconfirm>
        </template>
      </el-table-column>
    </el-table>
    <el-pagination v-if="total > 0" style="margin-top:16px; justify-content:flex-end" v-model:current-page="page" :total="total" :page-size="pageSize" @current-change="fetchData" layout="total, prev, pager, next" />

    <el-dialog :title="editing ? '编辑入住交接' : '新增入住交接'" v-model="dialogVisible" width="620px" @closed="resetForm">
      <el-form :model="form" label-width="100px" size="small">
        <el-form-item label="关联合同" required>
          <el-select v-model="form.contractId" filterable style="width:100%" placeholder="选择执行中的合同" @change="onContractChange">
            <el-option v-for="c in contracts" :key="c.id" :label="`${c.contractNo}（${c.tenantName || ''}）`" :value="c.id" />
          </el-select>
        </el-form-item>
        <el-row :gutter="12">
          <el-col :span="12"><el-form-item label="租客"><el-input :model-value="tenantName" disabled /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="房源"><el-input :model-value="propertyName" disabled /></el-form-item></el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="12"><el-form-item label="入住日期"><el-date-picker v-model="form.moveInDate" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="押金"><el-input-number v-model="form.depositAmount" :min="0" :precision="2" style="width:100%" /></el-form-item></el-col>
        </el-row>
        <el-form-item label="交接清单">
          <div class="check-grid">
            <div v-for="c in form.checkItems" :key="c.item" class="check-row">
              <el-checkbox v-model="c.checked">{{ c.item }}</el-checkbox>
              <el-input v-if="needValue(c.item)" v-model="c.value" placeholder="底数" size="small" style="width:130px" />
            </div>
          </div>
        </el-form-item>
        <el-form-item label="备注"><el-input v-model="form.notes" type="textarea" :rows="2" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="dialogVisible = false">取消</el-button><el-button type="primary" @click="handleSave">{{ editing ? '保存' : '创建' }}</el-button></template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import request from '@/api/request';

const list = ref<any[]>([]); const loading = ref(false);
const page = ref(1); const pageSize = ref(20); const total = ref(0);
const filterStatus = ref(''); const keyword = ref('');
const contracts = ref<any[]>([]);

const dialogVisible = ref(false); const editing = ref(false);
const tenantName = ref(''); const propertyName = ref('');
const form = reactive<any>({ id: null, contractId: null, tenantId: null, propertyId: null, moveInDate: '', depositAmount: 0, checkItems: [] as any[], notes: '' });

// 交接清单固定项：前两项为抄表底数（需录入数值），其余为勾选项
const CHECK_ITEMS = [
  { item: '水表底数', hasValue: true },
  { item: '电表底数', hasValue: true },
  { item: '钥匙交接', hasValue: false },
  { item: '门禁卡', hasValue: false },
  { item: '家具家电完好', hasValue: false },
  { item: '房屋状况', hasValue: false },
];
function needValue(item: string): boolean { return CHECK_ITEMS.some(c => c.item === item && c.hasValue); }
function buildCheckItems(stored?: any[]): any[] {
  const map = new Map((parseCheckItems(stored)).map((c: any) => [c.item, c]));
  return CHECK_ITEMS.map(c => ({ item: c.item, checked: !!map.get(c.item)?.checked, value: map.get(c.item)?.value ?? '' }));
}
function parseCheckItems(v: any): any[] {
  if (Array.isArray(v)) return v;
  if (typeof v === 'string' && v) { try { return JSON.parse(v); } catch { return []; } }
  return [];
}

function fmt(v: any): string { return Number(v || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 }); }

async function fetchData() {
  loading.value = true;
  try {
    const params: any = { page: page.value, pageSize: pageSize.value };
    if (filterStatus.value) params.status = filterStatus.value;
    if (keyword.value) params.keyword = keyword.value;
    const res = await request.get('/move-ins', { params });
    list.value = res.data?.list || [];
    total.value = res.data?.total || 0;
  } catch { /* 静默 */ } finally { loading.value = false; }
}

async function loadContracts() {
  try {
    const res = await request.get('/contracts', { params: { pageSize: 200, status: '执行中' } });
    contracts.value = (res.data?.list || []).map((c: any) => ({ ...c, tenantName: c.tenant?.name || '', propertyName: c.property?.name || '' }));
  } catch { /* 静默 */ }
}

function onContractChange(id: number) {
  const c = contracts.value.find(x => x.id === id);
  if (!c) return;
  form.tenantId = c.tenantId;
  form.propertyId = c.propertyId;
  tenantName.value = c.tenant?.name || '';
  propertyName.value = c.property?.name || '';
  if (!form.depositAmount && Number(c.depositAmount) > 0) form.depositAmount = Number(c.depositAmount);
}

function showDialog(row: any) {
  editing.value = !!row;
  if (row) {
    Object.assign(form, {
      id: row.id, contractId: row.contractId, tenantId: row.tenantId, propertyId: row.propertyId,
      moveInDate: row.moveInDate || '', depositAmount: Number(row.depositAmount || 0),
      checkItems: buildCheckItems(row.checkItems), notes: row.notes || '',
    });
    tenantName.value = row.tenant?.name || '';
    propertyName.value = row.property?.name || '';
  } else {
    resetForm();
  }
  dialogVisible.value = true;
}

function resetForm() {
  Object.assign(form, { id: null, contractId: null, tenantId: null, propertyId: null, moveInDate: '', depositAmount: 0, checkItems: buildCheckItems(), notes: '' });
  tenantName.value = ''; propertyName.value = '';
}

async function handleSave() {
  if (!form.contractId) return ElMessage.warning('请选择合同');
  const payload: any = {
    contractId: form.contractId,
    moveInDate: form.moveInDate || null,
    depositAmount: form.depositAmount,
    checkItems: form.checkItems.filter((c: any) => c.checked || c.value !== ''),
    notes: form.notes,
  };
  try {
    if (editing.value) {
      await request.put(`/move-ins/${form.id}/update`, payload);
      ElMessage.success('已更新');
    } else {
      await request.post('/move-ins', payload);
      ElMessage.success('入住交接已创建');
    }
    dialogVisible.value = false; fetchData();
  } catch (err: any) { ElMessage.error(err?.response?.data?.message || '操作失败'); }
}

async function complete(row: any) {
  try { await ElMessageBox.confirm(`确认完成「${row.contract?.contractNo || ''}」的入住交接？`, '完成交接', { type: 'warning' }); } catch { return; }
  try {
    await request.post(`/move-ins/${row.id}/complete`, { moveInDate: row.moveInDate || new Date().toISOString().slice(0, 10) });
    ElMessage.success('交接已完成'); fetchData();
  } catch (err: any) { ElMessage.error(err?.response?.data?.message || '操作失败'); }
}

async function handleDelete(id: number) {
  try { await request.delete(`/move-ins/${id}`); ElMessage.success('已删除'); fetchData(); }
  catch (err: any) { ElMessage.error(err?.response?.data?.message || '操作失败'); }
}

onMounted(() => { fetchData(); loadContracts(); });
</script>

<style lang="scss" scoped>
.movein-page { padding: 0; }
.toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 8px; }
.search-group { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.action-group { display: flex; gap: 8px; }
.check-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 16px; width: 100%; }
.check-row { display: flex; align-items: center; gap: 8px; }
</style>
