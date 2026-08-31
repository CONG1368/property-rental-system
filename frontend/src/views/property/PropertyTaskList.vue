<template>
  <div class="property-task-page">
    <el-row :gutter="16" class="stat-cards">
      <el-col :span="8"><div class="stat-card"><div class="stat-num pending">{{ stats.pending }}</div><div class="stat-label">待执行</div></div></el-col>
      <el-col :span="8"><div class="stat-card"><div class="stat-num done">{{ stats.done }}</div><div class="stat-label">已完成</div></div></el-col>
      <el-col :span="8"><div class="stat-card"><div class="stat-num fail">{{ stats.unqualified }}</div><div class="stat-label">不合格</div></div></el-col>
    </el-row>

    <div class="toolbar">
      <div class="search-group">
        <el-select v-model="filterType" placeholder="任务类型" clearable style="width:130px" @change="fetchData">
          <el-option v-for="t in types" :key="t" :label="t" :value="t" />
        </el-select>
        <el-select v-model="filterStatus" placeholder="状态" clearable style="width:130px" @change="fetchData">
          <el-option v-for="s in statuses" :key="s" :label="s" :value="s" />
        </el-select>
        <el-button type="primary" @click="fetchData">查询</el-button>
      </div>
      <div class="action-group"><el-button type="primary" @click="showForm(null)">新增任务</el-button></div>
    </div>

    <el-table :data="list" stripe v-loading="loading">
      <el-table-column prop="type" label="任务类型" width="100"><template #default="{ row }"><el-tag :type="typeTag(row.type)" size="small">{{ row.type }}</el-tag></template></el-table-column>
      <el-table-column prop="area" label="区域" min-width="140" show-overflow-tooltip />
      <el-table-column prop="frequency" label="频次" width="80" />
      <el-table-column prop="assignee" label="执行人" width="100" />
      <el-table-column prop="scheduleDate" label="计划日期" width="110" />
      <el-table-column prop="status" label="状态" width="90"><template #default="{ row }"><el-tag :type="statusTag(row.status)" size="small">{{ row.status }}</el-tag></template></el-table-column>
      <el-table-column prop="result" label="质检结果" width="100">
        <template #default="{ row }">
          <el-tag v-if="row.status === '已完成'" :type="resultTag(row.result)" size="small">{{ row.result }}</el-tag>
          <span v-else style="color:#c0c4cc">—</span>
        </template>
      </el-table-column>
      <el-table-column label="评分" width="70"><template #default="{ row }">{{ row.status === '已完成' ? row.qualityScore : '—' }}</template></el-table-column>
      <el-table-column label="操作" width="200" fixed="right">
        <template #default="{ row }">
          <el-button size="small" link type="primary" @click="showInspect(row)">质检</el-button>
          <el-button size="small" link @click="showForm(row)">编辑</el-button>
          <el-popconfirm title="确认删除该任务?" @confirm="handleDelete(row.id)">
            <template #reference><el-button size="small" link type="danger">删除</el-button></template>
          </el-popconfirm>
        </template>
      </el-table-column>
    </el-table>
    <el-pagination v-if="total > 0" v-model:current-page="page" :page-size="pageSize" :total="total" @current-change="fetchData" layout="total, prev, pager, next" style="margin-top:16px; justify-content:flex-end" />

    <!-- 新增/编辑 -->
    <el-dialog :title="editing ? '编辑任务' : '新增任务'" v-model="formVisible" width="560px">
      <el-form :model="form" label-width="90px">
        <el-form-item label="任务类型" required><el-select v-model="form.type" style="width:100%"><el-option v-for="t in types" :key="t" :label="t" :value="t" /></el-select></el-form-item>
        <el-form-item label="区域" required><el-input v-model="form.area" placeholder="如：A栋大堂 / 园区绿化带" /></el-form-item>
        <el-row :gutter="12">
          <el-col :span="12"><el-form-item label="频次"><el-select v-model="form.frequency" style="width:100%"><el-option v-for="f in frequencies" :key="f" :label="f" :value="f" /></el-select></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="计划日期"><el-date-picker v-model="form.scheduleDate" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item></el-col>
        </el-row>
        <el-form-item label="执行人"><el-input v-model="form.assignee" placeholder="保洁员/绿化工/保安/消杀员" /></el-form-item>
        <el-form-item label="状态"><el-select v-model="form.status" style="width:100%"><el-option v-for="s in statuses" :key="s" :label="s" :value="s" /></el-select></el-form-item>
        <el-form-item label="备注"><el-input v-model="form.remark" type="textarea" :rows="2" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="formVisible = false">取消</el-button><el-button type="primary" @click="handleSave">{{ editing ? '保存' : '创建' }}</el-button></template>
    </el-dialog>

    <!-- 质检 -->
    <el-dialog title="质检" v-model="inspectVisible" width="460px">
      <el-form :model="inspectForm" label-width="90px">
        <el-form-item label="质检结果"><el-select v-model="inspectForm.result" style="width:100%"><el-option v-for="r in results" :key="r" :label="r" :value="r" /></el-select></el-form-item>
        <el-form-item label="评分"><el-input-number v-model="inspectForm.qualityScore" :min="0" :max="100" style="width:100%" /></el-form-item>
        <el-form-item label="质检员"><el-input v-model="inspectForm.inspector" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="inspectVisible = false">取消</el-button><el-button type="primary" @click="handleInspect">提交质检</el-button></template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import request from '@/api/request'

