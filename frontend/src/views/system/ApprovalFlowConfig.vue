<template>
  <div class="flow-page">
    <PageHeader title="审批流程配置" :breadcrumb="[{ label: '系统设置' }, { label: '审批流程' }]">
      <template #actions><el-button type="primary" @click="openCreate">新增流程</el-button></template>
    </PageHeader>

    <FilterBar v-model:keyword="keyword" placeholder="搜索流程名称/业务类型" :keyword-width="200" :show-reset="false" @search="load" />

    <DataTable :data="list" :loading="loading" :columns="COLUMNS" row-key="id" :skeleton-columns="5"
      empty-title="暂无审批流程" empty-description="未配置流程的业务类型会直接跳过审批，不会卡单">
      <template #steps="{ row }">
        <div v-for="s in (row.steps || [])" :key="s.order" class="step-item">{{ s.order + 1 }}. {{ s.role }}（{{ s.label }}）</div>
      </template>
      <template #ops="{ row }">
        <el-button size="small" link @click="openEdit(row)">编辑</el-button>
        <el-button size="small" link type="danger" @click="del(row.id)">删除</el-button>
      </template>
    </DataTable>

    <el-dialog :title="editId ? '编辑流程' : '新增流程'" v-model="dialogVisible" width="600px" @closed="resetForm">
      <el-form :model="form" label-width="90px">
        <el-form-item label="流程名称" required><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="业务类型" required>
          <el-select v-model="form.bizType" style="width:100%"><el-option v-for="t in bizTypes" :key="t" :label="t" :value="t" /></el-select>
        </el-form-item>
        <el-form-item label="审批节点">
          <div v-for="(s, i) in form.steps" :key="i" class="step-row">
            <span class="step-idx">{{ i + 1 }}</span>
            <el-input v-model="s.role" placeholder="角色" style="width:140px" />
            <el-input v-model="s.label" placeholder="节点名称" style="flex:1" />
            <el-button size="small" type="danger" link @click="form.steps.splice(i, 1)">删</el-button>
          </div>
          <el-button size="small" @click="form.steps.push({ order: form.steps.length, role: '', label: '' })">+ 添加节点</el-button>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="form.status" style="width:120px"><el-option label="启用" value="启用" /><el-option label="停用" value="停用" /></el-select>
        </el-form-item>
      </el-form>
      <template #footer><el-button @click="dialogVisible = false">取消</el-button><el-button type="primary" @click="submit">确定</el-button></template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import request from '@/api/request';
import PageHeader from '@/components/base/PageHeader.vue';
import FilterBar from '@/components/base/FilterBar.vue';
import DataTable from '@/components/base/DataTable.vue';
import type { TableColumn, StatusTagItem } from '@/components/base/types';

const FLOW_STATUS: Record<string, StatusTagItem> = { 启用: { type: 'success' }, 停用: { type: 'info' } };
const COLUMNS: TableColumn[] = [
  { prop: 'name', label: '流程名称', width: 160 }, { prop: 'bizType', label: '业务类型', width: 110 },
  { label: '审批节点', minWidth: 260, slot: 'steps' }, { prop: 'status', label: '状态', width: 80, type: 'status', statusMap: FLOW_STATUS },
  { label: '操作', width: 120, fixed: 'right', slot: 'ops' },
];

const list = ref<any[]>([]); const loading = ref(false); const keyword = ref('');
const dialogVisible = ref(false); const editId = ref<number | null>(null);

const bizTypes = ['合同', '预算', '费用', '退租', '装修', '采购'];
const emptyForm = () => ({ name: '', bizType: '合同', steps: [{ order: 0, role: '合同主管', label: '初审' }] as any[], status: '启用' });
const form = ref<any>(emptyForm());

async function load() {
  loading.value = true;
  try { const r = await request.get('/approval-flows', { params: { keyword: keyword.value || undefined }, silent: true }); list.value = r.data?.list || []; }
  catch { /* ignore */ } finally { loading.value = false; }
}
function resetForm() { editId.value = null; form.value = emptyForm(); }
function openCreate() { resetForm(); dialogVisible.value = true; }
function openEdit(row: any) { editId.value = row.id; form.value = { name: row.name, bizType: row.bizType, steps: (row.steps || []).map((s: any) => ({ ...s })), status: row.status }; dialogVisible.value = true; }
async function submit() {
  if (!form.value.name) return ElMessage.warning('请输入流程名称');
  const steps = form.value.steps.map((s: any, i: number) => ({ order: i, role: s.role, label: s.label }));
  try {
    if (editId.value) { await request.put('/approval-flows/' + editId.value, { ...form.value, steps }); ElMessage.success('更新成功'); }
    else { await request.post('/approval-flows', { ...form.value, steps }); ElMessage.success('创建成功'); }
    dialogVisible.value = false; load();
  } catch (err: any) { ElMessage.error(err?.response?.data?.message || '操作失败'); }
}
async function del(id: number) { try { await request.delete('/approval-flows/' + id); ElMessage.success('已删除'); load(); } catch { ElMessage.error('删除失败'); } }
onMounted(() => load());
</script>

<style lang="scss" scoped>
.step-item { line-height: 1.9; }
.step-row { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; }
.step-idx { width: 18px; color: $n-600; }
</style>
