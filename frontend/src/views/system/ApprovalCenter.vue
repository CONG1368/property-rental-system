<template>
  <div class="approval-page">
    <el-tabs v-model="tab">
      <el-tab-pane label="待我审批" name="pending">
        <DataTable :data="pending" :loading="loading" :columns="COLUMNS" row-key="id" empty-title="暂无数据" empty-description="调整筛选条件或新增记录后，数据会显示在这里">
          <template #c4="{ row }">{{ fmt(row.amount) }}</template>
          <template #c7="{ row }"><el-button size="small" type="success" @click="act(row, 'approve')">通过</el-button>
                      <el-button size="small" type="danger" @click="act(row, 'reject')">驳回</el-button></template>
        </DataTable>
      </el-tab-pane>
      <el-tab-pane label="我发起的" name="my">
        <DataTable :data="my" :loading="loading" :columns="COLUMNS_2" row-key="id">
          <template #c3="{ row }"><el-tag :type="statusTag(row.status)" size="small">{{ row.status }}</el-tag></template>
        </DataTable>
      </el-tab-pane>
    </el-tabs>

    <el-button type="primary" style="margin-bottom:14px" @click="openCreate">发起审批</el-button>

    <el-dialog title="发起审批" v-model="createVisible" width="520px">
      <el-form :model="form" label-width="90px">
        <el-form-item label="业务类型" required><el-select v-model="form.bizType" style="width:100%"><el-option v-for="t in bizTypes" :key="t" :label="t" :value="t" /></el-select></el-form-item>
        <el-form-item label="标题" required><el-input v-model="form.title" /></el-form-item>
        <el-form-item label="业务单号"><el-input v-model="form.bizNo" /></el-form-item>
        <el-form-item label="金额"><el-input-number v-model="form.amount" :min="0" :precision="2" style="width:100%" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="createVisible = false">取消</el-button><el-button type="primary" @click="submitRequest">提交</el-button></template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import DataTable from '@/components/base/DataTable.vue';
import type { TableColumn } from '@/components/base/types';

const COLUMNS_2: TableColumn[] = [
  { prop: 'title', label: '标题', minWidth: 160 },
  { prop: 'bizNo', label: '单号', width: 140 },
  { prop: 'status', label: '状态', width: 100, slot: 'c3' },
  { prop: 'currentRole', label: '当前节点', width: 100 },
  { prop: 'comment', label: '审批意见', minWidth: 160, tooltip: true },
];

const COLUMNS: TableColumn[] = [
  { prop: 'title', label: '标题', minWidth: 160 },
  { prop: 'bizType', label: '业务类型', width: 100 },
  { prop: 'bizNo', label: '业务单号', width: 140 },
  { prop: 'amount', label: '金额', width: 120, align: 'right', slot: 'c4' },
  { prop: 'applicantName', label: '申请人', width: 100 },
  { prop: 'currentRole', label: '当前节点', width: 100 },
  { label: '操作', width: 170, fixed: 'right', slot: 'c7' },
];

import { ref, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import request from '@/api/request';

const tab = ref('pending'); const loading = ref(false);
const pending = ref<any[]>([]); const my = ref<any[]>([]);
const createVisible = ref(false);
const form = ref({ bizType: '', title: '', bizNo: '', amount: 0 });
const bizTypes = ['合同', '预算', '费用', '退租', '装修', '采购'];
function fmt(v: any): string { return Number(v || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 }); }
function statusTag(s: string): string { return ({ '待审批': 'warning', '审批中': 'primary', '已通过': 'success', '已驳回': 'danger' } as Record<string, string>)[s] || 'info'; }

async function load() {
  loading.value = true;
  try {
    const p = await request.get('/approval-requests/pending', { silent: true });
    pending.value = p.data?.list || [];
    const m = await request.get('/approval-requests/my', { silent: true });
    my.value = m.data?.list || [];
  } catch { /* 静默 */ } finally { loading.value = false; }
}
async function act(row: any, mode: 'approve' | 'reject') {
  let comment = '';
  try {
    const r = await ElMessageBox.prompt(mode === 'approve' ? '通过审批' : '驳回审批', '审批意见', { inputPlaceholder: '请输入意见', confirmButtonText: '确定', cancelButtonText: '取消' });
    comment = r.value || '';
  } catch { return; }
  try { await request.post(`/approval-requests/${row.id}/${mode}`, { comment }); ElMessage.success('已处理'); load(); }
  catch (err: any) { ElMessage.error(err?.response?.data?.message || '操作失败'); }
}
function openCreate() { form.value = { bizType: '', title: '', bizNo: '', amount: 0 }; createVisible.value = true; }
async function submitRequest() {
  if (!form.value.bizType || !form.value.title) return ElMessage.warning('请填写类型与标题');
  try { await request.post('/approval-requests', form.value); ElMessage.success('已提交'); createVisible.value = false; load(); }
  catch (err: any) { ElMessage.error(err?.response?.data?.message || '提交失败'); }
}
onMounted(() => load());
</script>

<style lang="scss" scoped>.approval-page { padding: 0; }</style>