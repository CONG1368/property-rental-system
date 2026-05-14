<template>
  <div class="tenant-list">
    <div class="toolbar">
      <div class="search-group">
        <el-input v-model="searchKeyword" placeholder="搜索姓名/手机号" clearable style="width:200px" @keyup.enter="fetchData" />
        <el-select v-model="filterGrade" placeholder="信用等级" clearable style="width:120px" @change="fetchData">
          <el-option label="A级" value="A" /><el-option label="B级" value="B" />
          <el-option label="C级" value="C" /><el-option label="D级" value="D" />
        </el-select>
        <el-select v-model="filterStatus" placeholder="状态" clearable style="width:120px" @change="fetchData">
          <el-option label="待入住" value="待入住" /><el-option label="在租中" value="在租中" /><el-option label="已退租" value="已退租" />
        </el-select>
        <el-button type="primary" @click="fetchData">查询</el-button>
      </div>
      <div class="action-group">
        <el-button type="primary" @click="showDialog()">新增租客</el-button>
      </div>
    </div>

    <!-- 批量操作栏 -->
    <div class="batch-bar" v-if="selectedIds.length > 0">
      <span class="batch-info">已选 {{ selectedIds.length }} 项</span>
      <el-button size="small" type="danger" @click="batchDelete">批量删除</el-button>
      <el-button size="small" @click="clearSelection">取消选择</el-button>
    </div>

    <el-table :data="tableData" stripe v-loading="loading" @row-click="onRowClick" @selection-change="(rows: any[]) => selectedRows = rows" style="cursor:pointer" ref="tableRef">
      <el-table-column type="selection" width="45" />
      <el-table-column prop="name" label="姓名" width="100" />
      <el-table-column label="证件类型" width="100"><template #default="{ row }">{{ idTypeLabel(row.idType) }}</template></el-table-column>
      <el-table-column prop="idNumber" label="证件号" width="180" show-overflow-tooltip />
      <el-table-column prop="phone" label="手机号" width="130" />
      <el-table-column label="信用评分" width="120"><template #default="{ row }"><el-tag :type="row.creditGrade === 'A' ? 'success' : row.creditGrade === 'B' ? '' : row.creditGrade === 'C' ? 'warning' : 'danger'" size="small">{{ row.creditScore || '-' }} ({{ row.creditGrade || '-' }})</el-tag></template></el-table-column>
      <el-table-column prop="status" label="状态" width="90"><template #default="{ row }"><el-tag :type="row.status === '在租中' ? 'success' : row.status === '待入住' ? 'warning' : 'info'" size="small">{{ row.status }}</el-tag></template></el-table-column>
      <el-table-column label="操作" width="200" fixed="right">
        <template #default="{ row }">
          <el-button size="small" @click.stop="showDialog(row)">编辑</el-button>
          <el-popconfirm title="确定删除该租客?" @confirm="handleDelete(row.id)"><template #reference><el-button size="small" type="danger" @click.stop>删除</el-button></template></el-popconfirm>
        </template>
      </el-table-column>
    </el-table>
    <el-pagination v-model:current-page="page" :total="total" :page-size="pageSize" @current-change="fetchData" layout="total, prev, pager, next" style="margin-top:16px; justify-content:flex-end" />

    <el-dialog :title="dialogTitle" v-model="dialogVisible" width="600px" @closed="resetForm">
      <el-form :model="form" :rules="rules" ref="formRef" label-width="100px">
        <el-form-item label="姓名" prop="name"><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="证件类型" prop="idType"><el-select v-model="form.idType" style="width:100%"><el-option label="身份证" value="身份证" /><el-option label="营业执照" value="营业执照" /><el-option label="护照" value="护照" /></el-select></el-form-item>
        <el-form-item label="证件号" prop="idNumber"><el-input v-model="form.idNumber" /></el-form-item>
        <el-form-item label="手机号" prop="phone"><el-input v-model="form.phone" /></el-form-item>
        <el-form-item label="邮箱"><el-input v-model="form.email" /></el-form-item>
        <el-form-item label="联系人"><el-input v-model="form.contactPerson" /></el-form-item>
        <el-form-item label="状态" prop="status"><el-select v-model="form.status" style="width:100%"><el-option label="待入住" value="待入住" /><el-option label="在租中" value="在租中" /><el-option label="已退租" value="已退租" /></el-select></el-form-item>
        <el-form-item label="备注"><el-input v-model="form.notes" type="textarea" :rows="2" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="dialogVisible = false">取消</el-button><el-button type="primary" @click="handleSubmit">确定</el-button></template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import request from '@/api/request';

