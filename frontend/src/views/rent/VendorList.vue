<template>
  <div class="vendor-page">
    <el-row :gutter="16" class="stat-cards">
      <el-col :span="8"><div class="stat-card"><div class="stat-num">{{ stats.total }}</div><div class="stat-label">供应商总数</div></div></el-col>
      <el-col :span="8"><div class="stat-card"><div class="stat-num good">{{ stats.cooperating }}</div><div class="stat-label">合作中</div></div></el-col>
      <el-col :span="8"><div class="stat-card"><div class="stat-num warn">{{ stats.paused }}</div><div class="stat-label">已暂停</div></div></el-col>
    </el-row>

    <div class="toolbar">
      <div class="search-group">
        <el-input v-model="searchKeyword" placeholder="搜索名称/联系人/电话/合同号" clearable style="width:220px" @keyup.enter="fetchData" />
        <el-select v-model="filterCategory" placeholder="类别" clearable style="width:120px" @change="fetchData">
          <el-option v-for="c in categories" :key="c" :label="c" :value="c" />
        </el-select>
        <el-select v-model="filterStatus" placeholder="状态" clearable style="width:120px" @change="fetchData">
          <el-option v-for="s in statuses" :key="s" :label="s" :value="s" />
        </el-select>
        <el-button type="primary" @click="fetchData">查询</el-button>
      </div>
      <div class="action-group"><el-button type="primary" @click="showDialog(null)">新增供应商</el-button></div>
    </div>

    <el-table :data="list" stripe v-loading="loading">
      <el-table-column prop="name" label="名称" min-width="150" show-overflow-tooltip />
      <el-table-column prop="category" label="类别" width="90"><template #default="{ row }"><el-tag :type="categoryTag(row.category)" size="small">{{ row.category }}</el-tag></template></el-table-column>
      <el-table-column prop="contact" label="联系人" width="100" />
      <el-table-column prop="phone" label="电话" width="130" />
      <el-table-column prop="contractNo" label="合同号" width="130" show-overflow-tooltip />
      <el-table-column prop="contractEnd" label="合同到期" width="110" />
      <el-table-column prop="price" label="价格" width="100"><template #default="{ row }">{{ fmtPrice(row.price) }}</template></el-table-column>
      <el-table-column label="评分" width="140"><template #default="{ row }"><el-rate :model-value="row.rating" disabled /></template></el-table-column>
      <el-table-column prop="status" label="状态" width="90"><template #default="{ row }"><el-tag :type="statusTag(row.status)" size="small">{{ row.status }}</el-tag></template></el-table-column>
      <el-table-column label="操作" width="140" fixed="right">
        <template #default="{ row }">
          <el-button link size="small" type="primary" @click="showDialog(row)">编辑</el-button>
          <el-popconfirm title="确认删除该供应商?" @confirm="handleDelete(row.id)"><template #reference><el-button link size="small" type="danger">删除</el-button></template></el-popconfirm>
        </template>
      </el-table-column>
    </el-table>
    <el-pagination v-if="total > 0" v-model:current-page="page" :page-size="pageSize" :total="total" @current-change="fetchData" layout="total, prev, pager, next" style="margin-top:16px; justify-content:flex-end" />

    <el-dialog :title="editing ? '编辑供应商' : '新增供应商'" v-model="dialogVisible" width="640px" @closed="resetForm">
      <el-form :model="form" label-width="90px">
        <el-form-item label="名称" required><el-input v-model="form.name" placeholder="供应商/外包公司名称" /></el-form-item>
        <el-row :gutter="12">
          <el-col :span="12"><el-form-item label="类别"><el-select v-model="form.category" style="width:100%"><el-option v-for="c in categories" :key="c" :label="c" :value="c" /></el-select></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="状态"><el-select v-model="form.status" style="width:100%"><el-option v-for="s in statuses" :key="s" :label="s" :value="s" /></el-select></el-form-item></el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="12"><el-form-item label="联系人"><el-input v-model="form.contact" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="电话"><el-input v-model="form.phone" /></el-form-item></el-col>
        </el-row>
        <el-form-item label="地址"><el-input v-model="form.address" /></el-form-item>
        <el-row :gutter="12">
          <el-col :span="12"><el-form-item label="合同号"><el-input v-model="form.contractNo" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="合同金额"><el-input-number v-model="form.price" :min="0" :precision="2" :step="100" style="width:100%" /></el-form-item></el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="12"><el-form-item label="合同开始"><el-date-picker v-model="form.contractStart" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="合同结束"><el-date-picker v-model="form.contractEnd" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item></el-col>
        </el-row>
        <el-form-item label="评分"><el-rate v-model="form.rating" /></el-form-item>
        <el-form-item label="备注"><el-input v-model="form.notes" type="textarea" :rows="3" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="dialogVisible = false">取消</el-button><el-button type="primary" @click="handleSave">{{ editing ? '保存' : '创建' }}</el-button></template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import request from '@/api/request'

