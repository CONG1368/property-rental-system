<template>
  <div class="contract-list">
    <h2 class="page-title">合同管理</h2>
    <div class="toolbar">
      <el-select v-model="filterStatus" placeholder="状态筛选" clearable style="width:130px" @change="fetchData">
        <el-option label="起草中" value="起草中" /><el-option label="审批中" value="审批中" />
        <el-option label="已签订" value="已签订" /><el-option label="执行中" value="执行中" />
        <el-option label="已到期" value="已到期" /><el-option label="已驳回" value="已驳回" />
        <el-option label="已终止" value="已终止" />
      </el-select>
      <el-button type="primary" @click="fetchData">查询</el-button>
      <el-button type="primary" style="margin-left:auto" @click="$router.push('/contract/draft')">起草合同</el-button>
    </div>

    <!-- 批量操作栏 -->
    <div class="batch-bar" v-if="selectedIds.length > 0">
      <span class="batch-info">已选 {{ selectedIds.length }} 项</span>
      <el-button size="small" type="success" @click="batchSubmit">批量提交审批</el-button>
      <el-button size="small" type="warning" @click="batchTerminate">批量终止</el-button>
      <el-button size="small" type="danger" @click="batchDelete">批量删除</el-button>
      <el-dropdown @command="handleBatchPrint" style="margin-left:4px">
        <el-button size="small" type="primary" plain>
          <el-icon><Printer /></el-icon> 批量打印 <el-icon><ArrowDown /></el-icon>
        </el-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="native"><el-icon><Printer /></el-icon> 直接打印</el-dropdown-item>
            <el-dropdown-item command="pdf"><el-icon><Download /></el-icon> 导出PDF</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
      <el-button size="small" @click="clearSelection">取消选择</el-button>
    </div>

    <el-table
      :data="tableData" stripe v-loading="loading"
      @row-click="onRowClick"
      @selection-change="(rows: any[]) => selectedRows = rows"
      style="cursor:pointer" ref="tableRef"
    >
      <el-table-column type="selection" width="45" />
      <el-table-column prop="contractNo" label="合同编号" width="150" />
      <el-table-column label="租客" width="100"><template #default="{ row }"><span v-if="row.tenant">{{ row.tenant.name }}</span></template></el-table-column>
      <el-table-column label="房源" width="150"><template #default="{ row }"><span v-if="row.property">{{ row.property.name }}</span></template></el-table-column>
      <el-table-column prop="rentAmount" label="月租金" width="110" />
      <el-table-column prop="startDate" label="开始" width="110" />
      <el-table-column prop="endDate" label="到期" width="110" />
      <el-table-column label="状态" width="90">
        <template #default="{ row }"><el-tag :type="statusTagType(row.status)" size="small">{{ row.status }}</el-tag></template>
      </el-table-column>
      <el-table-column label="操作" width="360" fixed="right">
        <template #default="{ row }">
          <el-button size="small" type="info" @click.stop="$router.push('/contract/detail/' + row.id)">详情</el-button>

          <!-- 起草中：编辑 + 提交 -->
          <template v-if="row.status === '起草中'">
            <el-button size="small" @click.stop="$router.push('/contract/draft/' + row.id)">编辑</el-button>
            <el-button size="small" type="success" @click.stop="handleSubmit(row.id)">提交</el-button>
          </template>

          <!-- 审批中：驳回 + 去审批 -->
          <template v-if="row.status === '审批中'">
            <el-button size="small" type="danger" @click.stop="handleReject(row.id)">驳回</el-button>
            <el-button size="small" type="warning" @click.stop="$router.push('/contract/approval')">去审批</el-button>
          </template>

          <!-- 已驳回：编辑 + 重新提交 -->
          <template v-if="row.status === '已驳回'">
            <el-button size="small" @click.stop="$router.push('/contract/draft/' + row.id)">编辑</el-button>
            <el-button size="small" type="success" @click.stop="handleSubmit(row.id)">重新提交</el-button>
          </template>

          <!-- 已签订：签署 -->
          <el-button size="small" type="primary" @click.stop="handleSign(row.id)" v-if="row.status === '已签订'">签署</el-button>

          <!-- 执行中：终止 + 续约 -->
          <template v-if="row.status === '执行中'">
            <el-button size="small" type="danger" @click.stop="handleTerminate(row.id)">终止</el-button>
            <el-button size="small" type="primary" @click.stop="showRenewDialog(row)">续约</el-button>
          </template>

          <!-- 已到期：终止 + 续约 -->
          <template v-if="row.status === '已到期'">
            <el-button size="small" type="danger" @click.stop="handleTerminate(row.id)">终止</el-button>
            <el-button size="small" type="primary" @click.stop="showRenewDialog(row)">续约</el-button>
          </template>

          <!-- 删除 — 所有状态均可删除 -->
          <el-popconfirm :title="'确定删除该合同? (' + row.status + ')'" @confirm="handleDelete(row.id)">
            <template #reference><el-button size="small" type="danger" @click.stop>删除</el-button></template>
          </el-popconfirm>
        </template>
      </el-table-column>
    </el-table>
    <el-pagination v-model:current-page="page" :total="total" :page-size="pageSize" @current-change="fetchData" layout="total, prev, pager, next" style="margin-top:16px; justify-content:flex-end" />

    <!-- 续约对话框 -->
    <el-dialog title="合同续约" v-model="renewVisible" width="450px">
      <el-form :model="renewForm" label-width="100px">
        <el-form-item label="原合同编号"><span>{{ renewForm.contractNo }}</span></el-form-item>
        <el-form-item label="原到期日"><span>{{ renewForm.oldEndDate }}</span></el-form-item>
        <el-form-item label="新到期日"><el-date-picker v-model="renewForm.newEndDate" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item>
        <el-form-item label="新月租金"><el-input-number v-model="renewForm.newRent" :min="0" :precision="2" style="width:100%" /></el-form-item>
        <el-form-item label="备注"><el-input v-model="renewForm.notes" type="textarea" :rows="2" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="renewVisible = false">取消</el-button><el-button type="primary" @click="handleRenew">确认续约</el-button></template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Printer, ArrowDown, Download } from '@element-plus/icons-vue';
