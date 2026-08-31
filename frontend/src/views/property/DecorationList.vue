<template>
  <div class="deco-page">
    <el-row :gutter="16" class="stat-cards">
      <el-col :span="6"><div class="stat-card"><div class="stat-num warn">{{ stats.pending }}</div><div class="stat-label">待审批</div></div></el-col>
      <el-col :span="6"><div class="stat-card"><div class="stat-num">{{ stats.building }}</div><div class="stat-label">施工中</div></div></el-col>
      <el-col :span="6"><div class="stat-card"><div class="stat-num">{{ stats.finished }}</div><div class="stat-label">已完工</div></div></el-col>
      <el-col :span="6"><div class="stat-card"><div class="stat-num done">{{ stats.accepted }}</div><div class="stat-label">已验收</div></div></el-col>
    </el-row>

    <div class="toolbar">
      <div class="search-group">
        <el-select v-model="filterStatus" placeholder="状态筛选" clearable style="width:160px" @change="onFilterChange">
          <el-option v-for="s in statusOptions" :key="s" :label="s" :value="s" />
        </el-select>
        <el-button type="primary" @click="onFilterChange">查询</el-button>
      </div>
      <div class="action-group">
        <el-button type="primary" @click="showDialog()">新增申请</el-button>
      </div>
    </div>

    <el-table :data="list" stripe v-loading="loading">
      <el-table-column prop="applicant" label="申请单" width="110" show-overflow-tooltip />
      <el-table-column prop="tenant" label="客户" width="120"><template #default="{ row }">{{ row.tenant?.name || '-' }}</template></el-table-column>
      <el-table-column prop="type" label="类型" width="90"><template #default="{ row }"><el-tag :type="typeTag(row.type)" size="small">{{ row.type }}</el-tag></template></el-table-column>
      <el-table-column prop="company" label="施工方" width="150" show-overflow-tooltip />
      <el-table-column prop="applyDate" label="申请日期" width="110" />
      <el-table-column prop="status" label="状态" width="90"><template #default="{ row }"><el-tag :type="statusTag(row.status)" size="small">{{ row.status }}</el-tag></template></el-table-column>
      <el-table-column label="操作" min-width="300" fixed="right">
        <template #default="{ row }">
          <el-button v-if="canApprove(row)" link size="small" type="warning" @click="showApprove(row)">审批</el-button>
          <el-button v-if="canStart(row)" link size="small" type="primary" @click="quickAction(row, 'start')">开工</el-button>
          <el-button v-if="canFinish(row)" link size="small" type="primary" @click="quickAction(row, 'finish')">完工</el-button>
          <el-button v-if="canAccept(row)" link size="small" type="success" @click="quickAction(row, 'accept')">验收</el-button>
          <el-button link size="small" @click="showDialog(row)">编辑</el-button>
          <el-popconfirm title="确定删除该申请?" @confirm="handleDelete(row.id)"><template #reference><el-button link size="small" type="danger">删除</el-button></template></el-popconfirm>
        </template>
      </el-table-column>
    </el-table>
    <el-pagination v-if="total > 0" v-model:current-page="page" :page-size="pageSize" :total="total" @current-change="fetchData" layout="total, prev, pager, next" style="margin-top:16px; justify-content:flex-end" />

    <!-- 新增/编辑弹窗 -->
    <el-dialog :title="editing ? '编辑装修申请' : '新增装修申请'" v-model="dialogVisible" width="640px" @closed="resetForm">
      <el-form :model="form" label-width="90px" size="small">
        <el-row :gutter="12">
          <el-col :span="12"><el-form-item label="客户"><el-select v-model="form.tenantId" placeholder="选择客户" clearable filterable style="width:100%"><el-option v-for="t in tenants" :key="t.id" :label="t.name" :value="t.id" /></el-select></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="房源"><el-select v-model="form.propertyId" placeholder="选择房源" clearable filterable style="width:100%"><el-option v-for="p in properties" :key="p.id" :label="p.name" :value="p.id" /></el-select></el-form-item></el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="12"><el-form-item label="申请人"><el-input v-model="form.applicant" placeholder="请输入申请人" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="装修类型"><el-select v-model="form.type" style="width:100%"><el-option label="装修" value="装修" /><el-option label="改造" value="改造" /><el-option label="安装" value="安装" /></el-select></el-form-item></el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="12"><el-form-item label="施工方"><el-input v-model="form.company" placeholder="请输入施工方" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="申请日期"><el-date-picker v-model="form.applyDate" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item></el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="12"><el-form-item label="押金"><el-input-number v-model="form.depositAmount" :min="0" :precision="2" :step="100" style="width:100%" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="验收人"><el-input v-model="form.inspector" placeholder="验收人/检查人" /></el-form-item></el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="12"><el-form-item label="开工日期"><el-date-picker v-model="form.startDate" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="完工日期"><el-date-picker v-model="form.endDate" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item></el-col>
        </el-row>
        <el-form-item label="装修内容"><el-input v-model="form.content" type="textarea" :rows="2" placeholder="请输入装修/改造/安装内容" /></el-form-item>
        <el-form-item label="备注"><el-input v-model="form.remark" type="textarea" :rows="2" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="dialogVisible = false">取消</el-button><el-button type="primary" @click="handleSave">{{ editing ? '保存' : '创建' }}</el-button></template>
    </el-dialog>

    <!-- 审批弹窗 -->
    <el-dialog title="装修审批" v-model="approveVisible" width="520px">
      <el-descriptions :column="1" border size="small" style="margin-bottom:12px">
        <el-descriptions-item label="申请人">{{ approveRow?.applicant }}</el-descriptions-item>
        <el-descriptions-item label="类型">{{ approveRow?.type }}</el-descriptions-item>
        <el-descriptions-item label="施工方">{{ approveRow?.company || '-' }}</el-descriptions-item>
        <el-descriptions-item label="装修内容">{{ approveRow?.content || '-' }}</el-descriptions-item>
      </el-descriptions>
      <el-input v-model="approveRemark" type="textarea" :rows="2" placeholder="审批意见（可选）" />
      <template #footer>
        <el-button @click="approveVisible = false">取消</el-button>
        <el-button type="danger" @click="handleReject">驳回</el-button>
        <el-button type="success" @click="handleApprove">批准</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import request from '@/api/request'

