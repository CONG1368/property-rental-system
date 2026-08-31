<template>
  <div class="invoice-page">
    <el-row :gutter="16" class="stat-cards">
      <el-col :span="6"><div class="stat-card"><div class="stat-num">{{ stats.total }}</div><div class="stat-label">发票总数</div></div></el-col>
      <el-col :span="6"><div class="stat-card"><div class="stat-num warn">{{ stats.pending }}</div><div class="stat-label">待开票</div></div></el-col>
      <el-col :span="6"><div class="stat-card"><div class="stat-num done">{{ stats.issued }}</div><div class="stat-label">已开票</div></div></el-col>
      <el-col :span="6"><div class="stat-card"><div class="stat-num">{{ fmt(stats.issuedAmount) }}</div><div class="stat-label">开票金额</div></div></el-col>
    </el-row>

    <div class="toolbar">
      <div class="search-group">
        <el-select v-model="filterType" placeholder="类型" clearable style="width:150px" @change="fetchData">
          <el-option v-for="t in typeOptions" :key="t" :label="t" :value="t" />
        </el-select>
        <el-select v-model="filterStatus" placeholder="状态" clearable style="width:130px" @change="fetchData">
          <el-option v-for="s in statusOptions" :key="s" :label="s" :value="s" />
        </el-select>
        <el-input v-model="searchKeyword" placeholder="搜索发票号/标题/购方/税号/开票公司" clearable style="width:260px" @keyup.enter="fetchData" />
        <el-button type="primary" @click="fetchData">查询</el-button>
      </div>
      <div class="action-group">
        <el-button type="primary" @click="showDialog()">新增开票</el-button>
      </div>
    </div>

    <el-table :data="tableData" stripe v-loading="loading">
      <el-table-column prop="invoiceNo" label="发票号" width="180" show-overflow-tooltip />
      <el-table-column prop="title" label="标题" min-width="140" show-overflow-tooltip />
      <el-table-column prop="type" label="类型" width="130">
        <template #default="{ row }"><el-tag :type="typeTag(row.type)" size="small">{{ row.type }}</el-tag></template>
      </el-table-column>
      <el-table-column prop="amount" label="金额" width="120" align="right"><template #default="{ row }">{{ fmt(row.amount) }}</template></el-table-column>
      <el-table-column label="税率" width="80" align="right"><template #default="{ row }">{{ rateText(row.taxRate) }}</template></el-table-column>
      <el-table-column prop="buyerName" label="购方" min-width="140" show-overflow-tooltip />
      <el-table-column prop="invoiceDate" label="开票日期" width="110"><template #default="{ row }">{{ row.invoiceDate || '-' }}</template></el-table-column>
      <el-table-column prop="status" label="状态" width="100">
        <template #default="{ row }"><el-tag :type="statusTag(row.status)" size="small">{{ row.status }}</el-tag></template>
      </el-table-column>
      <el-table-column label="操作" width="240" fixed="right">
        <template #default="{ row }">
          <el-button v-if="row.status === '待开票'" size="small" type="success" link @click="handleIssue(row)">开票</el-button>
          <el-button v-if="row.status === '待开票' || row.status === '已开票'" size="small" type="info" link @click="handleVoid(row)">作废</el-button>
          <el-button v-if="row.status === '已开票'" size="small" type="danger" link @click="handleRedflush(row)">红冲</el-button>
          <el-button size="small" link @click="showDialog(row)">编辑</el-button>
          <el-popconfirm title="确定删除该发票?" @confirm="handleDelete(row.id)"><template #reference><el-button size="small" type="danger" link>删除</el-button></template></el-popconfirm>
        </template>
      </el-table-column>
    </el-table>
    <el-pagination v-model:current-page="page" :total="total" :page-size="pageSize" @current-change="fetchData" layout="total, prev, pager, next" style="margin-top:16px; justify-content:flex-end" />

    <el-dialog :title="dialogTitle" v-model="dialogVisible" width="560px" @closed="resetForm">
      <el-form :model="form" :rules="rules" ref="formRef" label-width="100px">
        <el-form-item label="标题" prop="title"><el-input v-model="form.title" placeholder="如：2025年3月租金" /></el-form-item>
        <el-form-item label="类型" prop="type">
          <el-select v-model="form.type" style="width:100%"><el-option v-for="t in typeOptions" :key="t" :label="t" :value="t" /></el-select>
        </el-form-item>
        <el-form-item label="金额" prop="amount"><el-input-number v-model="form.amount" :min="0" :precision="2" style="width:100%" /></el-form-item>
        <el-form-item label="税率" prop="taxRate"><el-input-number v-model="form.taxRate" :min="0" :max="1" :step="0.01" :precision="4" style="width:100%" /></el-form-item>
        <el-form-item label="购方名称" prop="buyerName"><el-input v-model="form.buyerName" placeholder="购买方公司/个人名称" /></el-form-item>
        <el-form-item label="税号" prop="buyerTaxNo"><el-input v-model="form.buyerTaxNo" placeholder="购买方纳税人识别号" /></el-form-item>
        <el-form-item label="开票公司" prop="sellerCompany"><el-input v-model="form.sellerCompany" placeholder="销售方开票公司" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="dialogVisible = false">取消</el-button><el-button type="primary" @click="handleSubmit">确定</el-button></template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import request from '@/api/request';
import { confirmWithPassword } from '@/utils/confirm-password';

const typeOptions = ['增值税专用发票', '增值税普通发票', '电子发票', '收据'];
const statusOptions = ['待开票', '已开票', '已作废', '已红冲'];

