<template>
  <div class="template-list">
    <div class="toolbar">
      <h2 class="page-title">合同模板管理</h2>
      <el-button type="primary" @click="showDialog()">新增模板</el-button>
    </div>

    <!-- 批量操作栏 -->
    <div class="batch-bar" v-if="selectedIds.length > 0">
      <span class="batch-info">已选 {{ selectedIds.length }} 项</span>
      <el-button size="small" type="danger" @click="batchDelete">批量删除</el-button>
      <el-button size="small" @click="clearSelection">取消选择</el-button>
    </div>

    <el-table :data="tableData" stripe v-loading="loading" @selection-change="(rows: any[]) => selectedRows = rows" ref="tableRef">
      <el-table-column type="selection" width="45" />
      <el-table-column prop="name" label="模板名称" width="200" />
      <el-table-column prop="type" label="适用业态" width="120"><template #default="{ row }"><el-tag size="small">{{ row.type }}</el-tag></template></el-table-column>
      <el-table-column label="条款数" width="100"><template #default="{ row }">{{ row.clauses?.length || 0 }}</template></el-table-column>
      <el-table-column prop="createdAt" label="创建时间" width="170"><template #default="{ row }">{{ row.createdAt?.slice(0, 16)?.replace('T', ' ') }}</template></el-table-column>
      <el-table-column label="操作" width="240" fixed="right">
        <template #default="{ row }">
          <el-button size="small" @click="showDialog(row)">编辑</el-button>
          <el-button size="small" @click="showClauseDialog(row)">管理条款</el-button>
          <el-popconfirm title="确定删除?" @confirm="handleDelete(row.id)"><template #reference><el-button size="small" type="danger">删除</el-button></template></el-popconfirm>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog :title="dialogTitle" v-model="dialogVisible" width="600px">
      <el-form :model="form" :rules="rules" ref="formRef" label-width="100px">
        <el-form-item label="模板名称" prop="name"><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="适用业态" prop="type">
          <el-select v-model="form.type" style="width:100%"><el-option label="公寓" value="公寓" /><el-option label="厂房" value="厂房" /><el-option label="商铺" value="商铺" /></el-select>
        </el-form-item>
        <el-form-item label="模板内容" prop="content">
          <el-input v-model="form.content" type="textarea" :rows="10" placeholder="输入合同模板内容..." />
        </el-form-item>
      </el-form>
      <template #footer><el-button @click="dialogVisible = false">取消</el-button><el-button type="primary" @click="handleSubmit">确定</el-button></template>
    </el-dialog>

    <el-dialog title="条款管理" v-model="clauseDialogVisible" width="700px">
      <div style="margin-bottom:12px"><el-button type="primary" size="small" @click="addClause">添加条款</el-button></div>
      <el-table :data="clauseForm" stripe>
        <el-table-column label="标题" width="180"><template #default="{ row }"><el-input v-model="row.title" size="small" /></template></el-table-column>
        <el-table-column label="内容" min-width="280"><template #default="{ row }"><el-input v-model="row.content" type="textarea" size="small" :rows="2" /></template></el-table-column>
        <el-table-column label="排序" width="80"><template #default="{ row }"><el-input-number v-model="row.sortOrder" size="small" :min="0" /></template></el-table-column>
        <el-table-column label="操作" width="80"><template #default="{ $index }"><el-button type="danger" size="small" @click="clauseForm.splice($index, 1)">删除</el-button></template></el-table-column>
      </el-table>
      <template #footer><el-button @click="clauseDialogVisible = false">取消</el-button><el-button type="primary" @click="saveClauses">保存条款</el-button></template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import request from '@/api/request';

