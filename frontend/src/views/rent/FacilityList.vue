<template>
  <div>
    <h2 class="page-title">设施设备维保</h2>

    <el-row :gutter="16" class="stat-cards">
      <el-col :span="6"><div class="stat-card"><div class="stat-num">{{ stats.total }}</div><div class="stat-label">设备总数</div></div></el-col>
      <el-col :span="6"><div class="stat-card"><div class="stat-num good">{{ stats.normal }}</div><div class="stat-label">正常</div></div></el-col>
      <el-col :span="6"><div class="stat-card"><div class="stat-num warn">{{ stats.expiringSoon }}</div><div class="stat-label">待保养</div></div></el-col>
      <el-col :span="6"><div class="stat-card"><div class="stat-num bad">{{ stats.fault }}</div><div class="stat-label">故障</div></div></el-col>
    </el-row>

    <div class="toolbar">
      <div class="search-group">
        <el-select v-model="filters.status" placeholder="状态" clearable style="width:120px" @change="fetchData">
          <el-option v-for="s in statuses" :key="s" :label="s" :value="s" />
        </el-select>
        <el-select v-model="filters.category" placeholder="类别" clearable style="width:120px" @change="fetchData">
          <el-option v-for="c in categories" :key="c" :label="c" :value="c" />
        </el-select>
        <el-input v-model="filters.keyword" placeholder="名称/编码" clearable style="width:180px" @keyup.enter="fetchData" />
        <el-button type="primary" @click="fetchData">查询</el-button>
      </div>
      <div class="action-group">
        <el-button type="primary" @click="showDialog(null)">新增设备</el-button>
      </div>
    </div>

    <el-table :data="list" stripe size="small" v-loading="loading">
      <el-table-column prop="name" label="设备名称" min-width="140" />
      <el-table-column prop="code" label="编码" width="100" />
      <el-table-column prop="category" label="类别" width="90" />
      <el-table-column prop="location" label="位置" min-width="110" show-overflow-tooltip />
      <el-table-column prop="status" label="状态" width="90">
        <template #default="{ row }"><el-tag :type="statusType(row.status)" size="small">{{ row.status }}</el-tag></template>
      </el-table-column>
      <el-table-column prop="lastMaintainDate" label="上次维护" width="105" />
      <el-table-column prop="nextMaintainDate" label="下次维护" width="105" />
      <el-table-column label="操作" width="180" fixed="right">
        <template #default="{ row }">
          <el-button link size="small" type="primary" @click="showMaintain(row)">维护</el-button>
          <el-button link size="small" @click="showDetail(row)">详情</el-button>
          <el-button link size="small" @click="showDialog(row)">编辑</el-button>
          <el-popconfirm title="确认删除?" @confirm="handleDelete(row.id)">
            <template #reference><el-button link size="small" type="danger">删除</el-button></template>
          </el-popconfirm>
        </template>
      </el-table-column>
    </el-table>
    <el-pagination v-if="total > 0" style="margin-top:12px" v-model:current-page="page" :page-size="pageSize" :total="total" @current-change="fetchData" layout="total, prev, pager, next" />

    <!-- 新增/编辑设备 -->
    <el-dialog :title="editing ? '编辑设备' : '新增设备'" v-model="dialogVisible" width="640px">
      <el-form :model="form" label-width="90px" size="small">
        <el-form-item label="关联房源"><el-select v-model="form.propertyId" clearable placeholder="可选" style="width:100%"><el-option v-for="p in properties" :key="p.id" :label="p.name" :value="p.id" /></el-select></el-form-item>
        <el-row :gutter="12">
          <el-col :span="12"><el-form-item label="设备名称"><el-input v-model="form.name" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="设备编码"><el-input v-model="form.code" /></el-form-item></el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="12"><el-form-item label="类别"><el-select v-model="form.category" style="width:100%"><el-option v-for="c in categories" :key="c" :label="c" :value="c" /></el-select></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="状态"><el-select v-model="form.status" style="width:100%"><el-option v-for="s in statuses" :key="s" :label="s" :value="s" /></el-select></el-form-item></el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="12"><el-form-item label="品牌"><el-input v-model="form.brand" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="型号"><el-input v-model="form.model" /></el-form-item></el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="12"><el-form-item label="位置"><el-input v-model="form.location" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="维保单位"><el-input v-model="form.maintainer" /></el-form-item></el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="12"><el-form-item label="安装日期"><el-date-picker v-model="form.installDate" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="下次维护"><el-date-picker v-model="form.nextMaintainDate" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item></el-col>
        </el-row>
        <el-form-item label="备注"><el-input v-model="form.notes" type="textarea" :rows="2" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="dialogVisible = false">取消</el-button><el-button type="primary" @click="handleSave">{{ editing ? '保存' : '创建' }}</el-button></template>
    </el-dialog>

    <!-- 维护 -->
    <el-dialog title="设备维护" v-model="maintainVisible" width="520px">
      <el-form :model="maintainForm" label-width="90px" size="small">
        <el-form-item label="设备"><el-input :model-value="maintainTarget?.name || ''" disabled /></el-form-item>
        <el-row :gutter="12">
          <el-col :span="12"><el-form-item label="维护类型"><el-select v-model="maintainForm.type" style="width:100%"><el-option v-for="t in ['巡检','保养','维修']" :key="t" :label="t" :value="t" /></el-select></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="维护日期"><el-date-picker v-model="maintainForm.date" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item></el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="12"><el-form-item label="结果"><el-select v-model="maintainForm.result" style="width:100%"><el-option v-for="r in ['正常','异常','已修复']" :key="r" :label="r" :value="r" /></el-select></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="费用(元)"><el-input-number v-model="maintainForm.cost" :min="0" :precision="2" style="width:100%" /></el-form-item></el-col>
        </el-row>
        <el-form-item label="执行人"><el-input v-model="maintainForm.performer" /></el-form-item>
        <el-form-item label="维护内容"><el-input v-model="maintainForm.content" type="textarea" :rows="2" /></el-form-item>
        <el-form-item label="下次维护"><el-date-picker v-model="maintainForm.nextDate" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="maintainVisible = false">取消</el-button><el-button type="primary" @click="handleMaintain">提交</el-button></template>
    </el-dialog>

    <!-- 详情 -->
    <el-dialog title="设备详情" v-model="detailVisible" width="720px">
      <el-descriptions :column="2" border size="small">
        <el-descriptions-item label="设备名称">{{ detail.name }}</el-descriptions-item>
        <el-descriptions-item label="编码">{{ detail.code || '—' }}</el-descriptions-item>
        <el-descriptions-item label="类别">{{ detail.category }}</el-descriptions-item>
        <el-descriptions-item label="状态"><el-tag :type="statusType(detail.status)" size="small">{{ detail.status }}</el-tag></el-descriptions-item>
        <el-descriptions-item label="品牌">{{ detail.brand || '—' }}</el-descriptions-item>
        <el-descriptions-item label="型号">{{ detail.model || '—' }}</el-descriptions-item>
        <el-descriptions-item label="位置">{{ detail.location || '—' }}</el-descriptions-item>
        <el-descriptions-item label="关联房源">{{ detail.property?.name || '—' }}</el-descriptions-item>
        <el-descriptions-item label="安装日期">{{ detail.installDate || '—' }}</el-descriptions-item>
        <el-descriptions-item label="维保单位">{{ detail.maintainer || '—' }}</el-descriptions-item>
        <el-descriptions-item label="上次维护">{{ detail.lastMaintainDate || '—' }}</el-descriptions-item>
        <el-descriptions-item label="下次维护">{{ detail.nextMaintainDate || '—' }}</el-descriptions-item>
        <el-descriptions-item label="备注" :span="2">{{ detail.notes || '—' }}</el-descriptions-item>
      </el-descriptions>
      <el-divider content-position="left">维护记录</el-divider>
      <el-table :data="detail.maintenances || []" size="small" stripe max-height="260">
        <el-table-column prop="date" label="日期" width="100" />
        <el-table-column prop="type" label="类型" width="70" />
        <el-table-column prop="performer" label="执行人" width="90" />
        <el-table-column prop="content" label="内容" min-width="140" show-overflow-tooltip />
        <el-table-column prop="result" label="结果" width="80"><template #default="{ row }"><el-tag :type="row.result === '正常' ? 'success' : row.result === '已修复' ? 'warning' : 'danger'" size="small">{{ row.result }}</el-tag></template></el-table-column>
        <el-table-column prop="cost" label="费用" width="90" align="right" />
      </el-table>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import request from '@/api/request'

