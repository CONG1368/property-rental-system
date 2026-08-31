<template>
  <div class="complaint-page">
    <el-row :gutter="16" class="stat-cards">
      <el-col :span="5"><div class="stat-card"><div class="stat-num">{{ stats.total }}</div><div class="stat-label">总单数</div></div></el-col>
      <el-col :span="5"><div class="stat-card"><div class="stat-num pending">{{ stats.pending }}</div><div class="stat-label">待受理</div></div></el-col>
      <el-col :span="5"><div class="stat-card"><div class="stat-num proc">{{ stats.processing }}</div><div class="stat-label">处理中</div></div></el-col>
      <el-col :span="5"><div class="stat-card"><div class="stat-num resolved">{{ stats.resolved }}</div><div class="stat-label">已解决</div></div></el-col>
      <el-col :span="4"><div class="stat-card"><div class="stat-num closed">{{ stats.closed }}</div><div class="stat-label">已关闭</div></div></el-col>
    </el-row>

    <div class="toolbar">
      <div class="search-group">
        <el-input v-model="searchKeyword" placeholder="搜索标题/反馈人" clearable style="width:200px" @keyup.enter="fetchData" />
        <el-select v-model="filterType" placeholder="类型" clearable style="width:120px" @change="fetchData">
          <el-option label="投诉" value="投诉" /><el-option label="建议" value="建议" /><el-option label="咨询" value="咨询" /><el-option label="表扬" value="表扬" />
        </el-select>
        <el-select v-model="filterStatus" placeholder="状态" clearable style="width:120px" @change="fetchData">
          <el-option label="待受理" value="待受理" /><el-option label="处理中" value="处理中" />
          <el-option label="已回复" value="已回复" /><el-option label="已解决" value="已解决" /><el-option label="已关闭" value="已关闭" />
        </el-select>
        <el-button type="primary" @click="fetchData">查询</el-button>
      </div>
      <div class="action-group"><el-button type="primary" @click="showCreate">受理新单</el-button></div>
    </div>

    <el-table :data="tableData" stripe v-loading="loading">
      <el-table-column prop="title" label="标题" min-width="150" show-overflow-tooltip />
      <el-table-column prop="type" label="类型" width="80"><template #default="{ row }"><el-tag :type="typeTag(row.type)" size="small">{{ row.type }}</el-tag></template></el-table-column>
      <el-table-column label="关联房源" width="130" show-overflow-tooltip><template #default="{ row }">{{ row.property?.name }}</template></el-table-column>
      <el-table-column prop="reporter" label="反馈人" width="100" />
      <el-table-column prop="status" label="状态" width="90"><template #default="{ row }"><el-tag :type="statusTag(row.status)" size="small">{{ row.status }}</el-tag></template></el-table-column>
      <el-table-column prop="assignee" label="处理人" width="100" />
      <el-table-column label="满意度" width="90"><template #default="{ row }"><el-rate v-if="row.satisfaction" :model-value="row.satisfaction" disabled size="small" /><span v-else>—</span></template></el-table-column>
      <el-table-column label="操作" width="180" fixed="right">
        <template #default="{ row }">
          <el-button size="small" link v-if="row.status === '待受理'" type="primary" @click="showProcess(row)">处理</el-button>
          <el-button size="small" link @click="onDetail(row)">详情</el-button>
        </template>
      </el-table-column>
    </el-table>
    <el-pagination v-model:current-page="page" :total="total" :page-size="pageSize" @current-change="fetchData" layout="total, prev, pager, next" style="margin-top:16px; justify-content:flex-end" />

    <!-- 新增 -->
    <el-dialog title="受理新单" v-model="createVisible" width="520px" @closed="resetCreate">
      <el-form :model="form" label-width="80px">
        <el-form-item label="标题" required><el-input v-model="form.title" /></el-form-item>
        <el-form-item label="类型"><el-select v-model="form.type" style="width:100%"><el-option label="投诉" value="投诉" /><el-option label="建议" value="建议" /><el-option label="咨询" value="咨询" /><el-option label="表扬" value="表扬" /></el-select></el-form-item>
        <el-form-item label="渠道"><el-select v-model="form.channel" style="width:100%"><el-option label="电话" value="电话" /><el-option label="线上" value="线上" /><el-option label="前台" value="前台" /><el-option label="其他" value="其他" /></el-select></el-form-item>
        <el-form-item label="反馈人"><el-input v-model="form.reporter" /></el-form-item>
        <el-form-item label="联系电话"><el-input v-model="form.phone" /></el-form-item>
        <el-form-item label="内容"><el-input v-model="form.content" type="textarea" :rows="3" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="createVisible = false">取消</el-button><el-button type="primary" @click="handleCreate">提交</el-button></template>
    </el-dialog>

    <!-- 处理 -->
    <el-dialog title="处理投诉" v-model="processVisible" width="520px">
      <el-form :model="processForm" label-width="80px">
        <el-form-item label="处理人"><el-input v-model="processForm.assignee" /></el-form-item>
        <el-form-item label="回复内容"><el-input v-model="processForm.response" type="textarea" :rows="3" /></el-form-item>
        <el-form-item label="状态"><el-select v-model="processForm.status" style="width:100%"><el-option label="已回复" value="已回复" /><el-option label="已解决" value="已解决" /><el-option label="已关闭" value="已关闭" /></el-select></el-form-item>
        <el-form-item label="满意度"><el-rate v-model="processForm.satisfaction" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="processVisible = false">取消</el-button><el-button type="primary" @click="handleProcess">提交</el-button></template>
    </el-dialog>

    <!-- 详情 -->
    <el-dialog title="投诉详情" v-model="detailVisible" width="560px">
      <el-descriptions :column="1" border v-if="current">
        <el-descriptions-item label="标题">{{ current.title }}</el-descriptions-item>
        <el-descriptions-item label="类型">{{ current.type }}</el-descriptions-item>
        <el-descriptions-item label="状态">{{ current.status }}</el-descriptions-item>
        <el-descriptions-item label="反馈人">{{ current.reporter }} {{ current.phone }}</el-descriptions-item>
        <el-descriptions-item label="内容"><div style="white-space:pre-wrap">{{ current.content }}</div></el-descriptions-item>
        <el-descriptions-item label="回复"><div style="white-space:pre-wrap">{{ current.response || '—' }}</div></el-descriptions-item>
        <el-descriptions-item label="处理人">{{ current.assignee || '—' }}</el-descriptions-item>
      </el-descriptions>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import request from '@/api/request';

