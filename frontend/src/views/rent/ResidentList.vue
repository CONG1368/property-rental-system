<template>
  <div class="resident-page">
    <el-row :gutter="16" class="stat-cards">
      <el-col :span="6"><div class="stat-card"><div class="stat-num">{{ stats.total }}</div><div class="stat-label">档案总数</div></div></el-col>
      <el-col :span="6"><div class="stat-card"><div class="stat-num owner">{{ stats.owners }}</div><div class="stat-label">业主</div></div></el-col>
      <el-col :span="6"><div class="stat-card"><div class="stat-num live">{{ stats.residents }}</div><div class="stat-label">在住</div></div></el-col>
      <el-col :span="6"><div class="stat-card"><div class="stat-num moved">{{ stats.moved }}</div><div class="stat-label">已搬离</div></div></el-col>
    </el-row>

    <div class="toolbar">
      <div class="search-group">
        <el-input v-model="searchKeyword" placeholder="搜索姓名/手机/证件" clearable style="width:200px" @keyup.enter="fetchData" />
        <el-select v-model="filterType" placeholder="类型" clearable style="width:110px" @change="fetchData"><el-option label="业主" value="业主" /><el-option label="住户" value="住户" /><el-option label="家属" value="家属" /></el-select>
        <el-select v-model="filterStatus" placeholder="状态" clearable style="width:110px" @change="fetchData"><el-option label="在住" value="在住" /><el-option label="已搬离" value="已搬离" /></el-select>
        <el-button type="primary" @click="fetchData">查询</el-button>
      </div>
      <div class="action-group"><el-button type="primary" @click="showCreate">新增档案</el-button></div>
    </div>

    <el-table :data="tableData" stripe v-loading="loading">
      <el-table-column prop="name" label="姓名" width="110" />
      <el-table-column label="类型" width="80"><template #default="{ row }"><el-tag :type="row.isOwner ? 'warning' : 'primary'" size="small">{{ row.type }}</el-tag></template></el-table-column>
      <el-table-column label="关联房源" width="150" show-overflow-tooltip><template #default="{ row }">{{ row.property?.name }}</template></el-table-column>
      <el-table-column prop="phone" label="手机号" width="130" />
      <el-table-column prop="idNumber" label="证件号" width="180" show-overflow-tooltip />
      <el-table-column prop="relation" label="与业主关系" width="100" />
      <el-table-column prop="status" label="状态" width="80"><template #default="{ row }"><el-tag :type="row.status === '在住' ? 'success' : 'info'" size="small">{{ row.status }}</el-tag></template></el-table-column>
      <el-table-column label="操作" width="130" fixed="right">
        <template #default="{ row }"><el-button size="small" link @click="showEdit(row)">编辑</el-button><el-button size="small" link type="danger" @click="del(row.id)">删除</el-button></template>
      </el-table-column>
    </el-table>
    <el-pagination v-model:current-page="page" :total="total" :page-size="pageSize" @current-change="fetchData" layout="total, prev, pager, next" style="margin-top:16px; justify-content:flex-end" />

    <el-dialog :title="editId ? '编辑档案' : '新增档案'" v-model="dialogVisible" width="560px" @closed="resetForm">
      <el-form :model="form" label-width="100px">
        <el-form-item label="姓名" required><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="类型"><el-select v-model="form.type" style="width:100%"><el-option label="业主" value="业主" /><el-option label="住户" value="住户" /><el-option label="家属" value="家属" /></el-select></el-form-item>
        <el-form-item label="关联房源"><el-select v-model="form.propertyId" filterable clearable style="width:100%"><el-option v-for="p in properties" :key="p.id" :label="p.name" :value="p.id" /></el-select></el-form-item>
        <el-form-item label="手机号"><el-input v-model="form.phone" /></el-form-item>
        <el-form-item label="证件类型"><el-select v-model="form.idType" style="width:100%"><el-option label="身份证" value="身份证" /><el-option label="护照" value="护照" /><el-option label="营业执照" value="营业执照" /></el-select></el-form-item>
        <el-form-item label="证件号" required><el-input v-model="form.idNumber" /></el-form-item>
        <el-form-item label="是否业主"><el-switch v-model="form.isOwner" /></el-form-item>
        <el-form-item label="关系"><el-input v-model="form.relation" /></el-form-item>
        <el-form-item label="公司"><el-input v-model="form.company" /></el-form-item>
        <el-form-item label="入住日期"><el-date-picker v-model="form.moveInDate" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item>
        <el-form-item label="状态"><el-select v-model="form.status" style="width:100%"><el-option label="在住" value="在住" /><el-option label="已搬离" value="已搬离" /></el-select></el-form-item>
        <el-form-item label="备注"><el-input v-model="form.notes" type="textarea" :rows="2" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="dialogVisible = false">取消</el-button><el-button type="primary" @click="handleSubmit">确定</el-button></template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import request from '@/api/request';

