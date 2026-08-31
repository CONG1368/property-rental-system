<template>
  <div class="asset-page">
    <el-row :gutter="16" class="stat-cards">
      <el-col :span="6"><div class="stat-card"><div class="stat-num">{{ stats.total }}</div><div class="stat-label">资产总数</div></div></el-col>
      <el-col :span="6"><div class="stat-card"><div class="stat-num">{{ stats.inUse }}</div><div class="stat-label">使用中</div></div></el-col>
      <el-col :span="6"><div class="stat-card"><div class="stat-num done">{{ stats.done }}</div><div class="stat-label">已折旧完毕</div></div></el-col>
      <el-col :span="6"><div class="stat-card"><div class="stat-num">{{ fmt(stats.totalValue) }}</div><div class="stat-label">原值合计</div></div></el-col>
    </el-row>

    <div class="toolbar">
      <div class="search-group">
        <el-input v-model="searchKeyword" placeholder="搜索名称/类别" clearable style="width:200px" @keyup.enter="fetchData" />
        <el-select v-model="filterStatus" placeholder="状态" clearable style="width:130px" @change="fetchData">
          <el-option label="使用中" value="使用中" /><el-option label="已折旧完毕" value="已折旧完毕" />
        </el-select>
        <el-button type="primary" @click="fetchData">查询</el-button>
      </div>
      <div class="action-group">
        <el-button type="warning" :loading="running" @click="runDepreciation">计提本月折旧</el-button>
        <el-button type="primary" @click="showDialog()">新增资产</el-button>
      </div>
    </div>

    <el-table :data="tableData" stripe v-loading="loading">
      <el-table-column prop="name" label="资产名称" width="140" show-overflow-tooltip />
      <el-table-column prop="category" label="类别" width="100" />
      <el-table-column prop="originalValue" label="原值" width="110" align="right"><template #default="{ row }">{{ fmt(row.originalValue) }}</template></el-table-column>
      <el-table-column prop="monthlyDepreciation" label="月折旧" width="110" align="right"><template #default="{ row }">{{ fmt(row.monthlyDepreciation) }}</template></el-table-column>
      <el-table-column prop="accumulatedDepreciation" label="累计折旧" width="120" align="right"><template #default="{ row }">{{ fmt(row.accumulatedDepreciation) }}</template></el-table-column>
      <el-table-column label="折旧进度" min-width="160">
        <template #default="{ row }">
          <el-progress :percentage="depPercent(row)" :color="depPercent(row) >= 100 ? '#67C23A' : '#409EFF'" :stroke-width="10" />
        </template>
      </el-table-column>
      <el-table-column prop="status" label="状态" width="100"><template #default="{ row }"><el-tag :type="row.status === '使用中' ? 'success' : 'info'" size="small">{{ row.status }}</el-tag></template></el-table-column>
      <el-table-column label="操作" width="140" fixed="right">
        <template #default="{ row }">
          <el-button size="small" link @click="showDialog(row)">编辑</el-button>
          <el-popconfirm title="确定删除该资产?" @confirm="handleDelete(row.id)"><template #reference><el-button size="small" type="danger" link>删除</el-button></template></el-popconfirm>
        </template>
      </el-table-column>
    </el-table>
    <el-pagination v-model:current-page="page" :total="total" :page-size="pageSize" @current-change="fetchData" layout="total, prev, pager, next" style="margin-top:16px; justify-content:flex-end" />

    <el-dialog :title="dialogTitle" v-model="dialogVisible" width="560px" @closed="resetForm">
      <el-form :model="form" :rules="rules" ref="formRef" label-width="100px">
        <el-form-item label="资产名称" prop="name"><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="类别" prop="category"><el-input v-model="form.category" placeholder="如：电梯/空调/变压器" /></el-form-item>
        <el-form-item label="原值" prop="originalValue"><el-input-number v-model="form.originalValue" :min="0" :precision="2" style="width:100%" /></el-form-item>
        <el-form-item label="残值" prop="residualValue"><el-input-number v-model="form.residualValue" :min="0" :precision="2" style="width:100%" /></el-form-item>
        <el-form-item label="使用月数" prop="usefulMonths"><el-input-number v-model="form.usefulMonths" :min="1" style="width:100%" /></el-form-item>
        <el-form-item label="投产日期" prop="startDate"><el-date-picker v-model="form.startDate" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item>
        <el-form-item label="账套" prop="bookId"><el-select v-model="form.bookId" style="width:100%"><el-option v-for="b in accountBooks" :key="b.id" :label="b.name" :value="b.id" /></el-select></el-form-item>
      </el-form>
      <template #footer><el-button @click="dialogVisible = false">取消</el-button><el-button type="primary" @click="handleSubmit">确定</el-button></template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import request from '@/api/request';