const list = ref<any[]>([]); const total = ref(0); const page = ref(1); const pageSize = ref(20)
const loading = ref(false)
const properties = ref<any[]>([])
const categories = ['电梯','水泵','配电','空调','消防','安防','给排水','其他']
const statuses = ['正常','保养中','维修中','停用','故障']
const filters = reactive<any>({ status: '', category: '', keyword: '' })
const stats = ref<any>({ total: 0, normal: 0, expiringSoon: 0, fault: 0 })

const dialogVisible = ref(false); const editing = ref(false)
const form = reactive<any>({ propertyId: null, name: '', code: '', category: '电梯', brand: '', model: '', location: '', installDate: '', status: '正常', maintainer: '', nextMaintainDate: '', notes: '' })

const maintainVisible = ref(false); const maintainTarget = ref<any>(null)
const maintainForm = reactive<any>({ type: '巡检', date: '', performer: '', content: '', result: '正常', cost: 0, nextDate: '' })

const detailVisible = ref(false); const detail = ref<any>({})

function statusType(s: string): string { return ({ '正常': 'success', '保养中': 'warning', '维修中': '', '停用': 'info', '故障': 'danger' } as Record<string, string>)[s] || 'info' }

async function fetchData() {
  loading.value = true
  try {
    const params: any = { page: page.value, pageSize: pageSize.value }
    if (filters.status) params.status = filters.status
    if (filters.category) params.category = filters.category
    if (filters.keyword) params.keyword = filters.keyword
    const res = await request.get('/facilities', { params })
    list.value = res.data?.list || []
    total.value = res.data?.total || 0
  } catch (err: any) { ElMessage.error(err?.response?.data?.message || '加载失败') } finally { loading.value = false }
}

