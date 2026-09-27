<template>
  <div class="visitor-page">
    <el-row :gutter="16" class="stat-cards">
      <el-col :span="6"><div class="stat-card"><div class="stat-num">{{ stats.total }}</div><div class="stat-label">访客总数</div></div></el-col>
      <el-col :span="6"><div class="stat-card"><div class="stat-num warn">{{ stats.inVisit }}</div><div class="stat-label">在访</div></div></el-col>
      <el-col :span="6"><div class="stat-card"><div class="stat-num">{{ stats.today }}</div><div class="stat-label">当日访客</div></div></el-col>
    </el-row>

    <FilterBar>
      <el-input v-model="filterName" placeholder="按姓名搜索" clearable style="width:180px" @keyup.enter="onFilterChange" @clear="onFilterChange" />
      <el-select v-model="filterStatus" placeholder="状态筛选" clearable style="width:140px" @change="onFilterChange">
      <el-option label="在访" value="在访" />
      <el-option label="已离开" value="已离开" />
      </el-select>
      <el-button type="primary" @click="onFilterChange">查询</el-button>
      <template #actions>
        <el-button type="primary" @click="showDialog()">访客登记</el-button>
      </template>
    </FilterBar>

    <DataTable :data="list" :loading="loading" :columns="COLUMNS" row-key="id" v-model:page="page" :total="total" :page-size="pageSize" @page-change="fetchData" empty-title="暂无数据" empty-description="调整筛选条件或新增记录后，数据会显示在这里">
      <template #c7="{ row }">{{ row.leaveTime || '-' }}</template>
      <template #c8="{ row }"><el-tag :type="row.status === '在访' ? 'warning' : 'info'" size="small">{{ row.status }}</el-tag></template>
      <template #c9="{ row }"><el-popconfirm v-if="row.status === '在访'" title="确认该访客已离开?" @confirm="handleLeave(row.id)"><template #reference><el-button link size="small" type="warning">离开</el-button></template></el-popconfirm>
              <el-button link size="small" @click="showDialog(row)">编辑</el-button>
              <el-popconfirm title="确定删除该访客?" @confirm="handleDelete(row.id)"><template #reference><el-button link size="small" type="danger">删除</el-button></template></el-popconfirm></template>
    </DataTable>

    <el-dialog :title="editing ? '编辑访客' : '访客登记'" v-model="dialogVisible" width="600px" @closed="resetForm">
      <el-form :model="form" label-width="90px" size="small">
        <el-row :gutter="12">
          <el-col :span="12"><el-form-item label="姓名"><el-input v-model="form.name" placeholder="访客姓名" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="电话"><el-input v-model="form.phone" placeholder="联系电话" /></el-form-item></el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="12"><el-form-item label="身份证号"><el-input v-model="form.idNumber" placeholder="身份证号" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="被访人/房号"><el-input v-model="form.visitTarget" placeholder="被访人或房号" /></el-form-item></el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="12"><el-form-item label="事由"><el-input v-model="form.purpose" placeholder="来访事由" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="车牌"><el-input v-model="form.plateNumber" placeholder="车牌号（可选）" /></el-form-item></el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="12"><el-form-item label="到访时间"><el-date-picker v-model="form.visitTime" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="状态"><el-select v-model="form.status" style="width:100%"><el-option label="在访" value="在访" /><el-option label="已离开" value="已离开" /></el-select></el-form-item></el-col>
        </el-row>
        <el-form-item label="离开时间"><el-date-picker v-model="form.leaveTime" type="date" value-format="YYYY-MM-DD" style="width:100%" placeholder="离开时间（可选）" /></el-form-item>
        <el-form-item label="备注"><el-input v-model="form.notes" type="textarea" :rows="2" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="dialogVisible = false">取消</el-button><el-button type="primary" @click="handleSave">{{ editing ? '保存' : '创建' }}</el-button></template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import FilterBar from '@/components/base/FilterBar.vue';
import DataTable from '@/components/base/DataTable.vue';
import type { TableColumn } from '@/components/base/types';