const tableData = ref<any[]>([]); const loading = ref(false);
const page = ref(1); const pageSize = ref(20); const total = ref(0);
const searchKeyword = ref(''); const filterType = ref(''); const filterStatus = ref('');
const stats = ref({ total: 0, owners: 0, residents: 0, moved: 0 });
const properties = ref<any[]>([]);
const dialogVisible = ref(false); const editId = ref<number | null>(null);
const form = ref({ name: '', type: '业主', propertyId: null, phone: '', idType: '身份证', idNumber: '', isOwner: true, relation: '', company: '', moveInDate: '', status: '在住', notes: '' });

async function fetchData() {
  loading.value = true;
  try {
    const params: any = { page: page.value, pageSize: pageSize.value };
    if (searchKeyword.value) params.keyword = searchKeyword.value;
    if (filterType.value) params.type = filterType.value;
    if (filterStatus.value) params.status = filterStatus.value;
    const res = await request.get('/residents', { params });
    tableData.value = res.data?.list || []; total.value = res.data?.total || 0;
    const s = await request.get('/residents/stats'); stats.value = s.data || { total: 0, owners: 0, residents: 0, moved: 0 };
  } catch { /* 静默 */ } finally { loading.value = false; }
}
async function loadProps() {
  try { const res = await request.get('/properties', { params: { pageSize: 200 } }); properties.value = res.data?.list || []; } catch { /* 静默 */ }
}
function resetForm() { editId.value = null; form.value = { name: '', type: '业主', propertyId: null, phone: '', idType: '身份证', idNumber: '', isOwner: true, relation: '', company: '', moveInDate: '', status: '在住', notes: '' }; }
function showCreate() { resetForm(); dialogVisible.value = true; }
function showEdit(row: any) { editId.value = row.id; form.value = { name: row.name, type: row.type, propertyId: row.propertyId, phone: row.phone || '', idType: row.idType, idNumber: row.idNumber, isOwner: row.isOwner, relation: row.relation || '', company: row.company || '', moveInDate: row.moveInDate || '', status: row.status, notes: row.notes || '' }; dialogVisible.value = true; }
async function handleSubmit() {
  if (!form.value.name) return ElMessage.warning('请输入姓名');
  if (!form.value.idNumber) return ElMessage.warning('请输入证件号');
  try {
    if (editId.value) { await request.put(`/residents/${editId.value}`, form.value); ElMessage.success('更新成功'); }
    else { await request.post('/residents', form.value); ElMessage.success('创建成功'); }
    dialogVisible.value = false; fetchData();
  } catch (err: any) { ElMessage.error(err?.response?.data?.message || '操作失败'); }
}
async function del(id: number) {
  try { await ElMessageBox.confirm('确定删除该档案?', '删除', { type: 'warning' }); } catch { return; }
  try { await request.delete(`/residents/${id}`); ElMessage.success('已删除'); fetchData(); } catch (err: any) { ElMessage.error('删除失败'); }
}
onMounted(() => { fetchData(); loadProps(); });
</script>

<style lang="scss" scoped>
.resident-page { padding: 0; }
.stat-cards { margin-bottom: 16px; }
.stat-card { background: #fff; border: 1px solid #ebeef5; border-radius: 8px; padding: 18px; text-align: center; }
.stat-num { font-size: 24px; font-weight: 700; color: #1f2430; }
.stat-num.owner { color: #E6A23C; }
.stat-num.live { color: #67C23A; }
.stat-num.moved { color: #909399; }
.stat-label { margin-top: 6px; color: #909399; font-size: 13px; }
.toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 8px; }
.search-group { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.action-group { display: flex; gap: 8px; }
</style>