const types = ['保洁', '绿化', '安保', '消杀']
const frequencies = ['单次', '每日', '每周', '每月']
const statuses = ['待执行', '进行中', '已完成', '已逾期']
const results = ['合格', '不合格', '待整改']

const list = ref<any[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const loading = ref(false)
const filterType = ref('')
const filterStatus = ref('')
const stats = ref({ pending: 0, done: 0, unqualified: 0 })

const formVisible = ref(false)
const editing = ref(false)
const editingId = ref<number | null>(null)
const form = reactive<any>({ type: '保洁', area: '', frequency: '单次', assignee: '', scheduleDate: '', status: '待执行', remark: '' })

const inspectVisible = ref(false)
const inspectId = ref<number | null>(null)
const inspectForm = reactive<any>({ result: '合格', qualityScore: 100, inspector: '' })

function typeTag(t: string): string { return ({ '保洁': 'primary', '绿化': 'success', '安保': 'warning', '消杀': 'danger' } as Record<string, string>)[t] || 'info' }
function statusTag(s: string): string { return ({ '待执行': 'warning', '进行中': 'primary', '已完成': 'success', '已逾期': 'danger' } as Record<string, string>)[s] || 'info' }
function resultTag(r: string): string { return ({ '合格': 'success', '不合格': 'danger', '待整改': 'warning' } as Record<string, string>)[r] || 'info' }

async function fetchStats() {
  try {
    const res = await request.get('/property-tasks/stats')
    const d = res.data || {}
    const byStatus: any[] = d.byStatus || []
    const byResult: any[] = d.byResult || []
    stats.value.pending = byStatus.find((s: any) => s.status === '待执行')?.count || 0
    stats.value.done = byStatus.find((s: any) => s.status === '已完成')?.count || 0
    stats.value.unqualified = byResult.find((s: any) => s.result === '不合格')?.count || 0
  } catch {}
}

async function fetchData() {
  loading.value = true
  try {
    const params: any = { page: page.value, pageSize: pageSize.value }
    if (filterType.value) params.type = filterType.value
    if (filterStatus.value) params.status = filterStatus.value
    const res = await request.get('/property-tasks', { params })
    list.value = res.data?.list || []
    total.value = res.data?.total || 0
  } catch {} finally { loading.value = false }
}

function resetForm() {
  Object.assign(form, { type: '保洁', area: '', frequency: '单次', assignee: '', scheduleDate: '', status: '待执行', remark: '' })
}

function showForm(row: any) {
  editing.value = !!row
  if (row) {
    editingId.value = row.id
    Object.assign(form, {
      type: row.type, area: row.area, frequency: row.frequency,
      assignee: row.assignee || '', scheduleDate: row.scheduleDate || '',
      status: row.status, remark: row.remark || '',
    })
  } else {
    editingId.value = null
    resetForm()
  }
  formVisible.value = true
}

async function handleSave() {
  if (!form.area) return ElMessage.warning('请输入区域')
  const payload: any = { ...form, scheduleDate: form.scheduleDate || null }
  try {
    if (editing.value) {
      await request.put('/property-tasks/' + editingId.value, payload)
      ElMessage.success('已更新')
    } else {
      await request.post('/property-tasks', payload)
      ElMessage.success('已创建')
    }
    formVisible.value = false
    fetchData()
    fetchStats()
  } catch (err: any) { ElMessage.error(err?.response?.data?.message || '操作失败') }
}

function showInspect(row: any) {
  inspectId.value = row.id
  Object.assign(inspectForm, { result: row.result || '合格', qualityScore: row.qualityScore || 100, inspector: row.inspector || '' })
  inspectVisible.value = true
}

async function handleInspect() {
  try {
    await request.post('/property-tasks/' + inspectId.value + '/complete', { ...inspectForm })
    ElMessage.success('质检已提交')
    inspectVisible.value = false
    fetchData()
    fetchStats()
  } catch (err: any) { ElMessage.error(err?.response?.data?.message || '操作失败') }
}

async function handleDelete(id: number) {
  try {
    await request.delete('/property-tasks/' + id)
    ElMessage.success('已删除')
    fetchData()
    fetchStats()
  } catch (err: any) { ElMessage.error(err?.response?.data?.message || '操作失败') }
}

onMounted(() => { fetchData(); fetchStats() })
</script>

<style lang="scss" scoped>
.property-task-page { padding: 0; }
.stat-cards { margin-bottom: 16px; }
.stat-card { background: #fff; border: 1px solid #ebeef5; border-radius: 8px; padding: 18px; text-align: center; }
.stat-num { font-size: 24px; font-weight: 700; color: #1f2430; }
.stat-num.pending { color: #E6A23C; }
.stat-num.done { color: #67C23A; }
.stat-num.fail { color: #F56C6C; }
.stat-label { margin-top: 6px; color: #909399; font-size: 13px; }
.toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 8px; }
.search-group { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.action-group { display: flex; gap: 8px; }
</style>