async function fetchStats() {
  try { const res = await request.get('/facilities/stats'); stats.value = res.data || {} } catch {}
}

function resetForm() { Object.assign(form, { propertyId: null, name: '', code: '', category: '电梯', brand: '', model: '', location: '', installDate: '', status: '正常', maintainer: '', nextMaintainDate: '', notes: '' }) }

function showDialog(row: any) {
  editing.value = !!row
  if (row) { Object.assign(form, row) } else { resetForm() }
  dialogVisible.value = true
}

async function handleSave() {
  if (!form.name) return ElMessage.warning('请输入设备名称')
  try {
    if (editing.value) { await request.put('/facilities/' + (form as any).id, form); ElMessage.success('已更新') }
    else { await request.post('/facilities', form); ElMessage.success('已创建') }
    dialogVisible.value = false
    fetchData(); fetchStats()
  } catch (err: any) { ElMessage.error(err?.response?.data?.message || '保存失败') }
}

async function handleDelete(id: number) {
  try { await request.delete('/facilities/' + id); ElMessage.success('已删除'); fetchData(); fetchStats() } catch (err: any) { ElMessage.error(err?.response?.data?.message || '删除失败') }
}

function showMaintain(row: any) {
  maintainTarget.value = row
  maintainForm.type = '巡检'; maintainForm.date = new Date().toISOString().slice(0, 10)
  maintainForm.performer = ''; maintainForm.content = ''; maintainForm.result = '正常'; maintainForm.cost = 0; maintainForm.nextDate = ''
  maintainVisible.value = true
}

async function handleMaintain() {
  if (!maintainTarget.value) return
  try {
    await request.post('/facilities/' + maintainTarget.value.id + '/maintain', maintainForm)
    ElMessage.success('维护记录已提交')
    maintainVisible.value = false
    fetchData(); fetchStats()
  } catch (err: any) { ElMessage.error(err?.response?.data?.message || '提交失败') }
}

async function showDetail(row: any) {
  try {
    const res = await request.get('/facilities/' + row.id)
    detail.value = res.data || {}
    detailVisible.value = true
  } catch (err: any) { ElMessage.error(err?.response?.data?.message || '加载失败') }
}

onMounted(async () => {
  try { const r = await request.get('/properties', { params: { pageSize: 200 } }); properties.value = r.data?.list || [] } catch {}
  fetchData(); fetchStats()
})
</script>

<style lang="scss" scoped>
.page-title { font-size: 18px; font-weight: 700; color: #0A3D62; margin-bottom: 16px; }
.stat-cards { margin-bottom: 16px; }
.stat-card { background: #fff; border: 1px solid #ebeef5; border-radius: 8px; padding: 18px; text-align: center; }
.stat-num { font-size: 24px; font-weight: 700; color: #0A3D62; }
.stat-num.good { color: #67C23A; }
.stat-num.warn { color: #E6A23C; }
.stat-num.bad { color: #F56C6C; }
.stat-label { margin-top: 6px; color: #909399; font-size: 13px; }
.toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 8px; }
.search-group { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.action-group { display: flex; gap: 8px; }
</style>