const statusOptions = ['待审批', '审批中', '已批准', '已驳回', '施工中', '已完工', '已验收']

const list = ref<any[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const loading = ref(false)
const filterStatus = ref('')
const tenants = ref<any[]>([])
const properties = ref<any[]>([])
const stats = ref({ total: 0, pending: 0, building: 0, finished: 0, accepted: 0 })

const dialogVisible = ref(false)
const editing = ref(false)
const approveVisible = ref(false)
const approveRow = ref<any>(null)
const approveRemark = ref('')

const form = reactive<any>({
  id: null, tenantId: null, propertyId: null, applicant: '', type: '装修',
  company: '', applyDate: '', depositAmount: 0, inspector: '',
  startDate: '', endDate: '', content: '', remark: '',
})

function statusTag(s: string): any {
  const map: Record<string, any> = {
    '待审批': 'warning', '审批中': 'primary', '已批准': 'success', '已驳回': 'danger',
    '施工中': '', '已完工': 'info', '已验收': 'success',
  }
  return map[s] ?? 'info'
}
function typeTag(t: string): any {
  return t === '装修' ? 'primary' : t === '改造' ? 'warning' : 'success'
}
function canApprove(row: any): boolean { return ['待审批', '审批中'].includes(row.status) }
function canStart(row: any): boolean { return row.status === '已批准' }
function canFinish(row: any): boolean { return row.status === '施工中' }
function canAccept(row: any): boolean { return row.status === '已完工' }

function onFilterChange() { page.value = 1; fetchData() }

async function fetchData() {
  loading.value = true
  try {
    const params: any = { page: page.value, pageSize: pageSize.value }
    if (filterStatus.value) params.status = filterStatus.value
    const res = await request.get('/decorations', { params })
    list.value = res.data?.list || []
    total.value = res.data?.total || 0
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.message || '加载失败')
  } finally { loading.value = false }
}

