<template>
  <div class="work-order-list">
    <h2 class="page-title">报修/工单管理</h2>

    <!-- 统计卡片 -->
    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-value">{{ stats.total }}</div>
        <div class="stat-label">工单总数</div>
      </div>
      <div class="stat-card warning">
        <div class="stat-value">{{ stats.pendingDispatch }}</div>
        <div class="stat-label">待派单</div>
      </div>
      <div class="stat-card primary">
        <div class="stat-value">{{ stats.processing }}</div>
        <div class="stat-label">处理中</div>
      </div>
      <div class="stat-card success">
        <div class="stat-value">{{ stats.monthFinished }}</div>
        <div class="stat-label">本月完工</div>
      </div>
    </div>

    <!-- 工具栏 -->
    <div class="toolbar">
      <div class="search-group">
        <el-select v-model="filters.status" placeholder="状态筛选" clearable style="width:130px" @change="fetchData">
          <el-option v-for="s in statusOptions" :key="s" :label="s" :value="s" />
        </el-select>
        <el-select v-model="filters.type" placeholder="类型" clearable style="width:120px" @change="fetchData">
          <el-option v-for="t in typeOptions" :key="t" :label="t" :value="t" />
        </el-select>
        <el-select v-model="filters.priority" placeholder="优先级" clearable style="width:110px" @change="fetchData">
          <el-option v-for="p in priorityOptions" :key="p" :label="p" :value="p" />
        </el-select>
        <el-input v-model="filters.keyword" placeholder="标题/报修人/电话" clearable style="width:210px" @keyup.enter="fetchData" />
        <el-button type="primary" @click="fetchData">查询</el-button>
      </div>
      <div class="action-group">
        <el-button type="primary" @click="showCreateDialog">新增工单</el-button>
      </div>
    </div>

    <!-- 表格 -->
    <el-table :data="list" stripe v-loading="loading" style="margin-top:12px">
      <el-table-column prop="ticketNo" label="工单号" width="150" />
      <el-table-column prop="title" label="报修标题" min-width="180" show-overflow-tooltip />
      <el-table-column prop="type" label="类型" width="90" />
      <el-table-column prop="priority" label="优先级" width="90">
        <template #default="{ row }"><el-tag :type="priorityTagType(row.priority)" size="small">{{ row.priority }}</el-tag></template>
      </el-table-column>
      <el-table-column prop="status" label="状态" width="100">
        <template #default="{ row }"><el-tag :type="statusTagType(row.status)" size="small">{{ row.status }}</el-tag></template>
      </el-table-column>
      <el-table-column prop="reporter" label="报修人" width="100" />
      <el-table-column prop="phone" label="手机" width="130" />
      <el-table-column label="操作" width="230" fixed="right">
        <template #default="{ row }">
          <el-button v-if="row.status === '待派单'" size="small" type="warning" @click="showAssignDialog(row)">派单</el-button>
          <el-button v-if="row.status === '已派单'" size="small" type="primary" @click="handleAdvance(row, '处理中')">处理</el-button>
          <el-button v-if="row.status === '处理中'" size="small" type="primary" @click="handleAdvance(row, '待验收')">验收</el-button>
          <el-button v-if="row.status === '待验收'" size="small" type="success" @click="showFinishDialog(row)">完工</el-button>
          <el-button size="small" @click="showDetail(row)">详情</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-pagination
      v-if="total > 0"
      v-model:current-page="page"
      :page-size="pageSize"
      :total="total"
      @current-change="fetchData"
      layout="total, prev, pager, next"
      style="margin-top:16px; justify-content:flex-end"
    />

    <!-- 新增工单弹窗 -->
    <el-dialog title="新增工单" v-model="createVisible" width="620px" @closed="resetCreateForm">
      <el-form :model="createForm" label-width="90px" size="small">
        <el-form-item label="关联房源" required>
          <el-select v-model="createForm.propertyId" filterable style="width:100%" placeholder="选择房源">
            <el-option v-for="p in properties" :key="p.id" :label="p.name" :value="p.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="关联租客" required>
          <el-select v-model="createForm.tenantId" filterable style="width:100%" placeholder="选择租客">
            <el-option v-for="t in tenants" :key="t.id" :label="t.name" :value="t.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="报修标题" required>
          <el-input v-model="createForm.title" placeholder="请输入报修标题" />
        </el-form-item>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="类型">
              <el-select v-model="createForm.type" style="width:100%">
                <el-option v-for="t in typeOptions" :key="t" :label="t" :value="t" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="优先级">
              <el-select v-model="createForm.priority" style="width:100%">
                <el-option v-for="p in priorityOptions" :key="p" :label="p" :value="p" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="报修人">
              <el-input v-model="createForm.reporter" placeholder="报修人姓名" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="联系电话">
              <el-input v-model="createForm.phone" placeholder="联系电话" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="问题描述">
          <el-input v-model="createForm.description" type="textarea" :rows="3" placeholder="请描述问题详情" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createVisible = false">取消</el-button>
        <el-button type="primary" @click="handleCreate" :loading="submitting">创建</el-button>
      </template>
    </el-dialog>

    <!-- 派单弹窗 -->
    <el-dialog title="派单" v-model="assignVisible" width="460px">
      <el-form :model="assignForm" label-width="90px" size="small">
        <el-form-item label="工单号">{{ assignTarget?.ticketNo }}</el-form-item>
        <el-form-item label="报修标题">{{ assignTarget?.title }}</el-form-item>
        <el-form-item label="维修人员" required>
          <el-input v-model="assignForm.assigneeName" placeholder="请输入维修/处理人员姓名" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="assignVisible = false">取消</el-button>
        <el-button type="primary" @click="handleAssign" :loading="submitting">确认派单</el-button>
      </template>
    </el-dialog>

    <!-- 完工弹窗 -->
    <el-dialog title="完工登记" v-model="finishVisible" width="460px">
      <el-form :model="finishForm" label-width="90px" size="small">
        <el-form-item label="工单号">{{ finishTarget?.ticketNo }}</el-form-item>
        <el-form-item label="报修标题">{{ finishTarget?.title }}</el-form-item>
        <el-form-item label="处理方案">
          <el-input v-model="finishForm.solution" type="textarea" :rows="3" placeholder="填写处理结果/方案" />
        </el-form-item>
        <el-form-item label="费用(元)">
          <el-input-number v-model="finishForm.cost" :min="0" :precision="2" :step="10" style="width:100%" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="finishVisible = false">取消</el-button>
        <el-button type="primary" @click="handleFinish" :loading="submitting">确认完工</el-button>
      </template>
    </el-dialog>

    <!-- 详情弹窗 -->
    <el-dialog title="工单详情" v-model="detailVisible" width="580px">
      <el-descriptions v-if="detail" :column="2" border size="small">
        <el-descriptions-item label="工单号">{{ detail.ticketNo }}</el-descriptions-item>
        <el-descriptions-item label="状态"><el-tag :type="statusTagType(detail.status)" size="small">{{ detail.status }}</el-tag></el-descriptions-item>
        <el-descriptions-item label="类型">{{ detail.type }}</el-descriptions-item>
        <el-descriptions-item label="优先级"><el-tag :type="priorityTagType(detail.priority)" size="small">{{ detail.priority }}</el-tag></el-descriptions-item>
        <el-descriptions-item label="关联房源">{{ detail.property?.name || '-' }}</el-descriptions-item>
        <el-descriptions-item label="关联租客">{{ detail.tenant?.name || '-' }}</el-descriptions-item>
        <el-descriptions-item label="报修人">{{ detail.reporter || '-' }}</el-descriptions-item>
        <el-descriptions-item label="联系电话">{{ detail.phone || '-' }}</el-descriptions-item>
        <el-descriptions-item label="维修人员">{{ detail.assigneeName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="派单时间">{{ formatTime(detail.assignedAt) }}</el-descriptions-item>
        <el-descriptions-item label="完工时间">{{ formatTime(detail.finishedAt) }}</el-descriptions-item>
        <el-descriptions-item label="费用(元)">{{ detail.cost ?? 0 }}</el-descriptions-item>
        <el-descriptions-item label="评分">{{ detail.rating || 0 }}</el-descriptions-item>
        <el-descriptions-item label="问题描述" :span="2"><span class="pre-wrap">{{ detail.description || '-' }}</span></el-descriptions-item>
        <el-descriptions-item label="处理方案" :span="2"><span class="pre-wrap">{{ detail.solution || '-' }}</span></el-descriptions-item>
      </el-descriptions>
      <template #footer><el-button @click="detailVisible = false">关闭</el-button></template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import request from '@/api/request'

const statusOptions = ['待派单', '已派单', '处理中', '待验收', '已完工', '已取消']
const typeOptions = ['报修', '维修', '安装', '保养', '其他']
const priorityOptions = ['紧急', '高', '中', '低']

const list = ref<any[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const loading = ref(false)
const properties = ref<any[]>([])
const tenants = ref<any[]>([])
const filters = reactive<any>({ status: '', type: '', priority: '', keyword: '' })
const stats = reactive({ total: 0, pendingDispatch: 0, processing: 0, monthFinished: 0 })

function priorityTagType(p: string) {
  const map: Record<string, string> = { '紧急': 'danger', '高': 'warning', '中': '', '低': 'info' }
  return map[p] || 'info'
}
function statusTagType(s: string) {
  const map: Record<string, string> = { '待派单': 'warning', '已派单': 'primary', '处理中': '', '待验收': 'warning', '已完工': 'success', '已取消': 'info' }
  return map[s] || 'info'
}
function formatTime(v: any) {
  if (!v) return '-'
  const d = new Date(v)
  return isNaN(d.getTime()) ? '-' : d.toLocaleString()
}

async function fetchStats() {
  try {
    const res = await request.get('/work-orders/stats')
    stats.total = res.data.total || 0
    stats.pendingDispatch = res.data.pendingDispatch || 0
    stats.processing = res.data.processing || 0
    stats.monthFinished = res.data.monthFinished || 0
  } catch { /* ignore */ }
}
async function fetchOptions() {
  try { const r = await request.get('/properties', { params: { pageSize: 500 } }); properties.value = r.data.list || [] } catch { /* ignore */ }
  try { const r = await request.get('/tenants', { params: { pageSize: 500 } }); tenants.value = r.data.list || [] } catch { /* ignore */ }
}
async function fetchData() {
  loading.value = true
  try {
    const params: any = { page: page.value, pageSize: pageSize.value }
    if (filters.status) params.status = filters.status
    if (filters.type) params.type = filters.type
    if (filters.priority) params.priority = filters.priority
    if (filters.keyword) params.keyword = filters.keyword
    const res = await request.get('/work-orders', { params })
    list.value = res.data.list || []
    total.value = res.data.total || 0
  } catch { /* ignore */ }
  finally { loading.value = false }
}

// ====== 新增 ======
const createVisible = ref(false)
const submitting = ref(false)
const createForm = reactive<any>({ propertyId: null, tenantId: null, title: '', type: '报修', priority: '中', reporter: '', phone: '', description: '' })
function showCreateDialog() {
  Object.assign(createForm, { propertyId: null, tenantId: null, title: '', type: '报修', priority: '中', reporter: '', phone: '', description: '' })
  createVisible.value = true
}
function resetCreateForm() { /* noop */ }
async function handleCreate() {
  if (!createForm.propertyId) { ElMessage.warning('请选择关联房源'); return }
  if (!createForm.tenantId) { ElMessage.warning('请选择关联租客'); return }
  if (!createForm.title.trim()) { ElMessage.warning('请输入报修标题'); return }
  submitting.value = true
  try {
    await request.post('/work-orders', { ...createForm })
    ElMessage.success('工单已创建')
    createVisible.value = false
    fetchData(); fetchStats()
  } catch { /* ignore */ }
  finally { submitting.value = false }
}

// ====== 派单 ======
const assignVisible = ref(false)
const assignTarget = ref<any>(null)
const assignForm = reactive<any>({ assigneeName: '' })
function showAssignDialog(row: any) {
  assignTarget.value = row
  assignForm.assigneeName = ''
  assignVisible.value = true
}
async function handleAssign() {
  if (!assignForm.assigneeName.trim()) { ElMessage.warning('请输入维修人员姓名'); return }
  submitting.value = true
  try {
    await request.put(`/work-orders/${assignTarget.value.id}/assign`, { assigneeName: assignForm.assigneeName })
    ElMessage.success('派单成功')
    assignVisible.value = false
    fetchData(); fetchStats()
  } catch { /* ignore */ }
  finally { submitting.value = false }
}

// ====== 状态推进（处理/验收） ======
async function handleAdvance(row: any, status: string) {
  try {
    await request.put(`/work-orders/${row.id}/advance`, { status })
    ElMessage.success(status === '处理中' ? '已开始处理' : '已提交验收')
    fetchData(); fetchStats()
  } catch { /* ignore */ }
}

// ====== 完工 ======
const finishVisible = ref(false)
const finishTarget = ref<any>(null)
const finishForm = reactive<any>({ solution: '', cost: 0 })
function showFinishDialog(row: any) {
  finishTarget.value = row
  finishForm.solution = ''
  finishForm.cost = 0
  finishVisible.value = true
}
async function handleFinish() {
  submitting.value = true
  try {
    await request.put(`/work-orders/${finishTarget.value.id}/advance`, { status: '已完工', solution: finishForm.solution, cost: finishForm.cost })
    ElMessage.success('工单已完工')
    finishVisible.value = false
    fetchData(); fetchStats()
  } catch { /* ignore */ }
  finally { submitting.value = false }
}

// ====== 详情 ======
const detailVisible = ref(false)
const detail = ref<any>(null)
async function showDetail(row: any) {
  try {
    const res = await request.get(`/work-orders/${row.id}`)
    detail.value = res.data
    detailVisible.value = true
  } catch { /* ignore */ }
}

onMounted(() => {
  fetchStats()
  fetchOptions()
  fetchData()
})
</script>

<style lang="scss" scoped>
.work-order-list {
  .page-title { font-size: 18px; font-weight: 700; color: #0A3D62; margin-bottom: 16px; }
  .stats-row {
    display: flex; gap: 16px; margin-bottom: 16px;
    .stat-card {
      flex: 1; background: #fff; border-radius: 8px; padding: 16px 20px;
      text-align: center; box-shadow: 0 1px 4px rgba(0,0,0,0.06);
      .stat-value { font-size: 28px; font-weight: 700; color: #303133; }
      .stat-label { font-size: 13px; color: #909399; margin-top: 4px; }
      &.warning { border-left: 4px solid #E6A23C; .stat-value { color: #E6A23C; } }
      &.primary { border-left: 4px solid #409EFF; .stat-value { color: #409EFF; } }
      &.success { border-left: 4px solid #67C23A; .stat-value { color: #67C23A; } }
    }
  }
  .toolbar {
    display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;
    .search-group { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
  }
  .pre-wrap { white-space: pre-wrap; }
}
</style>