const tableData = ref<any[]>([]); const loading = ref(false);
const page = ref(1); const pageSize = ref(20); const total = ref(0);
const searchKeyword = ref(''); const filterType = ref(''); const filterStatus = ref('');
const stats = ref({ total: 0, pending: 0, processing: 0, resolved: 0, closed: 0 });
const createVisible = ref(false); const form = ref({ title: '', type: '投诉', channel: '电话', reporter: '', phone: '', content: '' });
const processVisible = ref(false); const processId = ref<number | null>(null);
const processForm = ref({ assignee: '', response: '', status: '已回复', satisfaction: 0 });
const detailVisible = ref(false); const current = ref<any>(null);

function typeTag(t: string): string { return ({ '投诉': 'danger', '建议': 'warning', '咨询': 'primary', '表扬': 'success' } as Record<string, string>)[t] || 'info'; }
function statusTag(s: string): string { return ({ '待受理': 'warning', '处理中': 'primary', '已回复': '', '已解决': 'success', '已关闭': 'info' } as Record<string, string>)[s] || 'info'; }

async function fetchData() {
  loading.value = true;
  try {
    const params: any = { page: page.value, pageSize: pageSize.value };
    if (searchKeyword.value) params.keyword = searchKeyword.value;
    if (filterType.value) params.type = filterType.value;
    if (filterStatus.value) params.status = filterStatus.value;
    const res = await request.get('/complaints', { params });
    tableData.value = res.data?.list || []; total.value = res.data?.total || 0;
    const s = await request.get('/complaints/stats');
    stats.value = s.data || { total: 0, pending: 0, processing: 0, resolved: 0, closed: 0 };
  } catch { /* 静默 */ } finally { loading.value = false; }
}
function resetCreate() { form.value = { title: '', type: '投诉', channel: '电话', reporter: '', phone: '', content: '' }; }
function showCreate() { resetCreate(); createVisible.value = true; }
async function handleCreate() {
  if (!form.value.title) return ElMessage.warning('请输入标题');
  try { await request.post('/complaints', form.value); ElMessage.success('已提交'); createVisible.value = false; fetchData(); }
  catch (err: any) { ElMessage.error(err?.response?.data?.message || '操作失败'); }
}
function showProcess(row: any) { processId.value = row.id; processForm.value = { assignee: row.assignee || '', response: row.response || '', status: '已回复', satisfaction: 0 }; processVisible.value = true; }
async function handleProcess() {
  try {
    await request.put(`/complaints/${processId.value}/respond`, { response: processForm.value.response, assignee: processForm.value.assignee });
    if (processForm.value.status !== '已回复') {
      await request.put(`/complaints/${processId.value}/status`, { status: processForm.value.status, satisfaction: processForm.value.satisfaction || null });
    }
    ElMessage.success('处理完成'); processVisible.value = false; fetchData();
  } catch (err: any) { ElMessage.error(err?.response?.data?.message || '操作失败'); }
}
function onDetail(row: any) { current.value = row; detailVisible.value = true; }
onMounted(() => { fetchData(); });
</script>

<style lang="scss" scoped>
.complaint-page { padding: 0; }
.stat-cards { margin-bottom: 16px; }
.stat-card { background: #fff; border: 1px solid #ebeef5; border-radius: 8px; padding: 18px; text-align: center; }
.stat-num { font-size: 24px; font-weight: 700; color: #0A3D62; }
.stat-num.pending { color: #E6A23C; }
.stat-num.proc { color: #409EFF; }
.stat-num.resolved { color: #67C23A; }
.stat-num.closed { color: #909399; }
.stat-label { margin-top: 6px; color: #909399; font-size: 13px; }
.toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 8px; }
.search-group { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.action-group { display: flex; gap: 8px; }
</style>