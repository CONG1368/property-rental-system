<template>
  <div class="project-page">
    <el-row :gutter="16" class="stat-cards">
      <el-col :span="6"><div class="stat-card"><div class="stat-num">{{ overview.length }}</div><div class="stat-label">项目总数</div></div></el-col>
      <el-col :span="6"><div class="stat-card"><div class="stat-num running">{{ runningCount }}</div><div class="stat-label">运营中</div></div></el-col>
      <el-col :span="6"><div class="stat-card"><div class="stat-num">{{ totalProps }}</div><div class="stat-label">房源总数</div></div></el-col>
      <el-col :span="6"><div class="stat-card"><div class="stat-num live">{{ avgRate }}%</div><div class="stat-label">平均入住率</div></div></el-col>
    </el-row>

    <div class="toolbar">
      <div class="search-group">
        <el-input v-model="searchKeyword" placeholder="搜索项目名称/编码" clearable style="width:200px" @keyup.enter="fetchData" />
        <el-select v-model="filterStatus" placeholder="状态" clearable style="width:130px" @change="fetchData"><el-option label="运营中" value="运营中" /><el-option label="筹备中" value="筹备中" /><el-option label="已停用" value="已停用" /></el-select>
        <el-button type="primary" @click="fetchData">查询</el-button>
      </div>
      <div class="action-group"><el-button type="primary" @click="showCreate">新增项目</el-button></div>
    </div>

    <DataTable :data="tableData" :loading="loading" :columns="COLUMNS" row-key="id" v-model:page="page" :total="total" :page-size="pageSize" @page-change="fetchData" empty-title="暂无数据" empty-description="调整筛选条件或新增记录后，数据会显示在这里">
      <template #c3="{ row }"><el-tag size="small">{{ row.type }}</el-tag></template>
      <template #c6="{ row }"><el-tag :type="row.status === '运营中' ? 'success' : row.status === '筹备中' ? 'warning' : 'info'" size="small">{{ row.status }}</el-tag></template>
      <template #c7="{ row }">{{ row.propertyCount }} / {{ row.rentedCount }}</template>
      <template #c8="{ row }">{{ row.propertyCount ? Math.round(row.rentedCount / row.propertyCount * 100) : 0 }}%</template>
      <template #c9="{ row }"><el-button size="small" link @click="showEdit(row)">编辑</el-button><el-button size="small" link type="danger" @click="del(row.id)">删除</el-button></template>
    </DataTable>

    <el-dialog :title="editId ? '编辑项目' : '新增项目'" v-model="dialogVisible" width="560px" @closed="resetForm">
      <el-form :model="form" label-width="90px">
        <el-form-item label="项目名称" required><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="编码"><el-input v-model="form.code" /></el-form-item>
        <el-form-item label="类型"><el-select v-model="form.type" style="width:100%"><el-option label="产业园" value="产业园" /><el-option label="写字楼" value="写字楼" /><el-option label="住宅" value="住宅" /><el-option label="商业综合体" value="商业综合体" /><el-option label="厂房" value="厂房" /><el-option label="公寓" value="公寓" /></el-select></el-form-item>
        <el-form-item label="地址"><el-input v-model="form.address" /></el-form-item>
        <el-form-item label="负责人"><el-input v-model="form.managerName" /></el-form-item>
        <el-form-item label="联系电话"><el-input v-model="form.managerPhone" /></el-form-item>
        <el-form-item label="状态"><el-select v-model="form.status" style="width:100%"><el-option label="运营中" value="运营中" /><el-option label="筹备中" value="筹备中" /><el-option label="已停用" value="已停用" /></el-select></el-form-item>
        <el-form-item label="启用日期"><el-date-picker v-model="form.startDate" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item>
        <el-form-item label="备注"><el-input v-model="form.notes" type="textarea" :rows="2" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="dialogVisible = false">取消</el-button><el-button type="primary" @click="handleSubmit">确定</el-button></template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import DataTable from '@/components/base/DataTable.vue';
import type { TableColumn } from '@/components/base/types';