import request from '@/api/request';
import { printDocument } from '@/utils/print-service';
import { buildBatchContractHTML } from '@/components/print/ContractBatchPrint';

const router = useRouter();
const tableData = ref<any[]>([]); const total = ref(0); const page = ref(1); const pageSize = ref(20);
const loading = ref(false); const filterStatus = ref('');
const tableRef = ref();
const selectedRows = ref<any[]>([]);
const selectedIds = computed(() => selectedRows.value.map(r => r.id));


const renewVisible = ref(false);
const renewForm = ref({ id: 0, contractNo: '', oldEndDate: '', newEndDate: '', newRent: 0, notes: '' });

function statusTagType(s: string) {
  const m: Record<string, string> = { '执行中': 'success', '审批中': 'warning', '已签订': 'primary', '已驳回': 'danger', '已到期': 'info', '已终止': 'info', '起草中': 'info' };
  return m[s] || 'info';
}

async function fetchData() {
  loading.value = true;
  try {
    const res = await request.get('/contracts', { params: { page: page.value, pageSize: pageSize.value, status: filterStatus.value || undefined } });
    tableData.value = res.data.list; total.value = res.data.total;
  } catch {} finally { loading.value = false; }
}

function onRowClick(row: any, _c: any, e: Event) {
  const t = e.target as HTMLElement;
  if (t?.closest('.el-checkbox') || t?.closest('.el-button') || t?.closest('.el-popconfirm')) return;
  router.push('/contract/detail/' + row.id);
}
function clearSelection() { tableRef.value?.clearSelection(); }

async function handleBatchPrint(mode: string) {
  if (selectedRows.value.length === 0) return;
  let companyName = '物业租赁管理公司'; let companyLogo = '';
  try {
    const res = await request.get('/system-configs/keys', { params: { keys: 'company_name_for_print,company_logo' } });
    const map: Record<string, string> = {};
    (res.data || []).forEach((c: any) => { map[c.configKey] = c.configValue; });
    if (map['company_name_for_print']) companyName = map['company_name_for_print'];
    if (map['company_logo']) companyLogo = map['company_logo'];
  } catch { /* use defaults */ }
  const html = buildBatchContractHTML({
    contracts: selectedRows.value.map((r: any) => ({
      contractNo: r.contractNo, tenantName: r.tenant?.name || '-',
      propertyName: r.property?.name || '-',
      rentAmount: Number(r.rentAmount || 0), depositAmount: Number(r.depositAmount || 0),
      startDate: r.startDate, endDate: r.endDate, status: r.status,
    })),
    companyName, companyLogo,
  });
  try {
    await printDocument({ title: `合同汇总_${selectedRows.value.length}份`, paperSize: 'A4', htmlContent: html, mode: mode as any });
    ElMessage.success(mode === 'native' ? '已发送到打印机' : 'PDF导出成功');
  } catch (e: any) { ElMessage.error(e.message || '批量打印失败'); }
}