async function fetchStats() {
  try {
    const res = await request.get('/decorations/stats')
    const map: Record<string, number> = {}
    ;(res.data?.byStatus || []).forEach((s: any) => { map[s.status] = Number(s.count) })
    stats.value = {
      total: Number(res.data?.total || 0),
      pending: map['待审批'] || 0,
      building: map['施工中'] || 0,
      finished: map['已完工'] || 0,
      accepted: map['已验收'] || 0,
    }
  } catch { /* 静默 */ }
}

async function loadOptions() {
  try {
    const [tr, pr] = await Promise.all([
      request.get('/tenants', { params: { pageSize: 200 } }),
      request.get('/properties', { params: { pageSize: 200 } }),
    ])
    tenants.value = tr.data?.list || []
    properties.value = pr.data?.list || []
  } catch { /* 静默 */ }
}

function showDialog(row?: any) {
  editing.value = !!row
  if (row) {
    Object.assign(form, {
      id: row.id, tenantId: row.tenantId ?? null, propertyId: row.propertyId ?? null,
      applicant: row.applicant || '', type: row.type || '装修', company: row.company || '',
      applyDate: row.applyDate || '', depositAmount: Number(row.depositAmount || 0),
      inspector: row.inspector || '', startDate: row.startDate || '', endDate: row.endDate || '',
      content: row.content || '', remark: row.remark || '',
    })
  } else {
    resetForm()
  }
  dialogVisible.value = true
}
function resetForm() {
  Object.assign(form, {
    id: null, tenantId: null, propertyId: null, applicant: '', type: '装修',
    company: '', applyDate: '', depositAmount: 0, inspector: '',
    startDate: '', endDate: '', content: '', remark: '',
  })
}

async function handleSave() {
  if (!form.applicant) { ElMessage.warning('请输入申请人'); return }
  try {
    if (editing.value) { await request.put('/decorations/' + form.id, form); ElMessage.success('已更新') }
    else { await request.post('/decorations', form); ElMessage.success('已创建') }
    dialogVisible.value = false
    fetchData(); fetchStats()
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.message || '操作失败')
  }
}

async function handleDelete(id: number) {
  try { await request.delete('/decorations/' + id); ElMessage.success('已删除'); fetchData(); fetchStats() }
  catch (err: any) { ElMessage.error(err?.response?.data?.message || '删除失败') }
}

function showApprove(row: any) {
  approveRow.value = row
  approveRemark.value = ''
  approveVisible.value = true
}

async function handleApprove() {
  try {
    await request.post('/decorations/' + approveRow.value.id + '/approve', { remark: approveRemark.value })
    ElMessage.success('审批已通过')
    approveVisible.value = false
    fetchData(); fetchStats()
  } catch (err: any) { ElMessage.error(err?.response?.data?.message || '操作失败') }
}

async function handleReject() {
  try {
    await request.post('/decorations/' + approveRow.value.id + '/reject', { remark: approveRemark.value })
    ElMessage.success('已驳回')
    approveVisible.value = false
    fetchData(); fetchStats()
  } catch (err: any) { ElMessage.error(err?.response?.data?.message || '操作失败') }
}

async function quickAction(row: any, action: 'start' | 'finish' | 'accept') {
  const label = action === 'start' ? '开工' : action === 'finish' ? '完工' : '验收'
  try {
    await ElMessageBox.confirm('确认对该申请执行「' + label + '」操作?', '提示', { type: 'warning' })
    await request.post('/decorations/' + row.id + '/' + action)
    ElMessage.success('操作成功')
    fetchData(); fetchStats()
  } catch (err: any) {
    if (err === 'cancel' || err === 'close') return
    ElMessage.error(err?.response?.data?.message || '操作失败')
  }
}

onMounted(() => {
  fetchData()
  fetchStats()
  loadOptions()
})
</script>

<style lang="scss" scoped>
.deco-page { padding: 0; }
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
