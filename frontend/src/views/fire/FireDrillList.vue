<template>
  <div>
    <h2 class="page-title">消防演练记录</h2>
    <el-card>
      <el-row :gutter="12" style="margin-bottom:12px">
        <el-col :span="4"><el-select v-model="filters.propertyId" placeholder="房源" clearable @change="fetchData" style="width:100%"><el-option v-for="p in properties" :key="p.id" :label="p.name" :value="p.id" /></el-select></el-col>
        <el-col :span="4"><el-button type="primary" @click="showDialog(null)">记录演练</el-button></el-col>
      </el-row>
      <el-table :data="list" size="small" stripe>
        <el-table-column prop="property" label="房源" width="120"><template #default="{row}">{{ row.property?.name || '-' }}</template></el-table-column>
        <el-table-column prop="drillDate" label="演练日期" width="110" />
        <el-table-column prop="type" label="类型" width="100" />
        <el-table-column prop="organizer" label="组织方" width="120" />
        <el-table-column prop="participantCount" label="人数" width="60" />
        <el-table-column prop="duration" label="用时(分)" width="80" />
        <el-table-column prop="score" label="评分" width="70" />
        <el-table-column prop="summary" label="总结" min-width="160" show-overflow-tooltip />
        <el-table-column label="操作" width="100"><template #default="{row}"><el-button link size="small" @click="showDialog(row)">编辑</el-button><el-popconfirm title="确认删除?" @confirm="handleDelete(row.id)"><template #reference><el-button link size="small" type="danger">删除</el-button></template></el-popconfirm></template></el-table-column>
      </el-table>
      <el-pagination v-if="total>0" style="margin-top:12px" v-model:current-page="page" :page-size="20" :total="total" @current-change="fetchData" layout="total, prev, pager, next" />
    </el-card>

    <el-dialog :title="editing ? '编辑演练记录' : '记录演练'" v-model="dialogVisible" width="500px">
      <el-form :model="form" label-width="80px" size="small">
        <el-row :gutter="12"><el-col :span="12"><el-form-item label="房源"><el-select v-model="form.propertyId" style="width:100%"><el-option v-for="p in properties" :key="p.id" :label="p.name" :value="p.id" /></el-select></el-form-item></el-col><el-col :span="12"><el-form-item label="演练日期"><el-date-picker v-model="form.drillDate" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item></el-col></el-row>
        <el-row :gutter="12"><el-col :span="12"><el-form-item label="类型"><el-select v-model="form.type" style="width:100%"><el-option v-for="t in ['疏散演练','灭火演练','综合演练','桌面推演']" :key="t" :label="t" :value="t" /></el-select></el-form-item></el-col><el-col :span="12"><el-form-item label="组织方"><el-input v-model="form.organizer" /></el-form-item></el-col></el-row>
        <el-row :gutter="12"><el-col :span="8"><el-form-item label="人数"><el-input-number v-model="form.participantCount" :min="0" /></el-form-item></el-col><el-col :span="8"><el-form-item label="用时"><el-input-number v-model="form.duration" :min="0" /> 分</el-form-item></el-col><el-col :span="8"><el-form-item label="评分"><el-input-number v-model="form.score" :min="0" :max="100" /></el-form-item></el-col></el-row>
        <el-form-item label="总结"><el-input v-model="form.summary" type="textarea" :rows="2" /></el-form-item>
        <el-form-item label="发现问题"><el-input v-model="form.issues" type="textarea" :rows="2" /></el-form-item>
        <el-form-item label="改进措施"><el-input v-model="form.improvementPlan" type="textarea" :rows="2" /></el-form-item>
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
const filters = reactive<any>({ propertyId: null })
const dialogVisible = ref(false); const editing = ref(false)
const form = reactive<any>({ propertyId: null, drillDate: '', type: '综合演练', organizer: '', participantCount: 0, duration: 0, score: 0, summary: '', issues: '', improvementPlan: '' })

async function fetchData() {
  try { const res = await request.get('/fire-safety/drills', { params: { page: page.value, pageSize: 20, ...filters } }); list.value = res.data.list; total.value = res.data.total } catch {}
}
function showDialog(row: any) {
  editing.value = !!row
  if (row) { Object.assign(form, row) } else { Object.keys(form).forEach(k => (form as any)[k] = k === 'type' ? '综合演练' : (typeof (form as any)[k] === 'number' ? 0 : '')) }
  dialogVisible.value = true
}
async function handleSave() {
  try {
    if (editing.value) { await request.put('/fire-safety/drills/' + (form as any).id, form); ElMessage.success('已更新') }
    else { await request.post('/fire-safety/drills', form); ElMessage.success('已记录') }
    dialogVisible.value = false; fetchData()
  } catch {}
}
async function handleDelete(id: number) { try { await request.delete('/fire-safety/drills/' + id); ElMessage.success('已删除'); fetchData() } catch {} }
onMounted(async () => {
  try { const r = await request.get('/properties', { params: { pageSize: 200 } }); properties.value = r.data.list || [] } catch {}
  fetchData()
})
</script>

<style lang="scss" scoped>
.page-title { font-size: 18px; font-weight: 700; color: #1f2430; margin-bottom: 16px; }
</style>