const COLUMNS: TableColumn[] = [
  { prop: 'name', label: '姓名', width: 100 },
  { prop: 'phone', label: '电话', width: 120 },
  { prop: 'visitTarget', label: '被访人', width: 120, tooltip: true },
  { prop: 'purpose', label: '事由', width: 120, tooltip: true },
  { prop: 'plateNumber', label: '车牌', width: 110, tooltip: true },
  { prop: 'visitTime', label: '到访时间', width: 110 },
  { prop: 'leaveTime', label: '离开时间', width: 110, slot: 'c7' },
  { prop: 'status', label: '状态', width: 90, slot: 'c8' },
  { label: '操作', width: 210, fixed: 'right', slot: 'c9' },
];

import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import request from '@/api/request'

const list = ref<any[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const loading = ref(false)
const filterName = ref('')
const filterStatus = ref('')
const stats = ref({ total: 0, inVisit: 0, today: 0 })

const dialogVisible = ref(false)
const editing = ref(false)
const form = reactive<any>({ id: null, name: '', idNumber: '', phone: '', visitTarget: '', purpose: '', plateNumber: '', visitTime: '', leaveTime: '', status: '在访', notes: '' })

function onFilterChange() { page.value = 1; fetchData() }

async function fetchData() {
  loading.value = true
  try {
    const params: any = { page: page.value, pageSize: pageSize.value }
    if (filterStatus.value) params.status = filterStatus.value
    if (filterName.value) params.name = filterName.value
    const res = await request.get('/visitors', { params })
    list.value = res.data?.list || []
    total.value = res.data?.total || 0
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.message || '加载失败')
  } finally { loading.value = false }
}

async function fetchStats() {
  try {
    const res = await request.get('/visitors/stats')
    stats.value = {
      total: Number(res.data?.total || 0),
      inVisit: Number(res.data?.inVisit || 0),
      today: Number(res.data?.today || 0),
    }
  } catch { /* 静默 */ }
}

function showDialog(row?: any) {
  editing.value = !!row
  if (row) {
    Object.assign(form, {
      id: row.id, name: row.name || '', idNumber: row.idNumber || '', phone: row.phone || '',
      visitTarget: row.visitTarget || '', purpose: row.purpose || '', plateNumber: row.plateNumber || '',
      visitTime: row.visitTime || '', leaveTime: row.leaveTime || '', status: row.status || '在访', notes: row.notes || '',
    })
  } else {
    resetForm()
  }
  dialogVisible.value = true
}

function resetForm() {
  Object.assign(form, { id: null, name: '', idNumber: '', phone: '', visitTarget: '', purpose: '', plateNumber: '', visitTime: '', leaveTime: '', status: '在访', notes: '' })
}

async function handleSave() {
  if (!form.name) { ElMessage.warning('请输入访客姓名'); return }
  if (!form.visitTime) { ElMessage.warning('请选择到访时间'); return }
  try {
    if (editing.value) { await request.put('/visitors/' + form.id, form); ElMessage.success('已更新') }
    else { await request.post('/visitors', form); ElMessage.success('登记成功') }
    dialogVisible.value = false
    fetchData(); fetchStats()
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.message || '操作失败')
  }
}

async function handleLeave(id: number) {
  try {
    await request.put('/visitors/' + id + '/leave')
    ElMessage.success('已登记离开')
    fetchData(); fetchStats()
  } catch (err: any) { ElMessage.error(err?.response?.data?.message || '操作失败') }
}

async function handleDelete(id: number) {
  try { await request.delete('/visitors/' + id); ElMessage.success('已删除'); fetchData(); fetchStats() }
  catch (err: any) { ElMessage.error(err?.response?.data?.message || '删除失败') }
}

onMounted(() => {
  fetchData()
  fetchStats()
})
</script>

<style lang="scss" scoped>
.visitor-page { padding: 0; }
.stat-cards { margin-bottom: 16px; }
.stat-card { background: $n-0; border: 1px solid $n-200; border-radius: 8px; padding: 18px; text-align: center; }
.stat-num { font-size: 24px; font-weight: 700; color: $n-900; }
.stat-num.warn { color: $warn-600; }
.stat-label { margin-top: 6px; color: $n-600; font-size: 13px; }
</style>
