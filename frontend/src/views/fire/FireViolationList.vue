<template>
  <div>
    <h2 class="page-title">消防违规记录</h2>
    <el-card>
      <el-row :gutter="12" style="margin-bottom:12px">
        <el-col :span="4"><el-select v-model="filters.propertyId" placeholder="房源" clearable @change="fetchData" style="width:100%"><el-option v-for="p in properties" :key="p.id" :label="p.name" :value="p.id" /></el-select></el-col>
        <el-col :span="3"><el-select v-model="filters.status" placeholder="状态" clearable @change="fetchData" style="width:100%"><el-option v-for="s in vStatuses" :key="s" :label="s" :value="s" /></el-select></el-col>
        <el-col :span="3"><el-select v-model="filters.severity" placeholder="严重程度" clearable @change="fetchData" style="width:100%"><el-option v-for="s in ['一般隐患','重大隐患','紧急']" :key="s" :label="s" :value="s" /></el-select></el-col>
        <el-col :span="4"><el-button type="danger" @click="showDialog(null)">记录违规</el-button></el-col>
      </el-row>
      <el-table :data="list" size="small" stripe :row-class-name="rowClass">
        <el-table-column prop="property" label="房源" width="120"><template #default="{row}">{{ row.property?.name || '-' }}</template></el-table-column>
        <el-table-column prop="category" label="类别" width="100" />
        <el-table-column prop="description" label="描述" min-width="180" show-overflow-tooltip />
        <el-table-column prop="severity" label="严重程度" width="100"><template #default="{row}"><el-tag :type="row.severity==='紧急'?'danger':row.severity==='重大隐患'?'warning':'info'" size="small">{{ row.severity }}</el-tag></template></el-table-column>
        <el-table-column prop="deadline" label="整改期限" width="110" />
        <el-table-column prop="status" label="状态" width="100"><template #default="{row}"><el-tag :type="row.status==='已整改'||row.status==='已关闭'?'success':row.status==='逾期未改'?'danger':'warning'" size="small">{{ row.status }}</el-tag></template></el-table-column>
        <el-table-column label="操作" width="140"><template #default="{row}"><el-button link size="small" v-if="row.status==='待整改'||row.status==='整改中'" type="success" @click="handleRectify(row)">标记整改</el-button><el-button link size="small" @click="showDialog(row)">编辑</el-button></template></el-table-column>
      </el-table>
      <el-pagination v-if="total>0" style="margin-top:12px" v-model:current-page="page" :page-size="20" :total="total" @current-change="fetchData" layout="total, prev, pager, next" />
    </el-card>

    <el-dialog :title="editing ? '编辑违规记录' : '记录违规'" v-model="dialogVisible" width="600px">
      <el-form :model="form" label-width="80px" size="small">
        <el-row :gutter="12"><el-col :span="12"><el-form-item label="房源"><el-select v-model="form.propertyId" style="width:100%"><el-option v-for="p in properties" :key="p.id" :label="p.name" :value="p.id" /></el-select></el-form-item></el-col><el-col :span="12"><el-form-item label="发现日期"><el-date-picker v-model="form.violationDate" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item></el-col></el-row>
        <el-row :gutter="12"><el-col :span="8"><el-form-item label="类别"><el-select v-model="form.category" style="width:100%"><el-option v-for="c in ['器材缺失','通道堵塞','电气隐患','易燃易爆','擅自改造','其他']" :key="c" :label="c" :value="c" /></el-select></el-form-item></el-col><el-col :span="8"><el-form-item label="严重程度"><el-select v-model="form.severity" style="width:100%"><el-option v-for="s in ['一般隐患','重大隐患','紧急']" :key="s" :label="s" :value="s" /></el-select></el-form-item></el-col><el-col :span="8"><el-form-item label="状态"><el-select v-model="form.status" style="width:100%"><el-option v-for="s in vStatuses" :key="s" :label="s" :value="s" /></el-select></el-form-item></el-col></el-row>
        <el-form-item label="违规描述"><el-input v-model="form.description" type="textarea" :rows="2" /></el-form-item>
        <el-form-item label="整改要求"><el-input v-model="form.rectificationRequirement" type="textarea" :rows="2" /></el-form-item>
        <el-row :gutter="12"><el-col :span="12"><el-form-item label="整改期限"><el-date-picker v-model="form.deadline" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item></el-col><el-col :span="12"><el-form-item label="罚款金额"><el-input-number v-model="form.penaltyAmount" :min="0" :precision="2" style="width:100%" /></el-form-item></el-col></el-row>
      </el-form>
      <template #footer><el-button @click="dialogVisible=false">取消</el-button><el-button type="primary" @click="handleSave">{{ editing ? '保存' : '记录' }}</el-button></template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import request from '@/api/request'

const list = ref<any[]>([]); const total = ref(0); const page = ref(1)
const properties = ref<any[]>([])
const vStatuses = ['待整改','整改中','已整改','逾期未改','已关闭']
const filters = reactive<any>({ propertyId: null, status: '', severity: '' })
const dialogVisible = ref(false); const editing = ref(false)
const form = reactive<any>({ propertyId: null, violationDate: '', category: '其他', severity: '一般隐患', description: '', rectificationRequirement: '', deadline: '', penaltyAmount: 0, status: '待整改' })

function rowClass({ row }: any) { if (row.status === '逾期未改') return 'row-expired'; return '' }

async function fetchData() {
  try { const res = await request.get('/fire-safety/violations', { params: { page: page.value, pageSize: 20, ...filters } }); list.value = res.data.list; total.value = res.data.total } catch {}
}
function showDialog(row: any) {
  editing.value = !!row
  if (row) { Object.assign(form, row) } else { Object.keys(form).forEach(k => (form as any)[k] = k === 'status' ? '待整改' : k === 'category' ? '其他' : k === 'severity' ? '一般隐患' : '') }
  dialogVisible.value = true
}
async function handleSave() {
  try {
    if (editing.value) { await request.put('/fire-safety/violations/' + (form as any).id, form); ElMessage.success('已更新') }
    else { await request.post('/fire-safety/violations', form); ElMessage.success('已记录') }
    dialogVisible.value = false; fetchData()
  } catch {}
}
async function handleRectify(row: any) {
  try { await request.post('/fire-safety/violations/' + row.id + '/rectify', {}); ElMessage.success('已标记整改'); fetchData() } catch {}
}
onMounted(async () => {
  try { const r = await request.get('/properties', { params: { pageSize: 200 } }); properties.value = r.data.list || [] } catch {}
  fetchData()
})
</script>

<style lang="scss" scoped>
.page-title { font-size: 18px; font-weight: 700; color: #0A3D62; margin-bottom: 16px; }
:deep(.row-expired) { background: #fef0f0 !important; }
</style>
