<template>
  <div class="inventory-page">
    <el-row :gutter="16" class="stat-cards">
      <el-col :span="6"><div class="stat-card"><div class="stat-num">{{ stats.total }}</div><div class="stat-label">物料总数</div></div></el-col>
      <el-col :span="6"><div class="stat-card"><div class="stat-num normal">{{ stats.normal }}</div><div class="stat-label">正常</div></div></el-col>
      <el-col :span="6"><div class="stat-card"><div class="stat-num low">{{ stats.low }}</div><div class="stat-label">低库存</div></div></el-col>
      <el-col :span="6"><div class="stat-card"><div class="stat-num out">{{ stats.out }}</div><div class="stat-label">耗尽</div></div></el-col>
    </el-row>

    <div class="toolbar">
      <div class="search-group">
        <el-input v-model="searchKeyword" placeholder="搜索名称/规格/供应商/位置" clearable style="width:220px" @keyup.enter="fetchData" />
        <el-select v-model="filterCategory" placeholder="类别" clearable style="width:130px" @change="fetchData">
          <el-option v-for="c in categories" :key="c" :label="c" :value="c" />
        </el-select>
        <el-select v-model="filterStatus" placeholder="状态" clearable style="width:130px" @change="fetchData">
          <el-option v-for="s in statuses" :key="s" :label="s" :value="s" />
        </el-select>
        <el-button type="primary" @click="fetchData">查询</el-button>
      </div>
      <div class="action-group">
        <el-button type="primary" @click="showDialog()">新增物料</el-button>
      </div>
    </div>

    <TableSkeleton v-if="loading && !tableData.length" :rows="8" :columns="7" />
    <el-table v-show="!(loading && !tableData.length)" :data="tableData" stripe v-loading="loading">
      <el-table-column prop="name" label="名称" min-width="140" show-overflow-tooltip />
      <el-table-column prop="category" label="类别" width="90"><template #default="{ row }"><el-tag size="small">{{ row.category }}</el-tag></template></el-table-column>
      <el-table-column prop="spec" label="规格" width="120" show-overflow-tooltip />
      <el-table-column prop="unit" label="单位" width="70" />
      <el-table-column prop="quantity" label="数量" width="90" align="right" />
      <el-table-column prop="minQuantity" label="最低库存" width="100" align="right" />
      <el-table-column prop="location" label="位置" width="120" show-overflow-tooltip />
      <el-table-column prop="supplier" label="供应商" width="120" show-overflow-tooltip />
      <el-table-column prop="status" label="状态" width="90"><template #default="{ row }"><el-tag :type="statusType(row.status)" size="small">{{ row.status }}</el-tag></template></el-table-column>
      <el-table-column label="操作" width="200" fixed="right">
        <template #default="{ row }">
          <el-button size="small" link type="primary" @click="showInOut(row)">出入库</el-button>
          <el-button size="small" link @click="showDialog(row)">编辑</el-button>
          <el-popconfirm title="确定删除该物料?" @confirm="handleDelete(row.id)"><template #reference><el-button size="small" type="danger" link>删除</el-button></template></el-popconfirm>
        </template>
      </el-table-column>
          <template #empty>
        <EmptyState title="暂无物料" description="登记仓库物料后可跟踪出入库与库存" />
      </template>
    </el-table>
    <el-pagination v-if="total > 0" v-model:current-page="page" :total="total" :page-size="pageSize" @current-change="fetchData" layout="total, prev, pager, next" style="margin-top:16px; justify-content:flex-end" />

    <!-- 物料新增/编辑弹窗 -->
    <el-dialog :title="dialogTitle" v-model="dialogVisible" width="640px" @closed="resetForm">
      <el-form :model="form" :rules="rules" ref="formRef" label-width="90px">
        <el-row :gutter="12">
          <el-col :span="12"><el-form-item label="名称" prop="name"><el-input v-model="form.name" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="类别" prop="category"><el-select v-model="form.category" style="width:100%"><el-option v-for="c in categories" :key="c" :label="c" :value="c" /></el-select></el-form-item></el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="12"><el-form-item label="规格"><el-input v-model="form.spec" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="单位"><el-input v-model="form.unit" placeholder="如：件/个/箱" /></el-form-item></el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="12"><el-form-item label="数量" prop="quantity"><el-input-number v-model="form.quantity" :min="0" :precision="2" style="width:100%" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="最低库存"><el-input-number v-model="form.minQuantity" :min="0" :precision="2" style="width:100%" /></el-form-item></el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="12"><el-form-item label="位置"><el-input v-model="form.location" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="单价"><el-input-number v-model="form.price" :min="0" :precision="2" style="width:100%" /></el-form-item></el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="12"><el-form-item label="供应商"><el-input v-model="form.supplier" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="状态"><el-select v-model="form.status" style="width:100%"><el-option v-for="s in statuses" :key="s" :label="s" :value="s" /></el-select></el-form-item></el-col>
        </el-row>
        <el-form-item label="备注"><el-input v-model="form.notes" type="textarea" :rows="2" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="dialogVisible = false">取消</el-button><el-button type="primary" @click="handleSubmit">确定</el-button></template>
    </el-dialog>

    <!-- 出入库弹窗 -->
    <el-dialog title="出入库" v-model="inOutVisible" width="480px" @closed="resetInOut">
      <el-form :model="inOutForm" :rules="inOutRules" ref="inOutRef" label-width="90px">
        <el-form-item label="物料名称"><el-input :model-value="currentMaterial?.name || ''" disabled /></el-form-item>
        <el-form-item label="当前库存"><el-input :model-value="currentMaterial ? currentMaterial.quantity + ' ' + (currentMaterial.unit || '') : ''" disabled /></el-form-item>
        <el-form-item label="类型" prop="type"><el-select v-model="inOutForm.type" style="width:100%"><el-option v-for="t in inOutTypes" :key="t" :label="t" :value="t" /></el-select></el-form-item>
        <el-form-item label="数量" prop="quantity"><el-input-number v-model="inOutForm.quantity" :min="0.01" :precision="2" style="width:100%" /></el-form-item>
        <el-form-item label="操作人"><el-input v-model="inOutForm.operator" placeholder="请输入操作人" /></el-form-item>
        <el-form-item label="日期"><el-date-picker v-model="inOutForm.date" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item>
        <el-form-item label="备注"><el-input v-model="inOutForm.reason" type="textarea" :rows="2" placeholder="出入库原因/备注" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="inOutVisible = false">取消</el-button><el-button type="primary" @click="handleInOut">确定</el-button></template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import request from '@/api/request'

