<template>
  <div class="common-revenue-list">
    <h2 class="page-title">公共收益管理</h2>

    <!-- 统计卡片 -->
    <el-row :gutter="12" class="stats-row">
      <el-col :span="8">
        <div class="stat-card">
          <div class="stat-value">¥ {{ formatAmount(stats.totalAmount) }}</div>
          <div class="stat-label">总收益</div>
        </div>
      </el-col>
      <el-col :span="8">
        <div class="stat-card receivable">
          <div class="stat-value">¥ {{ formatAmount(stats.receivableAmount) }}</div>
          <div class="stat-label">应收</div>
        </div>
      </el-col>
      <el-col :span="8">
        <div class="stat-card received">
          <div class="stat-value">¥ {{ formatAmount(stats.receivedAmount) }}</div>
          <div class="stat-label">已入账</div>
        </div>
      </el-col>
    </el-row>

    <el-card>
      <!-- 工具栏 -->
      <div class="toolbar">
        <div class="search-group">
          <el-input v-model="keyword" placeholder="搜索项目/收款方" clearable style="width:200px" @keyup.enter="fetchData" @clear="fetchData" />
          <el-select v-model="filterType" placeholder="收益类型" clearable style="width:150px" @change="fetchData">
            <el-option v-for="t in typeOptions" :key="t" :label="t" :value="t" />
          </el-select>
          <el-select v-model="filterStatus" placeholder="状态" clearable style="width:130px" @change="fetchData">
            <el-option label="应收" value="应收" />
            <el-option label="已入账" value="已入账" />
            <el-option label="已核销" value="已核销" />
          </el-select>
          <el-button type="primary" @click="fetchData">查询</el-button>
        </div>
        <div class="action-group">
          <el-button type="primary" @click="showDialog(null)">新增收益</el-button>
        </div>
      </div>

      <!-- 表格 -->
      <el-table :data="list" stripe v-loading="loading" style="margin-top:12px">
        <el-table-column prop="item" label="项目" min-width="160" show-overflow-tooltip />
        <el-table-column prop="type" label="类型" width="120">
          <template #default="{ row }"><el-tag :type="typeTagType(row.type)" size="small">{{ row.type }}</el-tag></template>
        </el-table-column>
        <el-table-column label="关联房源" width="150" show-overflow-tooltip>
          <template #default="{ row }">{{ row.property?.name || '-' }}</template>
        </el-table-column>
        <el-table-column label="金额" width="130" align="right">
          <template #default="{ row }">¥ {{ formatAmount(row.amount) }}</template>
        </el-table-column>
        <el-table-column prop="payer" label="收款方" width="150" show-overflow-tooltip />
        <el-table-column prop="revenueDate" label="日期" width="110" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }"><el-tag :type="statusTagType(row.status)" size="small">{{ row.status }}</el-tag></template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button v-if="row.status === '应收'" link type="success" size="small" @click="showConfirmDialog(row)">入账</el-button>
            <el-button link size="small" @click="showDialog(row)">编辑</el-button>
            <el-popconfirm title="确认删除?" @confirm="handleDelete(row.id)">
              <template #reference><el-button link size="small" type="danger">删除</el-button></template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination v-if="total > 0" style="margin-top:12px; justify-content:flex-end" v-model:current-page="page" :page-size="pageSize" :total="total" @current-change="fetchData" layout="total, prev, pager, next" />
    </el-card>

    <!-- 新增/编辑弹窗 -->
    <el-dialog :title="editing ? '编辑收益' : '新增收益'" v-model="dialogVisible" width="620px">
      <el-form :model="form" label-width="100px" size="small">
        <el-form-item label="项目名称" required><el-input v-model="form.item" placeholder="如 电梯广告位、广场场地出租" /></el-form-item>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="收益类型"><el-select v-model="form.type" style="width:100%"><el-option v-for="t in typeOptions" :key="t" :label="t" :value="t" /></el-select></el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="金额"><el-input-number v-model="form.amount" :min="0" :precision="2" :step="100" style="width:100%" /></el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="收益日期"><el-date-picker v-model="form.revenueDate" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="收款方"><el-input v-model="form.payer" /></el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="关联房源"><el-select v-model="form.propertyId" clearable filterable style="width:100%" placeholder="可不选"><el-option v-for="p in properties" :key="p.id" :label="p.name" :value="p.id" /></el-select></el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="状态"><el-select v-model="form.status" style="width:100%"><el-option label="应收" value="应收" /><el-option label="已入账" value="已入账" /><el-option label="已核销" value="已核销" /></el-select></el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="入账科目"><el-select v-model="form.accountId" clearable filterable style="width:100%" placeholder="已入账时可选"><el-option v-for="a in accounts" :key="a.id" :label="a.code + ' ' + a.name" :value="a.id" /></el-select></el-form-item>
        <el-form-item label="备注"><el-input v-model="form.notes" type="textarea" :rows="2" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="dialogVisible = false">取消</el-button><el-button type="primary" @click="handleSave">{{ editing ? '保存' : '创建' }}</el-button></template>
    </el-dialog>

    <!-- 入账弹窗 -->
    <el-dialog title="收益入账" v-model="confirmVisible" width="460px">
      <el-form label-width="90px" size="small">
        <el-form-item label="项目">{{ confirmTarget?.item }}</el-form-item>
        <el-form-item label="金额">¥ {{ formatAmount(confirmTarget?.amount) }}</el-form-item>
        <el-form-item label="入账科目">
          <el-select v-model="confirmForm.accountId" filterable style="width:100%" placeholder="选择入账科目">
            <el-option v-for="a in accounts" :key="a.id" :label="a.code + ' ' + a.name" :value="a.id" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer><el-button @click="confirmVisible = false">取消</el-button><el-button type="primary" @click="doConfirm">确认入账</el-button></template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import request from '@/api/request'