import { confirmWithPassword } from '@/utils/confirm-password';

const tableData = ref<any[]>([]); const loading = ref(false); const running = ref(false);
const page = ref(1); const pageSize = ref(20); const total = ref(0);
const searchKeyword = ref(''); const filterStatus = ref('');
const stats = ref({ total: 0, inUse: 0, done: 0, totalValue: 0 });
const accountBooks = ref<any[]>([]);
const dialogVisible = ref(false); const formRef = ref(); const editingId = ref<number | null>(null);
const dialogTitle = computed(() => editingId.value ? '编辑资产' : '新增资产');

function fmt(v: any): string { return Number(v || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 }); }
function depPercent(row: any): number {
  const o = Number(row.originalValue || 0); const acc = Number(row.accumulatedDepreciation || 0);
  return o > 0 ? Math.round(Math.min(100, acc / o * 100)) : 0;
}

const form = ref({ name: '', category: '', originalValue: 0, residualValue: 0, usefulMonths: 60, startDate: '', bookId: null });
const rules = {
  name: [{ required: true, message: '请输入资产名称', trigger: 'blur' }],
  originalValue: [{ required: true, message: '请输入原值', trigger: 'blur' }],
  usefulMonths: [{ required: true, message: '请输入使用月数', trigger: 'blur' }],
  startDate: [{ required: true, message: '请选择投产日期', trigger: 'change' }],
  bookId: [{ required: true, message: '请选择账套', trigger: 'change' }],
};

async function fetchData() {
  loading.value = true;
  try {
    const params: any = { page: page.value, pageSize: pageSize.value };
    if (searchKeyword.value) params.keyword = searchKeyword.value;
    if (filterStatus.value) params.status = filterStatus.value;
    const res = await request.get('/fixed-assets', { params });
    tableData.value = res.data?.list || [];
    total.value = res.data?.total || 0;
    const s = await request.get('/fixed-assets/stats');
    stats.value = s.data || { total: 0, inUse: 0, done: 0, totalValue: 0 };
  } catch { /* 静默 */ } finally { loading.value = false; }
}

async function loadBooks() {
  try {
    const res = await request.get('/account-books', { params: { pageSize: 100 } });
    accountBooks.value = res.data?.list || [];
  } catch { /* 静默 */ }
}

async function runDepreciation() {
  const pwd = await confirmWithPassword('确定计提本月折旧? 将生成折旧记录，请输入登录密码。', '折旧二次确认');
  if (!pwd) return;
  running.value = true;
  try {
    await request.post('/fixed-assets/depreciate', { confirmPassword: pwd });
    ElMessage.success('折旧计提完成');
    fetchData();
  } catch (err: any) { ElMessage.error(err?.response?.data?.message || '计提失败'); } finally { running.value = false; }
}

function showDialog(row?: any) {
  editingId.value = row?.id || null;
  if (row) form.value = { name: row.name, category: row.category || '', originalValue: Number(row.originalValue), residualValue: Number(row.residualValue || 0), usefulMonths: row.usefulMonths, startDate: row.startDate, bookId: row.bookId };
  dialogVisible.value = true;
}
function resetForm() { editingId.value = null; form.value = { name: '', category: '', originalValue: 0, residualValue: 0, usefulMonths: 60, startDate: '', bookId: null }; }

async function handleSubmit() {
  await formRef.value?.validate();
  try {
    if (editingId.value) { await request.put(`/fixed-assets/${editingId.value}`, form.value); ElMessage.success('更新成功'); }
    else { await request.post('/fixed-assets', form.value); ElMessage.success('创建成功'); }
    dialogVisible.value = false; fetchData();
  } catch (err: any) { ElMessage.error(err?.response?.data?.message || '操作失败'); }
}

async function handleDelete(id: number) {
  const pwd = await confirmWithPassword('确定删除该资产? 此操作不可恢复，请输入登录密码。', '删除二次确认');
  if (!pwd) return;
  try { await request.delete(`/fixed-assets/${id}`, { data: { confirmPassword: pwd } }); ElMessage.success('已删除'); fetchData(); }
  catch (err: any) { ElMessage.error('删除失败'); }
}

onMounted(() => { fetchData(); loadBooks(); });
</script>

<style lang="scss" scoped>
.asset-page { padding: 0; }
.stat-cards { margin-bottom: 16px; }
.stat-card { background: #fff; border: 1px solid #ebeef5; border-radius: 8px; padding: 18px; text-align: center; }
.stat-num { font-size: 24px; font-weight: 700; color: #1f2430; }
.stat-num.done { color: #67C23A; }
.stat-label { margin-top: 6px; color: #909399; font-size: 13px; }
.toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 8px; }
.search-group { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.action-group { display: flex; gap: 8px; }
</style>