const categories = ['耗材', '备件', '工具', '劳保', '其他']
const statuses = ['正常', '低库存', '耗尽']
const inOutTypes = ['入库', '出库', '领用', '盘点']

const tableData = ref<any[]>([])
const loading = ref(false)
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
const searchKeyword = ref('')
const filterCategory = ref('')
const filterStatus = ref('')
const stats = ref({ total: 0, normal: 0, low: 0, out: 0 })

const dialogVisible = ref(false)
const formRef = ref()
const editingId = ref<number | null>(null)
const dialogTitle = computed(() => (editingId.value ? '编辑物料' : '新增物料'))
const form = reactive<any>({ name: '', category: '耗材', spec: '', unit: '', quantity: 0, minQuantity: 0, location: '', price: 0, supplier: '', status: '正常', notes: '' })

const inOutVisible = ref(false)
const inOutRef = ref()
const currentMaterial = ref<any>(null)
const inOutForm = reactive<any>({ type: '入库', quantity: 1, operator: '', date: '', reason: '' })

const rules = {
  name: [{ required: true, message: '请输入物料名称', trigger: 'blur' }],
  category: [{ required: true, message: '请选择类别', trigger: 'change' }],
}
const inOutRules = {
  type: [{ required: true, message: '请选择类型', trigger: 'change' }],
  quantity: [{ required: true, message: '请输入数量', trigger: 'blur' }],
}