const typeOptions = ['广告位', '场地出租', '公共区域经营', '停车收益', '其他']

const list = ref<any[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const loading = ref(false)
const keyword = ref('')
const filterType = ref('')
const filterStatus = ref('')
const properties = ref<any[]>([])
const accounts = ref<any[]>([])

const stats = reactive({ totalAmount: 0, receivableAmount: 0, receivedAmount: 0 })

const dialogVisible = ref(false)
const editing = ref(false)
const form = reactive<any>({ id: null, item: '', type: '广告位', amount: 0, revenueDate: '', payer: '', propertyId: null, status: '应收', accountId: null, notes: '' })

const confirmVisible = ref(false)
const confirmTarget = ref<any>(null)
const confirmForm = reactive({ accountId: null as number | null })

function formatAmount(v: any) { return Number(v || 0).toFixed(2) }
function typeTagType(t: string) {
  const map: Record<string, string> = { '广告位': '', '场地出租': 'success', '公共区域经营': 'warning', '停车收益': 'info', '其他': 'danger' }
  return map[t] || 'info'
}
function statusTagType(s: string) { return s === '已入账' ? 'success' : s === '已核销' ? 'info' : 'warning' }

function todayStr() {
  const d = new Date()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

async function fetchStats() {
  try {
    const res = await request.get('/common-revenues/stats')
    stats.totalAmount = res.data.totalAmount || 0
    stats.receivableAmount = res.data.receivableAmount || 0
    stats.receivedAmount = res.data.receivedAmount || 0
  } catch { /* ignore */ }
}

async function fetchData() {
  loading.value = true
  try {
    const params: any = { page: page.value, pageSize: pageSize.value }
    if (filterType.value) params.type = filterType.value
    if (filterStatus.value) params.status = filterStatus.value
    if (keyword.value) params.keyword = keyword.value
    const res = await request.get('/common-revenues', { params })
    list.value = res.data.list || []
    total.value = res.data.total || 0
  } catch { /* ignore */ }
  finally { loading.value = false }
}

async function fetchProperties() {
  try { const res = await request.get('/properties', { params: { pageSize: 500 } }); properties.value = res.data.list || [] } catch { /* ignore */ }
}

async function fetchAccounts() {
  try { const res = await request.get('/accounts', { params: { pageSize: 500 } }); accounts.value = res.data.list || [] } catch { /* ignore */ }
}

function showDialog(row: any) {
  editing.value = !!row
  if (row) {
    Object.assign(form, {
      id: row.id, item: row.item, type: row.type, amount: Number(row.amount),
      revenueDate: row.revenueDate, payer: row.payer, propertyId: row.propertyId ?? null,
      status: row.status, accountId: row.accountId ?? null, notes: row.notes,
    })
  } else {
    Object.assign(form, { id: null, item: '', type: '广告位', amount: 0, revenueDate: todayStr(), payer: '', propertyId: null, status: '应收', accountId: null, notes: '' })
  }
  dialogVisible.value = true
}

async function handleSave() {
  if (!form.item) { ElMessage.warning('请输入项目名称'); return }
  try {
    const payload: any = { ...form }
    if (!payload.propertyId) payload.propertyId = null
    if (!payload.accountId) payload.accountId = null
    if (editing.value) { await request.put('/common-revenues/' + form.id, payload); ElMessage.success('已更新') }
    else { await request.post('/common-revenues', payload); ElMessage.success('已创建') }
    dialogVisible.value = false
    fetchData(); fetchStats()
  } catch { /* ignore */ }
}

async function handleDelete(id: number) {
  try { await request.delete('/common-revenues/' + id); ElMessage.success('已删除'); fetchData(); fetchStats() } catch { /* ignore */ }
}

function showConfirmDialog(row: any) {
  confirmTarget.value = row
  confirmForm.accountId = row.accountId ?? null
  confirmVisible.value = true
}

async function doConfirm() {
  try {
    await request.put('/common-revenues/' + confirmTarget.value.id + '/confirm', { accountId: confirmForm.accountId || null })
    ElMessage.success('已入账')
    confirmVisible.value = false
    fetchData(); fetchStats()
  } catch { /* ignore */ }
}

onMounted(() => {
  fetchStats()
  fetchProperties()
  fetchAccounts()
  fetchData()
})
</script>

<style lang="scss" scoped>
.page-title { font-size: 18px; font-weight: 700; color: #0A3D62; margin-bottom: 16px; }
.stats-row { margin-bottom: 16px; }
.stat-card {
  background: #fff; border-radius: 8px; padding: 20px; text-align: center;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06); border-left: 4px solid #409EFF;
  .stat-value { font-size: 26px; font-weight: 700; color: #303133; }
  .stat-label { font-size: 13px; color: #909399; margin-top: 4px; }
  &.receivable { border-left-color: #E6A23C; .stat-value { color: #E6A23C; } }
  &.received { border-left-color: #67C23A; .stat-value { color: #67C23A; } }
}
.toolbar { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; }
.search-group { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
</style>