const COLUMNS: TableColumn[] = [
  { prop: 'name', label: '项目名称', width: 180, tooltip: true },
  { prop: 'code', label: '编码', width: 100 },
  { prop: 'type', label: '类型', width: 110, slot: 'c3' },
  { prop: 'address', label: '地址', minWidth: 180, tooltip: true },
  { prop: 'managerName', label: '负责人', width: 100 },
  { prop: 'status', label: '状态', width: 90, slot: 'c6' },
  { label: '房源/已出租', width: 110, slot: 'c7' },
  { label: '入住率', width: 110, slot: 'c8' },
  { label: '操作', width: 130, fixed: 'right', slot: 'c9' },
];

import { ref, computed, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import request from '@/api/request';

const tableData = ref<any[]>([]); const loading = ref(false);
const page = ref(1); const pageSize = ref(20); const total = ref(0);
const searchKeyword = ref(''); const filterStatus = ref('');
const overview = ref<any[]>([]);
const dialogVisible = ref(false); const editId = ref<number | null>(null);
const form = ref({ name: '', code: '', type: '产业园', address: '', managerName: '', managerPhone: '', status: '运营中', startDate: '', notes: '' });
const runningCount = computed(() => overview.value.filter(o => o.status === '运营中').length);
const totalProps = computed(() => overview.value.reduce((s, o) => s + Number(o.total || 0), 0));
const avgRate = computed(() => { const t = totalProps.value; if (!t) return 0; const rented = overview.value.reduce((s, o) => s + Number(o.rented || 0), 0); return Math.round(rented / t * 100); });

async function fetchData() {
  loading.value = true;
  try {
    const params: any = { page: page.value, pageSize: pageSize.value };
    if (searchKeyword.value) params.keyword = searchKeyword.value;
    if (filterStatus.value) params.status = filterStatus.value;
    const res = await request.get('/projects', { params });
    tableData.value = res.data?.list || []; total.value = res.data?.total || 0;
    const ov = await request.get('/projects/overview'); overview.value = ov.data || [];
  } catch { /* 静默 */ } finally { loading.value = false; }
}
function resetForm() { editId.value = null; form.value = { name: '', code: '', type: '产业园', address: '', managerName: '', managerPhone: '', status: '运营中', startDate: '', notes: '' }; }
function showCreate() { resetForm(); dialogVisible.value = true; }
function showEdit(row: any) { editId.value = row.id; form.value = { name: row.name, code: row.code || '', type: row.type, address: row.address || '', managerName: row.managerName || '', managerPhone: row.managerPhone || '', status: row.status, startDate: row.startDate || '', notes: row.notes || '' }; dialogVisible.value = true; }
async function handleSubmit() {
  if (!form.value.name) return ElMessage.warning('请输入项目名称');
  try {
    if (editId.value) { await request.put(`/projects/${editId.value}`, form.value); ElMessage.success('更新成功'); }
    else { await request.post('/projects', form.value); ElMessage.success('创建成功'); }
    dialogVisible.value = false; fetchData();
  } catch (err: any) { ElMessage.error(err?.response?.data?.message || '操作失败'); }
}
async function del(id: number) {
  try { await ElMessageBox.confirm('确定删除该项目?', '删除', { type: 'warning' }); } catch { return; }
  try { await request.delete(`/projects/${id}`); ElMessage.success('已删除'); fetchData(); } catch (err: any) { ElMessage.error('删除失败'); }
}
onMounted(() => { fetchData(); });
</script>

<style lang="scss" scoped>
.project-page { padding: 0; }
.stat-cards { margin-bottom: 16px; }
.stat-card { background: $n-0; border: 1px solid $n-200; border-radius: 8px; padding: 18px; text-align: center; }
.stat-num { font-size: 26px; font-weight: 700; color: $n-900; }
.stat-num.running { color: $ok-600; }
.stat-num.live { color: $brand-600; }
.stat-label { margin-top: 6px; color: $n-600; font-size: 13px; }
.toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 8px; }
.search-group { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.action-group { display: flex; gap: 8px; }
</style>