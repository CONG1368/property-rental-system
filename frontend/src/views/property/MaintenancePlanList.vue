<template>
  <div>
    <h2 class="page-title">周期性维保计划</h2>

    <el-row :gutter="16" class="stat-cards">
      <el-col :span="8"><div class="stat-card"><div class="stat-num">{{ stats.total }}</div><div class="stat-label">计划总数</div></div></el-col>
      <el-col :span="8"><div class="stat-card"><div class="stat-num good">{{ stats.enabled }}</div><div class="stat-label">启用</div></div></el-col>
      <el-col :span="8"><div class="stat-card"><div class="stat-num warn">{{ stats.dueSoon }}</div><div class="stat-label">30天内到期</div></div></el-col>
    </el-row>

    <div class="toolbar">
      <div class="search-group">
        <el-select v-model="filters.status" placeholder="状态" clearable style="width:130px" @change="fetchData">
          <el-option label="启用" value="启用" />
          <el-option label="停用" value="停用" />
        </el-select>
        <el-button type="primary" @click="fetchData">查询</el-button>
      </div>
      <div class="action-group">
        <el-button type="primary" @click="showDialog(null)">新增计划</el-button>
      </div>
    </div>

    <el-table :data="list" stripe size="small" v-loading="loading">
      <el-table-column prop="name" label="计划名称" min-width="150" />
      <el-table-column label="关联设备" min-width="140"><template #default="{ row }">{{ row.facility?.name || '-' }}</template></el-table-column>
      <el-table-column prop="cycleType" label="周期" width="80" />
      <el-table-column prop="nextRunDate" label="下次执行" width="110" />
      <el-table-column prop="assignee" label="执行人" width="100" />
      <el-table-column prop="status" label="状态" width="80"><template #default="{ row }"><el-tag :type="row.status === '启用' ? 'success' : 'info'" size="small">{{ row.status }}</el-tag></template></el-table-column>
      <el-table-column label="操作" width="220" fixed="right">
        <template #default="{ row }">
          <el-popconfirm title="确认生成一次维保并推进周期?" @confirm="handleGenerate(row)">
            <template #reference><el-button link size="small" type="primary">生成维保</el-button></template>
          </el-popconfirm>
          <el-button link size="small" @click="showDialog(row)">编辑</el-button>
          <el-popconfirm title="确认删除?" @confirm="handleDelete(row.id)">
            <template #reference><el-button link size="small" type="danger">删除</el-button></template>
          </el-popconfirm>
        </template>
      </el-table-column>
    </el-table>
    <el-pagination v-if="total > 0" style="margin-top:12px" v-model:current-page="page" :page-size="pageSize" :total="total" @current-change="fetchData" layout="total, prev, pager, next" />

    <el-dialog :title="editing ? '编辑计划' : '新增计划'" v-model="dialogVisible" width="560px">
      <el-form :model="form" label-width="90px" size="small">
        <el-form-item label="计划名称"><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="关联设备"><el-select v-model="form.facilityId" clearable placeholder="可选" style="width:100%"><el-option v-for="f in facilities" :key="f.id" :label="f.name" :value="f.id" /></el-select></el-form-item>
        <el-form-item label="周期"><el-select v-model="form.cycleType" style="width:100%"><el-option v-for="t in cycleTypes" :key="t" :label="t" :value="t" /></el-select></el-form-item>
        <el-form-item label="执行人"><el-input v-model="form.assignee" /></el-form-item>
        <el-form-item label="内容"><el-input v-model="form.content" type="textarea" :rows="3" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="dialogVisible = false">取消</el-button><el-button type="primary" @click="handleSave">{{ editing ? '保存' : '创建' }}</el-button></template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import request from '@/api/request'

const list = ref<any[]>([]); const total = ref(0); const page = ref(1); const pageSize = ref(20)
const loading = ref(false)
const facilities = ref<any[]>([])
const cycleTypes = ['月', '季', '半年', '年']
const cycleMonthsMap: Record<string, number> = { '月': 1, '季': 3, '半年': 6, '年': 12 }
const filters = reactive<any>({ status: '' })
const stats = ref<any>({ total: 0, enabled: 0, dueSoon: 0 })

const dialogVisible = ref(false); const editing = ref(false)
const form = reactive<any>({ facilityId: null, name: '', cycleType: '月', assignee: '', content: '' })

function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  const nd = new Date(d.getFullYear(), d.getMonth() + months, d.getDate())
  const y = nd.getFullYear()
  const m = String(nd.getMonth() + 1).padStart(2, '0')
  const day = String(nd.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

async function fetchData() {
  loading.value = true
  try {
    const params: any = { page: page.value, pageSize: pageSize.value }
    if (filters.status) params.status = filters.status
    const res = await request.get('/maintenance-plans', { params })
    list.value = res.data?.list || []
    total.value = res.data?.total || 0
  } catch (err: any) { ElMessage.error(err?.response?.data?.message || '加载失败') } finally { loading.value = false }
}

async function fetchStats() {
  try { const res = await request.get('/maintenance-plans/stats'); stats.value = res.data || {} } catch {}
}

function resetForm() { Object.assign(form, { facilityId: null, name: '', cycleType: '月', assignee: '', content: '' }) }

function showDialog(row: any) {
  editing.value = !!row
  if (row) { Object.assign(form, row) } else { resetForm() }
  dialogVisible.value = true
}

async function handleSave() {
  if (!form.name) return ElMessage.warning('请输入计划名称')
  const cycleMonths = cycleMonthsMap[form.cycleType] || 1
  const payload: any = { ...form, cycleMonths }
  if (!editing.value) {
    payload.nextRunDate = addMonths(new Date().toISOString().slice(0, 10), cycleMonths)
  }
  try {
    if (editing.value) { await request.put('/maintenance-plans/' + (form as any).id, payload); ElMessage.success('已更新') }
    else { await request.post('/maintenance-plans', payload); ElMessage.success('已创建') }
    dialogVisible.value = false
    fetchData(); fetchStats()
  } catch (err: any) { ElMessage.error(err?.response?.data?.message || '保存失败') }
}

async function handleDelete(id: number) {
  try { await request.delete('/maintenance-plans/' + id); ElMessage.success('已删除'); fetchData(); fetchStats() } catch (err: any) { ElMessage.error(err?.response?.data?.message || '删除失败') }
}

async function handleGenerate(row: any) {
  try {
    await request.post('/maintenance-plans/' + row.id + '/generate')
    ElMessage.success('维保已生成')
    fetchData(); fetchStats()
  } catch (err: any) { ElMessage.error(err?.response?.data?.message || '生成失败') }
}

onMounted(async () => {
  try { const r = await request.get('/facilities', { params: { pageSize: 200 } }); facilities.value = r.data?.list || [] } catch {}
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
.stat-label { margin-top: 6px; color: #909399; font-size: 13px; }
.toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 8px; }
.search-group { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.action-group { display: flex; gap: 8px; }
</style>
