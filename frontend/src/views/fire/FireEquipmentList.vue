<template>
  <div>
    <h2 class="page-title">消防器材台账</h2>
    <el-card>
      <el-row :gutter="12" style="margin-bottom:12px">
        <el-col :span="4"><el-select v-model="filters.propertyId" placeholder="房源" clearable @change="fetchData" style="width:100%"><el-option v-for="p in properties" :key="p.id" :label="p.name" :value="p.id" /></el-select></el-col>
        <el-col :span="3"><el-select v-model="filters.category" placeholder="类别" clearable @change="fetchData" style="width:100%"><el-option v-for="c in categories" :key="c" :label="c" :value="c" /></el-select></el-col>
        <el-col :span="3"><el-select v-model="filters.status" placeholder="状态" clearable @change="fetchData" style="width:100%"><el-option v-for="s in statuses" :key="s" :label="s" :value="s" /></el-select></el-col>
        <el-col :span="4"><el-button type="primary" @click="showDialog(null)">添加器材</el-button></el-col>
      </el-row>
      <el-table :data="list" size="small" stripe :row-class-name="rowClass">
        <el-table-column prop="property" label="房源" width="120"><template #default="{row}">{{ row.property?.name || '-' }}</template></el-table-column>
        <el-table-column prop="name" label="器材名称" min-width="160" />
        <el-table-column prop="category" label="类别" width="100" />
        <el-table-column prop="quantity" label="数量" width="60" />
        <el-table-column prop="location" label="位置" width="100" />
        <el-table-column prop="expiryDate" label="有效期至" width="110" />
        <el-table-column prop="status" label="状态" width="100"><template #default="{row}"><el-tag :type="row.status==='正常'?'success':row.status==='即将过期'?'warning':'danger'" size="small">{{ row.status }}</el-tag></template></el-table-column>
        <el-table-column prop="nextCheckDate" label="下次检查" width="110" />
        <el-table-column label="操作" width="100"><template #default="{row}"><el-button link size="small" @click="showDialog(row)">编辑</el-button><el-popconfirm title="确认删除?" @confirm="handleDelete(row.id)"><template #reference><el-button link size="small" type="danger">删除</el-button></template></el-popconfirm></template></el-table-column>
      </el-table>
      <el-pagination v-if="total>0" style="margin-top:12px" v-model:current-page="page" :page-size="20" :total="total" @current-change="fetchData" layout="total, prev, pager, next" />
    </el-card>

    <el-dialog :title="editing ? '编辑器材' : '添加器材'" v-model="dialogVisible" width="500px">
      <el-form :model="form" label-width="80px" size="small">
        <el-form-item label="房源"><el-select v-model="form.propertyId" style="width:100%"><el-option v-for="p in properties" :key="p.id" :label="p.name" :value="p.id" /></el-select></el-form-item>
        <el-row :gutter="12"><el-col :span="12"><el-form-item label="名称"><el-input v-model="form.name" /></el-form-item></el-col><el-col :span="12"><el-form-item label="类别"><el-select v-model="form.category" style="width:100%"><el-option v-for="c in categories" :key="c" :label="c" :value="c" /></el-select></el-form-item></el-col></el-row>
        <el-row :gutter="12"><el-col :span="8"><el-form-item label="型号"><el-input v-model="form.model" /></el-form-item></el-col><el-col :span="8"><el-form-item label="数量"><el-input-number v-model="form.quantity" :min="1" /></el-form-item></el-col><el-col :span="8"><el-form-item label="位置"><el-input v-model="form.location" /></el-form-item></el-col></el-row>
        <el-row :gutter="12"><el-col :span="12"><el-form-item label="有效期"><el-date-picker v-model="form.expiryDate" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item></el-col><el-col :span="12"><el-form-item label="下次检查"><el-date-picker v-model="form.nextCheckDate" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item></el-col></el-row>
        <el-form-item label="状态"><el-select v-model="form.status" style="width:100%"><el-option v-for="s in statuses" :key="s" :label="s" :value="s" /></el-select></el-form-item>
        <el-form-item label="备注"><el-input v-model="form.notes" type="textarea" :rows="2" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="dialogVisible=false">取消</el-button><el-button type="primary" @click="handleSave">{{ editing ? '保存' : '添加' }}</el-button></template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import request from '@/api/request'

const list = ref<any[]>([]); const total = ref(0); const page = ref(1)
const properties = ref<any[]>([])
const categories = ['灭火器','消火栓','烟感报警器','应急照明','疏散标志','防火门','自动喷淋','其他']
const statuses = ['正常','即将过期','已过期','待维修','已报废']
const filters = reactive<any>({ propertyId: null, category: '', status: '' })
const dialogVisible = ref(false); const editing = ref(false)
const form = reactive<any>({ propertyId: null, name: '', category: '灭火器', model: '', quantity: 1, location: '', expiryDate: '', nextCheckDate: '', status: '正常', notes: '' })

function rowClass({ row }: any) { if (row.status === '已过期') return 'row-expired'; if (row.status === '即将过期') return 'row-expiring'; return '' }

async function fetchData() {
  try { const res = await request.get('/fire-safety/equipment', { params: { page: page.value, pageSize: 20, ...filters } }); list.value = res.data.list; total.value = res.data.total } catch {}
}
function showDialog(row: any) {
  editing.value = !!row
  if (row) { Object.assign(form, row) } else { Object.keys(form).forEach(k => (form as any)[k] = k === 'quantity' ? 1 : k === 'category' ? '灭火器' : k === 'status' ? '正常' : '') }
  dialogVisible.value = true
}
async function handleSave() {
  try {
    if (editing.value) { await request.put('/fire-safety/equipment/' + (form as any).id, form); ElMessage.success('已更新') }
    else { await request.post('/fire-safety/equipment', form); ElMessage.success('已添加') }
    dialogVisible.value = false; fetchData()
  } catch {}
}
async function handleDelete(id: number) { try { await request.delete('/fire-safety/equipment/' + id); ElMessage.success('已删除'); fetchData() } catch {} }
onMounted(async () => {
  try { const r = await request.get('/properties', { params: { pageSize: 200 } }); properties.value = r.data.list || [] } catch {}
  fetchData()
})
</script>

<style lang="scss" scoped>
.page-title { font-size: 18px; font-weight: 700; color: #0A3D62; margin-bottom: 16px; }
:deep(.row-expired) { background: #fef0f0 !important; } :deep(.row-expiring) { background: #fdf6ec !important; }
</style>