const router = useRouter();
const tableData = ref<any[]>([]); const loading = ref(false);
const page = ref(1); const pageSize = ref(20); const total = ref(0);
const searchKeyword = ref(''); const filterGrade = ref(''); const filterStatus = ref('');
const dialogVisible = ref(false); const formRef = ref(); const editingId = ref<number | null>(null);
const dialogTitle = computed(() => editingId.value ? '编辑租客' : '新增租客');
const tableRef = ref();
const selectedRows = ref<any[]>([]);
const selectedIds = computed(() => selectedRows.value.map(r => r.id));

function idTypeLabel(v: string): string { return ({ '身份证': '身份证', '营业执照': '营业执照', '护照': '护照' } as Record<string, string>)[v] || v; }

const form = ref({ name: '', idType: '身份证', idNumber: '', phone: '', email: '', contactPerson: '', status: '待入住', notes: '' });
const rules = {
  name: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
  idType: [{ required: true, message: '请选择证件类型', trigger: 'change' }],
  idNumber: [{ required: true, message: '请输入证件号', trigger: 'blur' }],
  phone: [{ required: true, message: '请输入手机号', trigger: 'blur' }],
};

async function fetchData() {
  loading.value = true;
  try {
    const params: any = { page: page.value, pageSize: pageSize.value };
    if (searchKeyword.value) params.keyword = searchKeyword.value;
    if (filterGrade.value) params.creditGrade = filterGrade.value;
    if (filterStatus.value) params.status = filterStatus.value;
    const res = await request.get('/tenants', { params });
    tableData.value = res.data?.list || [];
    total.value = res.data?.total || 0;
  } catch { /* ignore */ } finally { loading.value = false; }
}

function showDialog(row?: any) {
  editingId.value = row?.id || null;
  if (row) { form.value = { name: row.name, idType: row.idType, idNumber: row.idNumber, phone: row.phone, email: row.email || '', contactPerson: row.contactPerson || '', status: row.status, notes: row.notes || '' }; }
  dialogVisible.value = true;
}

function resetForm() { editingId.value = null; form.value = { name: '', idType: '身份证', idNumber: '', phone: '', email: '', contactPerson: '', status: '待入住', notes: '' }; }

async function handleSubmit() {
  await formRef.value?.validate();
  try {
    if (editingId.value) { await request.put(`/tenants/${editingId.value}`, form.value); ElMessage.success('更新成功'); }
    else { await request.post('/tenants', form.value); ElMessage.success('创建成功'); }
    dialogVisible.value = false; fetchData();
  } catch (err: any) { ElMessage.error(err?.response?.data?.message || '操作失败'); }
}

async function handleDelete(id: number) {
  try { await request.delete(`/tenants/${id}`); ElMessage.success('已删除'); fetchData(); }
  catch (err: any) { ElMessage.error('删除失败: ' + (err?.response?.data?.message || '未知错误')); }
}

// ---- 行点击 ----
function onRowClick(row: any, _col: any, event: Event) {
  const t = event.target as HTMLElement;
  if (t?.closest('.el-checkbox') || t?.closest('.el-button') || t?.closest('.el-popconfirm')) return;
  router.push(`/rent/tenants/${row.id}`);
}

function clearSelection() { tableRef.value?.clearSelection(); }

// ---- 批量删除 ----
async function batchDelete() {
  const total = selectedIds.value.length;
  try { await ElMessageBox.confirm(`确定批量删除 ${total} 个租客? 此操作不可恢复!`, '批量删除', { type: 'warning' }); } catch { return; }
  let done = 0; const skipped: string[] = [];
  for (const row of selectedRows.value) {
    try { await request.delete(`/tenants/${row.id}`); done++; } catch { skipped.push(`${row.name}: 删除失败`); }
  }
  if (skipped.length > 0) {
    ElMessage.warning(`成功删除 ${done} 个，跳过 ${skipped.length} 个\n${skipped.slice(0, 5).join('；')}`);
  } else {
    ElMessage.success(`已删除 ${done} 个租客`);
  }
  clearSelection();
  fetchData();
}

onMounted(() => { fetchData(); });
</script>

<style lang="scss" scoped>
.tenant-list { padding: 0; }
.toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 8px; }
.search-group { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.action-group { display: flex; gap: 8px; }
.batch-bar {
  display: flex; gap: 10px; align-items: center;
  padding: 8px 16px; margin-bottom: 12px;
  background: #ecf5ff; border-radius: 6px; border: 1px solid #b3d8ff;
}
.batch-info { font-size: 13px; color: #409eff; font-weight: 600; margin-right: 8px; }
</style>
