<template>
  <div class="patrol-page">
    <el-row :gutter="16" class="stat-cards">
      <el-col :span="6"><div class="stat-card"><div class="stat-num">{{ stats.total }}</div><div class="stat-label">总巡更记录</div></div></el-col>
      <el-col :span="6"><div class="stat-card"><div class="stat-num">{{ stats.today }}</div><div class="stat-label">今日巡更</div></div></el-col>
      <el-col :span="6"><div class="stat-card"><div class="stat-num warn">{{ stats.abnormal }}</div><div class="stat-label">异常记录</div></div></el-col>
      <el-col :span="6"><div class="stat-card"><div class="stat-num done">{{ stats.todayAbnormal }}</div><div class="stat-label">今日异常</div></div></el-col>
    </el-row>

    <div class="toolbar">
      <div class="search-group">
        <el-date-picker v-model="dateRange" type="daterange" range-separator="至" start-placeholder="开始日期" end-placeholder="结束日期" value-format="YYYY-MM-DD" style="width:260px" @change="onFilterChange" />
        <el-select v-model="filterStatus" placeholder="状态筛选" clearable style="width:140px" @change="onFilterChange">
          <el-option label="正常" value="正常" />
          <el-option label="异常" value="异常" />
        </el-select>
        <el-button type="primary" @click="onFilterChange">查询</el-button>
      </div>
      <div class="action-group">
        <el-button type="primary" @click="showDialog()">新增巡更</el-button>
      </div>
    </div>

    <el-table :data="list" stripe v-loading="loading">
      <el-table-column prop="point" label="巡更点" width="140" show-overflow-tooltip />
      <el-table-column prop="route" label="路线" width="120" show-overflow-tooltip />
      <el-table-column prop="patrolDate" label="日期" width="110" />
      <el-table-column prop="patrolTime" label="时间" width="90" />
      <el-table-column prop="status" label="状态" width="90"><template #default="{ row }"><el-tag :type="row.status === '异常' ? 'danger' : 'success'" size="small">{{ row.status }}</el-tag></template></el-table-column>
      <el-table-column prop="inspector" label="巡更人" width="100" show-overflow-tooltip />
      <el-table-column prop="notes" label="备注" min-width="160" show-overflow-tooltip />
      <el-table-column label="操作" width="120" fixed="right">
        <template #default="{ row }">
          <el-button link size="small" @click="showDialog(row)">编辑</el-button>
          <el-popconfirm title="确定删除该记录?" @confirm="handleDelete(row.id)"><template #reference><el-button link size="small" type="danger">删除</el-button></template></el-popconfirm>
        </template>
      </el-table-column>
    </el-table>
    <el-pagination v-if="total > 0" v-model:current-page="page" :page-size="pageSize" :total="total" @current-change="fetchData" layout="total, prev, pager, next" style="margin-top:16px; justify-content:flex-end" />

    <el-dialog :title="editing ? '编辑巡更记录' : '新增巡更记录'" v-model="dialogVisible" width="560px" @closed="resetForm">
      <el-form :model="form" label-width="90px" size="small">
        <el-row :gutter="12">
          <el-col :span="12"><el-form-item label="巡更点"><el-input v-model="form.point" placeholder="如：东门岗亭" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="路线"><el-input v-model="form.route" placeholder="如：A区巡逻路线" /></el-form-item></el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="12"><el-form-item label="日期"><el-date-picker v-model="form.patrolDate" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="时间"><el-time-picker v-model="form.patrolTime" format="HH:mm" value-format="HH:mm" placeholder="选择时间" style="width:100%" /></el-form-item></el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="12"><el-form-item label="状态"><el-select v-model="form.status" style="width:100%"><el-option label="正常" value="正常" /><el-option label="异常" value="异常" /></el-select></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="巡更人"><el-input v-model="form.inspector" placeholder="巡更人姓名" /></el-form-item></el-col>
        </el-row>
        <el-form-item label="备注"><el-input v-model="form.notes" type="textarea" :rows="2" placeholder="异常情况等备注" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="dialogVisible = false">取消</el-button><el-button type="primary" @click="handleSave">{{ editing ? '保存' : '创建' }}</el-button></template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import request from '@/api/request'

const list = ref<any[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const loading = ref(false)
const filterStatus = ref('')
const dateRange = ref<string[] | null>(null)
const stats = ref({ total: 0, today: 0, abnormal: 0, todayAbnormal: 0 })

const dialogVisible = ref(false)
const editing = ref(false)
const form = reactive<any>({ id: null, point: '', route: '', patrolDate: '', patrolTime: '', status: '正常', inspector: '', notes: '' })

function onFilterChange() { page.value = 1; fetchData() }

async function fetchData() {
  loading.value = true
  try {
    const params: any = { page: page.value, pageSize: pageSize.value }
    if (filterStatus.value) params.status = filterStatus.value
    const range = dateRange.value
    if (range && range.length === 2) { params.startDate = range[0]; params.endDate = range[1] }
    const res = await request.get('/patrols', { params })
    list.value = res.data?.list || []
    total.value = res.data?.total || 0
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.message || '加载失败')
  } finally { loading.value = false }
}

async function fetchStats() {
  try {
    const res = await request.get('/patrols/stats')
    stats.value = {
      total: Number(res.data?.total || 0),
      today: Number(res.data?.today || 0),
      abnormal: Number(res.data?.abnormal || 0),
      todayAbnormal: Number(res.data?.todayAbnormal || 0),
    }
  } catch { /* 静默 */ }
}

function showDialog(row?: any) {
  editing.value = !!row
  if (row) {
    Object.assign(form, {
      id: row.id, point: row.point || '', route: row.route || '',
      patrolDate: row.patrolDate || '', patrolTime: row.patrolTime || '',
      status: row.status || '正常', inspector: row.inspector || '', notes: row.notes || '',
    })
  } else {
    resetForm()
  }
  dialogVisible.value = true
}

function resetForm() {
  Object.assign(form, { id: null, point: '', route: '', patrolDate: '', patrolTime: '', status: '正常', inspector: '', notes: '' })
}

async function handleSave() {
  if (!form.point) { ElMessage.warning('请输入巡更点'); return }
  if (!form.patrolDate) { ElMessage.warning('请选择巡更日期'); return }
  try {
    if (editing.value) { await request.put('/patrols/' + form.id, form); ElMessage.success('已更新') }
    else { await request.post('/patrols', form); ElMessage.success('已创建') }
    dialogVisible.value = false
    fetchData(); fetchStats()
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.message || '操作失败')
  }
}

async function handleDelete(id: number) {
  try { await request.delete('/patrols/' + id); ElMessage.success('已删除'); fetchData(); fetchStats() }
  catch (err: any) { ElMessage.error(err?.response?.data?.message || '删除失败') }
}

onMounted(() => {
  fetchData()
  fetchStats()
})
</script>

<style lang="scss" scoped>
.patrol-page { padding: 0; }
.stat-cards { margin-bottom: 16px; }
.stat-card { background: #fff; border: 1px solid #ebeef5; border-radius: 8px; padding: 18px; text-align: center; }
.stat-num { font-size: 24px; font-weight: 700; color: #0A3D62; }
.stat-num.warn { color: #E6A23C; }
.stat-num.done { color: #67C23A; }
.stat-label { margin-top: 6px; color: #909399; font-size: 13px; }
.toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 8px; }
.search-group { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.action-group { display: flex; gap: 8px; }
</style>