const categories = ['维保', '保洁', '安保', '绿化', '消防', '装修', '其他']
const statuses = ['合作中', '已暂停', '已终止']
const list = ref<any[]>([]); const total = ref(0); const page = ref(1); const pageSize = ref(20); const loading = ref(false)
const searchKeyword = ref(''); const filterCategory = ref(''); const filterStatus = ref('')
const stats = ref({ total: 0, cooperating: 0, paused: 0, terminated: 0 })
const dialogVisible = ref(false); const editing = ref(false)
const defaultForm = () => ({ name: '', category: '维保', status: '合作中', contact: '', phone: '', address: '', contractNo: '', contractStart: '', contractEnd: '', price: 0, rating: 0, notes: '' })
const form = reactive<any>(defaultForm())

function categoryTag(c: string): string { return ({ '维保': 'primary', '保洁': 'success', '安保': 'warning', '绿化': 'success', '消防': 'danger', '装修': 'info', '其他': 'info' } as Record<string, string>)[c] || 'info' }
function statusTag(s: string): string { return ({ '合作中': 'success', '已暂停': 'warning', '已终止': 'info' } as Record<string, string>)[s] || 'info' }
function fmtPrice(v: any): string { const n = Number(v); return isNaN(n) ? '-' : '¥' + n.toFixed(2) }

async function fetchData() {
  loading.value = true
  try {
    const params: any = { page: page.value, pageSize: pageSize.value }
    if (searchKeyword.value) params.keyword = searchKeyword.value
    if (filterCategory.value) params.category = filterCategory.value
    if (filterStatus.value) params.status = filterStatus.value
    const res = await request.get('/vendors', { params })
    list.value = res.data?.list || []; total.value = res.data?.total || 0
    const s = await request.get('/vendors/stats')
    stats.value = s.data || { total: 0, cooperating: 0, paused: 0, terminated: 0 }
  } catch { /* 静默 */ } finally { loading.value = false }
}
function resetForm() { Object.assign(form, defaultForm()) }
function showDialog(row: any) {
  editing.value = !!row
  if (row) { Object.assign(form, row); form.price = Number(row.price) } else { resetForm() }
  dialogVisible.value = true
}
async function handleSave() {
  if (!form.name) return ElMessage.warning('请输入供应商名称')
  try {
    if (editing.value) { await request.put('/vendors/' + form.id, form); ElMessage.success('已更新') }
    else { await request.post('/vendors', form); ElMessage.success('已创建') }
    dialogVisible.value = false; fetchData()
  } catch (err: any) { ElMessage.error(err?.response?.data?.message || '操作失败') }
}
async function handleDelete(id: number) { try { await request.delete('/vendors/' + id); ElMessage.success('已删除'); fetchData() } catch (err: any) { ElMessage.error(err?.response?.data?.message || '操作失败') } }
onMounted(() => { fetchData() })
</script>

<style lang="scss" scoped>
.vendor-page { padding: 0; }
.stat-cards { margin-bottom: 16px; }
.stat-card { background: #fff; border: 1px solid #ebeef5; border-radius: 8px; padding: 18px; text-align: center; }
.stat-num { font-size: 24px; font-weight: 700; color: #1f2430; }
.stat-num.good { color: #67C23A; }
.stat-num.warn { color: #E6A23C; }
.stat-label { margin-top: 6px; color: #909399; font-size: 13px; }
.toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 8px; }
.search-group { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.action-group { display: flex; gap: 8px; }
</style>
