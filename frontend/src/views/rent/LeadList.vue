<template>
  <div class="lead-page">
    <h2 class="page-title">招租线索漏斗</h2>

    <!-- 漏斗统计卡片 -->
    <div class="stat-cards">
      <div class="stat-card"><div class="stat-num primary">{{ stats.funnel?.['新线索'] || 0 }}</div><div class="stat-label">新线索</div></div>
      <div class="stat-card"><div class="stat-num">{{ stats.funnel?.['已联系'] || 0 }}</div><div class="stat-label">已联系</div></div>
      <div class="stat-card"><div class="stat-num warning">{{ stats.funnel?.['已看房'] || 0 }}</div><div class="stat-label">已看房</div></div>
      <div class="stat-card"><div class="stat-num success">{{ stats.funnel?.['已成交'] || 0 }}</div><div class="stat-label">已成交</div></div>
      <div class="stat-card"><div class="stat-num info">{{ stats.funnel?.['已流失'] || 0 }}</div><div class="stat-label">已流失</div></div>
    </div>

    <!-- 工具栏 -->
    <div class="toolbar">
      <div class="search-group">
        <el-select v-model="filters.source" placeholder="来源渠道" clearable style="width:140px" @change="fetchData">
          <el-option v-for="s in sources" :key="s" :label="s" :value="s" />
        </el-select>
        <el-select v-model="filters.status" placeholder="状态" clearable style="width:130px" @change="fetchData">
          <el-option v-for="s in leadStatuses" :key="s" :label="s" :value="s" />
        </el-select>
        <el-input v-model="filters.keyword" placeholder="客户姓名/手机号" clearable style="width:200px" @keyup.enter="fetchData" />
        <el-button type="primary" @click="fetchData">查询</el-button>
      </div>
      <div class="action-group">
        <el-button type="primary" @click="showDialog(null)">新增线索</el-button>
      </div>
    </div>

    <!-- 线索表格 -->
    <TableSkeleton v-if="loading && !list.length" :rows="8" :columns="7" />
    <el-table v-show="!(loading && !list.length)" :data="list" size="small" stripe v-loading="loading">
      <el-table-column prop="name" label="客户姓名" min-width="110" />
      <el-table-column prop="phone" label="手机" width="130" />
      <el-table-column label="意向业态" width="100"><template #default="{ row }"><el-tag :type="interestTagType(row.interestType)" size="small">{{ row.interestType }}</el-tag></template></el-table-column>
      <el-table-column label="意向面积" width="100" align="right"><template #default="{ row }">{{ fmt(row.interestedArea) }}</template></el-table-column>
      <el-table-column label="预算" width="110" align="right"><template #default="{ row }">{{ fmt(row.budget) }}</template></el-table-column>
      <el-table-column label="来源" width="100"><template #default="{ row }"><el-tag :type="sourceTagType(row.source)" size="small">{{ row.source }}</el-tag></template></el-table-column>
      <el-table-column label="状态" width="100"><template #default="{ row }"><el-tag :type="statusTagType(row.status)" size="small">{{ row.status }}</el-tag></template></el-table-column>
      <el-table-column prop="nextFollowDate" label="下次跟进" width="110"><template #default="{ row }">{{ row.nextFollowDate || '-' }}</template></el-table-column>
      <el-table-column label="操作" width="200" fixed="right">
        <template #default="{ row }">
          <el-button link size="small" type="primary" @click="showFollow(row)">跟进</el-button>
          <el-button link size="small" type="warning" @click="showViewing(row)">看房</el-button>
          <el-button link size="small" @click="showDialog(row)">编辑</el-button>
          <el-popconfirm title="确认删除该线索?" @confirm="handleDelete(row.id)">
            <template #reference><el-button link size="small" type="danger">删除</el-button></template>
          </el-popconfirm>
        </template>
      </el-table-column>
          <template #empty>
        <EmptyState title="暂无招租线索" description="录入意向客户后可跟进带看与成交" />
      </template>
    </el-table>
    <el-pagination v-if="total > 0" v-model:current-page="page" :page-size="pageSize" :total="total" @current-change="fetchData" layout="total, prev, pager, next" style="margin-top:16px; justify-content:flex-end" />

    <!-- 新增/编辑线索 -->
    <el-dialog :title="editing ? '编辑线索' : '新增线索'" v-model="dialogVisible" width="560px">
      <el-form :model="form" label-width="90px" size="small">
        <el-row :gutter="12">
          <el-col :span="12"><el-form-item label="客户姓名" required><el-input v-model="form.name" placeholder="请输入客户姓名" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="手机号" required><el-input v-model="form.phone" placeholder="请输入手机号" /></el-form-item></el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="12"><el-form-item label="来源渠道"><el-select v-model="form.source" style="width:100%"><el-option v-for="s in sources" :key="s" :label="s" :value="s" /></el-select></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="意向业态"><el-select v-model="form.interestType" style="width:100%"><el-option v-for="t in interestTypes" :key="t" :label="t" :value="t" /></el-select></el-form-item></el-col>
        </el-row>
        <el-form-item label="意向房源"><el-select v-model="form.propertyId" clearable filterable style="width:100%" placeholder="可选项，选填"><el-option v-for="p in properties" :key="p.id" :label="p.name" :value="p.id" /></el-select></el-form-item>
        <el-row :gutter="12">
          <el-col :span="12"><el-form-item label="意向面积"><el-input-number v-model="form.interestedArea" :min="0" :precision="2" :controls="false" style="width:100%" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="预算(元)"><el-input-number v-model="form.budget" :min="0" :precision="2" :controls="false" style="width:100%" /></el-form-item></el-col>
        </el-row>
        <el-form-item label="备注"><el-input v-model="form.remark" type="textarea" :rows="2" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="dialogVisible = false">取消</el-button><el-button type="primary" @click="handleSave">{{ editing ? '保存' : '创建' }}</el-button></template>
    </el-dialog>

    <!-- 跟进 -->
    <el-dialog title="跟进线索" v-model="followVisible" width="460px">
      <el-form :model="followForm" label-width="90px" size="small">
        <el-form-item label="新状态"><el-select v-model="followForm.status" style="width:100%"><el-option v-for="s in leadStatuses" :key="s" :label="s" :value="s" /></el-select></el-form-item>
        <el-form-item label="下次跟进"><el-date-picker v-model="followForm.nextFollowDate" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item>
        <el-form-item label="跟进备注"><el-input v-model="followForm.remark" type="textarea" :rows="2" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="followVisible = false">取消</el-button><el-button type="primary" @click="handleFollow">保存</el-button></template>
    </el-dialog>

    <!-- 看房 -->
    <el-dialog title="登记看房" v-model="viewingVisible" width="460px">
      <el-form :model="viewingForm" label-width="90px" size="small">
        <el-form-item label="房源"><el-select v-model="viewingForm.propertyId" clearable filterable style="width:100%" placeholder="可选项，选填"><el-option v-for="p in properties" :key="p.id" :label="p.name" :value="p.id" /></el-select></el-form-item>
        <el-form-item label="看房日期" required><el-date-picker v-model="viewingForm.viewingDate" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item>
        <el-form-item label="看房状态"><el-select v-model="viewingForm.status" style="width:100%"><el-option v-for="s in viewingStatuses" :key="s" :label="s" :value="s" /></el-select></el-form-item>
        <el-form-item label="备注"><el-input v-model="viewingForm.notes" type="textarea" :rows="2" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="viewingVisible = false">取消</el-button><el-button type="primary" @click="handleViewing">保存</el-button></template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import request from '@/api/request'