const tableData = ref<any[]>([]); const loading = ref(false);
const page = ref(1); const pageSize = ref(20); const total = ref(0);
const searchKeyword = ref(''); const filterType = ref(''); const filterStatus = ref('');
const stats = ref({ total: 0, pending: 0, issued: 0, voided: 0, issuedAmount: 0 });
const dialogVisible = ref(false); const formRef = ref(); const editingId = ref<number | null>(null);
const dialogTitle = computed(() => (editingId.value ? '编辑发票' : '新增开票'));

function fmt(v: any): string { return Number(v || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 }); }
function rateText(v: any): string { const n = Number(v || 0); return `${(n * 100).toFixed(2).replace(/\.?0+$/, '')}%`; }
function statusTag(s: string): string {
  const map: Record<string, string> = { '待开票': 'warning', '已开票': 'success', '已作废': 'info', '已红冲': 'danger' };
  return map[s] || 'info';
}
function typeTag(t: string): string {
  const map: Record<string, string> = { '增值税专用发票': 'danger', '增值税普通发票': 'primary', '电子发票': 'success', '收据': 'info' };
  return map[t] || 'info';
}

const form = ref({ title: '', type: '增值税普通发票', amount: 0, taxRate: 0.06, buyerName: '', buyerTaxNo: '', sellerCompany: '' });
const rules = {
  title: [{ required: true, message: '请输入标题', trigger: 'blur' }],
  type: [{ required: true, message: '请选择类型', trigger: 'change' }],
  amount: [{ required: true, message: '请输入金额', trigger: 'blur' }],
  buyerName: [{ required: true, message: '请输入购方名称', trigger: 'blur' }],
};

async function fetchData() {
  loading.value = true;
  try {
    const params: any = { page: page.value, pageSize: pageSize.value };
    if (filterType.value) params.type = filterType.value;
    if (filterStatus.value) params.status = filterStatus.value;
    if (searchKeyword.value) params.keyword = searchKeyword.value;
    const res = await request.get('/invoices', { params });
    tableData.value = res.data?.list || [];
    total.value = res.data?.total || 0;
    const s = await request.get('/invoices/stats');
    stats.value = s.data || { total: 0, pending: 0, issued: 0, voided: 0, issuedAmount: 0 };
  } catch { /* 静默 */ } finally { loading.value = false; }
}

function showDialog(row?: any) {
  editingId.value = row?.id || null;
  if (row) {
    form.value = {
      title: row.title, type: row.type, amount: Number(row.amount), taxRate: Number(row.taxRate),
      buyerName: row.buyerName, buyerTaxNo: row.buyerTaxNo || '', sellerCompany: row.sellerCompany || '',
    };
  } else {
    form.value = { title: '', type: '增值税普通发票', amount: 0, taxRate: 0.06, buyerName: '', buyerTaxNo: '', sellerCompany: '' };
  }
  dialogVisible.value = true;
}
function resetForm() {
  editingId.value = null;
  form.value = { title: '', type: '增值税普通发票', amount: 0, taxRate: 0.06, buyerName: '', buyerTaxNo: '', sellerCompany: '' };
}

async function handleSubmit() {
  await formRef.value?.validate();
  try {
    if (editingId.value) { await request.put(`/invoices/${editingId.value}`, form.value); ElMessage.success('更新成功'); }
    else { await request.post('/invoices', form.value); ElMessage.success('创建成功'); }
    dialogVisible.value = false; fetchData();
  } catch (err: any) { ElMessage.error(err?.response?.data?.message || '操作失败'); }
}

async function handleIssue(row: any) {
  try { await ElMessageBox.confirm(`确定对发票 ${row.invoiceNo} 执行开票?`, '开票确认'); } catch { return; }
  try { await request.post(`/invoices/${row.id}/issue`); ElMessage.success('开票成功'); fetchData(); }
  catch (err: any) { ElMessage.error(err?.response?.data?.message || '开票失败'); }
}

async function handleVoid(row: any) {
  const pwd = await confirmWithPassword(`确定作废发票 ${row.invoiceNo}? 此操作不可恢复，请输入登录密码。`, '作废二次确认');
  if (!pwd) return;
  try { await request.post(`/invoices/${row.id}/void`, { confirmPassword: pwd }); ElMessage.success('已作废'); fetchData(); }
  catch (err: any) { ElMessage.error(err?.response?.data?.message || '作废失败'); }
}

async function handleRedflush(row: any) {
  const pwd = await confirmWithPassword(`确定对发票 ${row.invoiceNo} 执行红冲? 此操作不可恢复，请输入登录密码。`, '红冲二次确认');
  if (!pwd) return;
  try { await request.post(`/invoices/${row.id}/redflush`, { confirmPassword: pwd }); ElMessage.success('已红冲'); fetchData(); }
  catch (err: any) { ElMessage.error(err?.response?.data?.message || '红冲失败'); }
}

async function handleDelete(id: number) {
  const pwd = await confirmWithPassword('确定删除该发票? 此操作不可恢复，请输入登录密码。', '删除二次确认');
  if (!pwd) return;
  try { await request.delete(`/invoices/${id}`, { data: { confirmPassword: pwd } }); ElMessage.success('已删除'); fetchData(); }
  catch (err: any) { ElMessage.error(err?.response?.data?.message || '删除失败'); }
}

onMounted(() => { fetchData(); });
</script>

<style lang="scss" scoped>
.invoice-page { padding: 0; }
.stat-cards { margin-bottom: 16px; }
.stat-card { background: #fff; border: 1px solid #ebeef5; border-radius: 8px; padding: 18px; text-align: center; }
.stat-num { font-size: 24px; font-weight: 700; color: #1f2430; }
.stat-num.warn { color: #E6A23C; }
.stat-num.done { color: #67C23A; }
.stat-label { margin-top: 6px; color: #909399; font-size: 13px; }
.toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 8px; }
.search-group { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.action-group { display: flex; gap: 8px; }
</style>