const tableData = ref<any[]>([]); const loading = ref(false);
const dialogVisible = ref(false); const formRef = ref(); const editingId = ref<number | null>(null);
const tableRef = ref();
const selectedRows = ref<any[]>([]);
const selectedIds = computed(() => selectedRows.value.map(r => r.id));
const dialogTitle = computed(() => editingId.value ? '编辑模板' : '新增模板');
const form = ref({ name: '', type: '公寓', content: '' });
const rules = { name: [{ required: true, message: '请输入模板名称', trigger: 'blur' }], type: [{ required: true, message: '请选择业态', trigger: 'change' }] };

const clauseDialogVisible = ref(false); const clauseForm = ref<any[]>([]); const currentTemplateId = ref<number | null>(null);

async function fetchData() {
  loading.value = true;
  try {
    const res = await request.get('/contract-templates');
    tableData.value = res.data?.list || [];
  } catch { /* ignore */ } finally { loading.value = false; }
}

function showDialog(row?: any) {
  editingId.value = row?.id || null;
  const contentStr = row?.content ? (typeof row.content === 'string' ? row.content : row.content.text || '') : '';
  form.value = row ? { name: row.name, type: row.type, content: contentStr } : { name: '', type: '公寓', content: '' };
  dialogVisible.value = true;
}

async function handleSubmit() {
  await formRef.value?.validate();
  try {
    if (editingId.value) { await request.put(`/contract-templates/${editingId.value}`, form.value); ElMessage.success('更新成功'); }
    else { await request.post('/contract-templates', form.value); ElMessage.success('创建成功'); }
    dialogVisible.value = false; fetchData();
  } catch (err: any) { ElMessage.error(err?.response?.data?.message || '操作失败'); }
}

async function handleDelete(id: number) { try { await request.delete(`/contract-templates/${id}`); ElMessage.success('已删除'); fetchData(); } catch (err: any) { ElMessage.error('删除失败: ' + (err?.response?.data?.message || '未知错误')); } }

function clearSelection() { tableRef.value?.clearSelection(); }

async function batchDelete() {
  const total = selectedIds.value.length;
  try { await ElMessageBox.confirm(`确定批量删除 ${total} 个模板? 此操作不可恢复!`, '批量删除', { type: 'warning' }); } catch { return; }
  let done = 0; const skipped: string[] = [];
  for (const row of selectedRows.value) {
    try { await request.delete(`/contract-templates/${row.id}`); done++; } catch { skipped.push(`${row.name}: 删除失败`); }
  }
  if (skipped.length > 0) {
    ElMessage.warning(`成功删除 ${done} 个，跳过 ${skipped.length} 个\n${skipped.slice(0, 5).join('；')}`);
  } else {
    ElMessage.success(`已删除 ${done} 个模板`);
  }
  clearSelection();
  fetchData();
}

async function showClauseDialog(row: any) {
  currentTemplateId.value = row.id;
  try {
    const res = await request.get(`/contract-templates/${row.id}`);
    clauseForm.value = (res.data?.clauses || []).map((c: any) => ({ id: c.id, title: c.title, content: c.content, sortOrder: c.sortOrder || 0 }));
  } catch { clauseForm.value = []; }
  clauseDialogVisible.value = true;
}

function addClause() { clauseForm.value.push({ title: '', content: '', sortOrder: clauseForm.value.length }); }

async function saveClauses() {
  try {
    await request.put(`/contract-templates/${currentTemplateId.value}/clauses`, { clauses: clauseForm.value });
    ElMessage.success('条款已保存'); clauseDialogVisible.value = false; fetchData();
  } catch (err: any) { ElMessage.error('保存失败'); }
}

onMounted(() => { fetchData(); });
</script>

<style lang="scss" scoped>
.page-title { font-size: 18px; font-weight: 700; color: #0A3D62; margin: 0; flex: 1; }
.toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.batch-bar { display: flex; gap: 10px; align-items: center; padding: 8px 16px; margin-bottom: 12px; background: #ecf5ff; border-radius: 6px; border: 1px solid #b3d8ff; }
.batch-info { font-size: 13px; color: #409eff; font-weight: 600; margin-right: 8px; }
</style>