const list = ref<any[]>([]); const total = ref(0); const page = ref(1); const pageSize = ref(20); const loading = ref(false)
const properties = ref<any[]>([])
const stats = ref<any>({ funnel: {}, bySource: [] })

const sources = ['58同城', '贝壳', '小红书', '抖音', '线下', '转介绍', '其他']
const leadStatuses = ['新线索', '已联系', '已看房', '已成交', '已流失']
const interestTypes = ['公寓', '厂房', '商铺']
const viewingStatuses = ['已预约', '已完成', '已取消', '爽约']

const filters = reactive<any>({ source: '', status: '', keyword: '' })

const dialogVisible = ref(false); const editing = ref(false)
const form = reactive<any>({ id: null, name: '', phone: '', source: '其他', interestType: '公寓', propertyId: null, interestedArea: 0, budget: 0, remark: '' })

const followVisible = ref(false); const followId = ref<number | null>(null)
const followForm = reactive<any>({ status: '已联系', nextFollowDate: '', remark: '' })

const viewingVisible = ref(false); const viewingLeadId = ref<number | null>(null)
const viewingForm = reactive<any>({ propertyId: null, viewingDate: '', status: '已预约', notes: '' })

function fmt(v: any): string { return Number(v || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
function statusTagType(s: string): any { return ({ '新线索': 'primary', '已联系': '', '已看房': 'warning', '已成交': 'success', '已流失': 'info' } as any)[s] || 'info' }
function sourceTagType(s: string): any { return ({ '58同城': 'primary', '贝壳': 'success', '小红书': 'danger', '抖音': 'warning', '线下': 'info', '转介绍': '', '其他': 'info' } as any)[s] || 'info' }
function interestTagType(t: string): any { return ({ '公寓': 'primary', '厂房': 'warning', '商铺': 'success' } as any)[t] || 'info' }

async function fetchData() {
  loading.value = true
  try {
    const params: any = { page: page.value, pageSize: pageSize.value }
    if (filters.source) params.source = filters.source
    if (filters.status) params.status = filters.status
    if (filters.keyword) params.keyword = filters.keyword
    const res = await request.get('/leads', { params })
    list.value = res.data?.list || []
    total.value = res.data?.total || 0
  } catch { /* 静默 */ } finally { loading.value = false }
}
async function fetchStats() {
  try { const res = await request.get('/leads/stats'); stats.value = res.data || { funnel: {}, bySource: [] } } catch { /* 静默 */ }
}

function showDialog(row: any) {
  editing.value = !!row
  if (row) {
    Object.assign(form, { id: row.id, name: row.name, phone: row.phone, source: row.source, interestType: row.interestType, propertyId: row.propertyId ?? null, interestedArea: Number(row.interestedArea) || 0, budget: Number(row.budget) || 0, remark: row.remark || '' })
  } else {
    Object.assign(form, { id: null, name: '', phone: '', source: '其他', interestType: '公寓', propertyId: null, interestedArea: 0, budget: 0, remark: '' })
  }
  dialogVisible.value = true
}
async function handleSave() {
  if (!form.name) return ElMessage.warning('请输入客户姓名')
  if (!form.phone) return ElMessage.warning('请输入手机号')
  try {
    if (editing.value) { await request.put('/leads/' + form.id, form); ElMessage.success('线索已更新') }
    else { await request.post('/leads', form); ElMessage.success('线索已创建') }
    dialogVisible.value = false; fetchData(); fetchStats()
  } catch (err: any) { ElMessage.error(err?.response?.data?.message || '操作失败') }
}

function showFollow(row: any) {
  followId.value = row.id
  Object.assign(followForm, { status: row.status, nextFollowDate: row.nextFollowDate || '', remark: row.remark || '' })
  followVisible.value = true
}
async function handleFollow() {
  try {
    await request.put('/leads/' + followId.value + '/advance', followForm)
    ElMessage.success('跟进已更新'); followVisible.value = false; fetchData(); fetchStats()
  } catch (err: any) { ElMessage.error(err?.response?.data?.message || '操作失败') }
}

function showViewing(row: any) {
  viewingLeadId.value = row.id
  Object.assign(viewingForm, { propertyId: row.propertyId ?? null, viewingDate: new Date().toISOString().slice(0, 10), status: '已预约', notes: '' })
  viewingVisible.value = true
}
async function handleViewing() {
  if (!viewingForm.viewingDate) return ElMessage.warning('请选择看房日期')
  try {
    await request.post('/leads/' + viewingLeadId.value + '/viewings', viewingForm)
    ElMessage.success('看房记录已创建'); viewingVisible.value = false; fetchData(); fetchStats()
  } catch (err: any) { ElMessage.error(err?.response?.data?.message || '操作失败') }
}

async function handleDelete(id: number) {
  try { await request.delete('/leads/' + id); ElMessage.success('线索已删除'); fetchData(); fetchStats() } catch { /* 静默 */ }
}

onMounted(async () => {
  try { const r = await request.get('/properties', { params: { pageSize: 200 } }); properties.value = r.data?.list || [] } catch { /* 静默 */ }
  fetchData(); fetchStats()
})
</script>

<style lang="scss" scoped>
.page-title { font-size: 18px; font-weight: 700; color: #1f2430; margin-bottom: 16px; }
.stat-cards { display: flex; gap: 16px; margin-bottom: 16px; flex-wrap: wrap; }
.stat-card { flex: 1; min-width: 140px; background: #fff; border: 1px solid #ebeef5; border-radius: 8px; padding: 18px; text-align: center; }
.stat-num { font-size: 24px; font-weight: 700; color: #1f2430; }
.stat-num.primary { color: #409EFF; }
.stat-num.warning { color: #E6A23C; }
.stat-num.success { color: #67C23A; }
.stat-num.info { color: #909399; }
.stat-label { margin-top: 6px; color: #909399; font-size: 13px; }
.toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 8px; }
.search-group { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.action-group { display: flex; gap: 8px; }
</style>