// ---- 单条操作 ----
async function handleSubmit(id: number) {
  try { await request.post('/contracts/' + id + '/submit'); ElMessage.success('已提交审批，请在合同审批页面查看'); fetchData(); }
  catch (e: any) { ElMessage.error(e?.response?.data?.message || '提交失败'); }
}
async function handleReject(id: number) {
  try { await request.post('/contracts/' + id + '/reject'); ElMessage.success('合同已驳回'); fetchData(); }
  catch (e: any) { ElMessage.error(e?.response?.data?.message || '驳回失败'); }
}
async function handleSign(id: number) {
  try { await request.post('/contracts/' + id + '/sign'); ElMessage.success('已签署生效'); fetchData(); }
  catch (e: any) { ElMessage.error(e?.response?.data?.message || '签署失败'); }
}
async function handleTerminate(id: number) {
  try { await request.post('/contracts/' + id + '/terminate'); ElMessage.success('合同已终止'); fetchData(); }
  catch (e: any) { ElMessage.error(e?.response?.data?.message || '终止失败'); }
}
async function handleDelete(id: number) {
  try { await request.delete('/contracts/' + id); ElMessage.success('已删除'); fetchData(); }
  catch (e: any) { ElMessage.error('删除失败: ' + (e?.response?.data?.message || '')); }
}

// ---- 续约 ----
function showRenewDialog(row: any) {
  renewForm.value = { id: row.id, contractNo: row.contractNo, oldEndDate: row.endDate, newEndDate: '', newRent: row.rentAmount, notes: '' };
  renewVisible.value = true;
}
async function handleRenew() {
  try {
    await request.post('/contracts/' + renewForm.value.id + '/renew', {
      newEndDate: renewForm.value.newEndDate || undefined, newRent: renewForm.value.newRent, notes: renewForm.value.notes,
    });
    ElMessage.success('续约合同已创建'); renewVisible.value = false; fetchData();
  } catch { ElMessage.error('续约失败'); }
}

// ---- 批量操作 ----
function showBatchResult(action: string, done: number, total: number, skipped: string[]) {
  if (done === 0) { ElMessage.warning(`没有符合条件的合同可${action}`); return; }
  let msg = `成功${action} ${done} 份`;
  if (skipped.length > 0) msg += `，跳过 ${skipped.length} 份\n${skipped.slice(0, 5).join('；')}`;
  if (skipped.length > 0) ElMessage.warning({ message: msg, duration: 6000, showClose: true });
  else ElMessage.success(msg);
  clearSelection(); fetchData();
}

async function batchSubmit() {
  const total = selectedIds.value.length;
  try { await ElMessageBox.confirm(`确定批量提交 ${total} 份合同审批?`, '批量操作'); } catch { return; }
  let done = 0; const skipped: string[] = [];
  for (const row of selectedRows.value) {
    if (row.status === '起草中' || row.status === '已驳回') {
      try { await request.post('/contracts/' + row.id + '/submit'); done++; }
      catch { skipped.push(`${row.contractNo}: 提交失败`); }
    } else { skipped.push(`${row.contractNo}: 状态"${row.status}"不可提交`); }
  }
  showBatchResult('提交审批', done, total, skipped);
}

async function batchTerminate() {
  const total = selectedIds.value.length;
  try { await ElMessageBox.confirm(`确定批量终止 ${total} 份合同?`, '批量终止', { type: 'warning' }); } catch { return; }
  let done = 0; const skipped: string[] = [];
  for (const row of selectedRows.value) {
    if (row.status === '执行中' || row.status === '已到期') {
      try { await request.post('/contracts/' + row.id + '/terminate'); done++; }
      catch { skipped.push(`${row.contractNo}: 终止失败`); }
    } else { skipped.push(`${row.contractNo}: 状态"${row.status}"不可终止`); }
  }
  showBatchResult('终止', done, total, skipped);
}

async function batchDelete() {
  const total = selectedIds.value.length;
  try { await ElMessageBox.confirm(`确定批量删除 ${total} 份合同? 此操作不可恢复!`, '批量删除', { type: 'warning' }); } catch { return; }
  let done = 0; const skipped: string[] = [];
  for (const row of selectedRows.value) {
    try { await request.delete('/contracts/' + row.id); done++; }
    catch { skipped.push(`${row.contractNo}: 删除失败`); }
  }
  showBatchResult('删除', done, total, skipped);
}

onMounted(() => fetchData());
</script>

<style lang="scss" scoped>
.page-title { font-size: 18px; font-weight: 700; color: #0A3D62; margin-bottom: 16px; }
.toolbar { display: flex; gap: 10px; align-items: center; margin-bottom: 16px; }
.batch-bar { display: flex; gap: 10px; align-items: center; padding: 8px 16px; margin-bottom: 12px; background: #ecf5ff; border-radius: 6px; border: 1px solid #b3d8ff; }
.batch-info { font-size: 13px; color: #409eff; font-weight: 600; margin-right: 8px; }
</style>