function statusType(s: string): string {
  if (s === '正常') return 'success'
  if (s === '低库存') return 'warning'
  if (s === '耗尽') return 'danger'
  return 'info'
}

async function fetchData() {
  loading.value = true
  try {
    const params: any = { page: page.value, pageSize: pageSize.value }
    if (searchKeyword.value) params.keyword = searchKeyword.value
    if (filterCategory.value) params.category = filterCategory.value
    if (filterStatus.value) params.status = filterStatus.value
    const res = await request.get('/inventory/materials', { params })
    tableData.value = res.data?.list || []
    total.value = res.data?.total || 0
    const s = await request.get('/inventory/materials/stats')
    stats.value = s.data || { total: 0, normal: 0, low: 0, out: 0 }
  } catch { /* 静默 */ } finally { loading.value = false }
}

function showDialog(row?: any) {
  editingId.value = row?.id || null
  if (row) {
    Object.assign(form, {
      name: row.name, category: row.category, spec: row.spec || '', unit: row.unit || '',
      quantity: Number(row.quantity || 0), minQuantity: Number(row.minQuantity || 0),
      location: row.location || '', price: Number(row.price || 0),
      supplier: row.supplier || '', status: row.status, notes: row.notes || '',
    })
  }
  dialogVisible.value = true
}

function resetForm() {
  editingId.value = null
  Object.assign(form, { name: '', category: '耗材', spec: '', unit: '', quantity: 0, minQuantity: 0, location: '', price: 0, supplier: '', status: '正常', notes: '' })
}

async function handleSubmit() {
  try { await formRef.value?.validate() } catch { return }
  try {
    if (editingId.value) { await request.put(`/inventory/materials/${editingId.value}`, form); ElMessage.success('更新成功') }
    else { await request.post('/inventory/materials', form); ElMessage.success('创建成功') }
    dialogVisible.value = false
    fetchData()
  } catch (err: any) { ElMessage.error(err?.response?.data?.message || '操作失败') }
}

async function handleDelete(id: number) {
  try { await request.delete(`/inventory/materials/${id}`); ElMessage.success('已删除'); fetchData() }
  catch (err: any) { ElMessage.error(err?.response?.data?.message || '删除失败') }
}

function showInOut(row: any) {
  currentMaterial.value = row
  Object.assign(inOutForm, { type: '入库', quantity: 1, operator: '', date: new Date().toISOString().slice(0, 10), reason: '' })
  inOutVisible.value = true
}

function resetInOut() {
  currentMaterial.value = null
  Object.assign(inOutForm, { type: '入库', quantity: 1, operator: '', date: '', reason: '' })
}

async function handleInOut() {
  try { await inOutRef.value?.validate() } catch { return }
  try {
    await request.post(`/inventory/materials/${currentMaterial.value.id}/in-out`, inOutForm)
    ElMessage.success('操作成功')
    inOutVisible.value = false
    fetchData()
  } catch (err: any) { ElMessage.error(err?.response?.data?.message || '操作失败') }
}

onMounted(() => { fetchData() })
</script>

<style lang="scss" scoped>
.inventory-page { padding: 0; }
.stat-cards { margin-bottom: 16px; }
.stat-card { background: #fff; border: 1px solid #ebeef5; border-radius: 8px; padding: 18px; text-align: center; }
.stat-num { font-size: 24px; font-weight: 700; color: #1f2430; }
.stat-num.normal { color: #67C23A; }
.stat-num.low { color: #E6A23C; }
.stat-num.out { color: #F56C6C; }
.stat-label { margin-top: 6px; color: #909399; font-size: 13px; }
.toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 8px; }
.search-group { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.action-group { display: flex; gap: 8px; }
</style>
