<template>
  <div>
    <h2 class="page-title">消防检查记录</h2>
    <el-card>
      <el-row :gutter="12" style="margin-bottom:12px">
        <el-col :span="6"><el-select v-model="filters.propertyId" placeholder="筛选房源" clearable @change="fetchData" style="width:100%"><el-option v-for="p in properties" :key="p.id" :label="p.name" :value="p.id" /></el-select></el-col>
        <el-col :span="4"><el-select v-model="filters.result" placeholder="检查结果" clearable @change="fetchData" style="width:100%"><el-option label="合格" value="合格" /><el-option label="不合格" value="不合格" /><el-option label="限期整改" value="限期整改" /></el-select></el-col>
        <el-col :span="6"><el-date-picker v-model="filters.dateRange" type="daterange" range-separator="至" start-placeholder="开始" end-placeholder="结束" @change="fetchData" style="width:100%" /></el-col>
        <el-col :span="4"><el-button type="primary" @click="showDialog(null)">新增检查</el-button></el-col>
      </el-row>
      <el-table :data="list" size="small" stripe @row-click="(row: any) => $router.push('/fire/inspections/' + row.id)" style="cursor:pointer">
        <el-table-column prop="property" label="房源" width="140"><template #default="{row}">{{ row.property?.name || '-' }}</template></el-table-column>
        <el-table-column prop="inspectionDate" label="检查日期" width="110" />
        <el-table-column prop="type" label="类型" width="100" />
        <el-table-column prop="result" label="结果" width="100"><template #default="{row}"><el-tag :type="row.result==='合格'?'success':row.result==='限期整改'?'warning':'danger'" size="small">{{ row.result }}</el-tag></template></el-table-column>
        <el-table-column prop="overallScore" label="评分" width="70" />
        <el-table-column prop="nextInspectionDate" label="下次检查" width="110" />
        <el-table-column label="操作" width="120"><template #default="{row}"><el-button link size="small" @click.stop="showDialog(row)">编辑</el-button><el-popconfirm title="确认删除?" @confirm="handleDelete(row.id)"><template #reference><el-button link size="small" type="danger">删除</el-button></template></el-popconfirm></template></el-table-column>
              <template #empty>
          <EmptyState title="暂无检查记录" description="开展消防检查后记录会在此汇总" />
        </template>
      </el-table>
      <el-pagination v-if="total>0" style="margin-top:12px" v-model:current-page="page" :page-size="pageSize" :total="total" @current-change="fetchData" layout="total, prev, pager, next" />
    </el-card>

    <el-dialog :title="editing ? '编辑检查记录' : '新增检查记录'" v-model="dialogVisible" width="600px">
      <el-form :model="form" label-width="100px" size="small">
        <el-form-item label="房源"><el-select v-model="form.propertyId" style="width:100%"><el-option v-for="p in properties" :key="p.id" :label="p.name" :value="p.id" /></el-select></el-form-item>
        <el-row :gutter="12">
          <el-col :span="12"><el-form-item label="检查日期"><el-date-picker v-model="form.inspectionDate" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="检查类型"><el-select v-model="form.type" style="width:100%"><el-option v-for="t in ['日常巡查','专项检查','季度检查','年度检查','突击检查']" :key="t" :label="t" :value="t" /></el-select></el-form-item></el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="12"><el-form-item label="检查结果"><el-select v-model="form.result" style="width:100%"><el-option label="合格" value="合格" /><el-option label="不合格" value="不合格" /><el-option label="限期整改" value="限期整改" /></el-select></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="综合评分"><el-input-number v-model="form.overallScore" :min="0" :max="100" /></el-form-item></el-col>
        </el-row>
        <el-divider content-position="left">检查项目</el-divider>
        <el-row :gutter="12">
          <el-col :span="8"><el-checkbox v-model="form.fireExtinguisherOk">灭火器合格</el-checkbox></el-col>
          <el-col :span="8"><el-checkbox v-model="form.smokeAlarmOk">烟感报警器合格</el-checkbox></el-col>
          <el-col :span="8"><el-checkbox v-model="form.emergencyLightOk">应急照明合格</el-checkbox></el-col>
          <el-col :span="8"><el-checkbox v-model="form.escapeRouteOk">疏散通道畅通</el-checkbox></el-col>
          <el-col :span="8"><el-checkbox v-model="form.electricalOk">电气线路安全</el-checkbox></el-col>
          <el-col :span="8"><el-checkbox v-model="form.flammableOk">易燃易爆管理合格</el-checkbox></el-col>
        </el-row>
        <el-form-item label="备注"><el-input v-model="form.notes" type="textarea" :rows="2" /></el-form-item>
        <el-form-item label="下次检查"><el-date-picker v-model="form.nextInspectionDate" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="dialogVisible=false">取消</el-button><el-button type="primary" @click="handleSave">{{ editing ? '保存' : '创建' }}</el-button></template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import request from '@/api/request'

const list = ref<any[]>([]); const total = ref(0); const page = ref(1); const pageSize = ref(20)
const properties = ref<any[]>([]); const filters = reactive<any>({ propertyId: null, result: '', dateRange: null })
const dialogVisible = ref(false); const editing = ref(false)
const form = reactive<any>({ propertyId: null, inspectionDate: '', type: '日常巡查', result: '合格', overallScore: 100, fireExtinguisherOk: true, smokeAlarmOk: true, emergencyLightOk: true, escapeRouteOk: true, electricalOk: true, flammableOk: true, notes: '', nextInspectionDate: '' })

async function fetchData() {
  const params: any = { page: page.value, pageSize: pageSize.value, propertyId: filters.propertyId, result: filters.result }
  if (filters.dateRange) { params.startDate = filters.dateRange[0]; params.endDate = filters.dateRange[1] }
  try { const res = await request.get('/fire-safety/inspections', { params }); list.value = res.data.list; total.value = res.data.total } catch {}
}
function showDialog(row: any) {
  editing.value = !!row
  if (row) { Object.assign(form, row) } else { Object.keys(form).forEach(k => (form as any)[k] = k === 'overallScore' ? 100 : k === 'type' ? '日常巡查' : k === 'result' ? '合格' : true) }
  dialogVisible.value = true
}
async function handleSave() {
  try {
    if (editing.value) { await request.put('/fire-safety/inspections/' + (form as any).id, form); ElMessage.success('已更新') }
    else { await request.post('/fire-safety/inspections', form); ElMessage.success('已创建') }
    dialogVisible.value = false; fetchData()
  } catch {}
}
async function handleDelete(id: number) { try { await request.delete('/fire-safety/inspections/' + id); ElMessage.success('已删除'); fetchData() } catch {} }
onMounted(async () => {
  try { const r = await request.get('/properties', { params: { pageSize: 200 } }); properties.value = r.data.list || [] } catch {}
  fetchData()
})
</script>

<style lang="scss" scoped>
.page-title { font-size: 18px; font-weight: 700; color: #1f2430; margin-bottom: 16px; }
</style>
