<template>
  <div>
    <h2 class="page-title">特种设备年检</h2>

    <!-- 统计卡片 -->
    <div class="stats-row">
      <div class="stat-card"><div class="stat-value">{{ stats.total }}</div><div class="stat-label">设备总数</div></div>
      <div class="stat-card qualified"><div class="stat-value">{{ stats.qualified }}</div><div class="stat-label">合格</div></div>
      <div class="stat-card pending"><div class="stat-value">{{ stats.pending }}</div><div class="stat-label">待检</div></div>
      <div class="stat-card expired"><div class="stat-value">{{ stats.expired }}</div><div class="stat-label">过期</div></div>
      <div class="stat-card expiring"><div class="stat-value">{{ stats.expiring }}</div><div class="stat-label">即将到期(30天)</div></div>
    </div>

    <!-- 工具栏 -->
    <FilterBar>
      <el-select v-model="filters.category" placeholder="类别" clearable style="width:140px" @change="fetchData">
      <el-option v-for="c in categories" :key="c" :label="c" :value="c" />
      </el-select>
      <el-select v-model="filters.status" placeholder="状态" clearable style="width:130px" @change="fetchData">
      <el-option v-for="s in statuses" :key="s" :label="s" :value="s" />
      </el-select>
      <el-input v-model="filters.keyword" placeholder="搜索设备名称/证书号/检验机构" clearable style="width:240px" @keyup.enter="fetchData" @clear="fetchData" />
      <el-button type="primary" @click="fetchData">查询</el-button>
      <template #actions>
        <el-button type="primary" @click="showDialog(null)">新增设备</el-button>
      </template>
    </FilterBar>

    <!-- 表格 -->
    <DataTable :data="list" :columns="COLUMNS" row-key="id" v-model:page="page" :total="total" :page-size="pageSize" @page-change="fetchData" empty-title="暂无数据" empty-description="调整筛选条件或新增记录后，数据会显示在这里" style="margin-top:12px">
      <template #c2="{ row }"><el-tag :type="categoryTagType(row.category)" size="small">{{ row.category }}</el-tag></template>
      <template #c6="{ row }"><el-tag :type="statusTagType(row.status)" size="small">{{ row.status }}</el-tag></template>
      <template #c8="{ row }"><el-button link size="small" @click="showDialog(row)">编辑</el-button>
              <el-popconfirm title="确认删除?" @confirm="handleDelete(row.id)"><template #reference><el-button link size="small" type="danger">删除</el-button></template></el-popconfirm></template>
    </DataTable>

    <!-- 弹窗 -->
    <el-dialog :title="editing ? '编辑年检记录' : '新增年检记录'" v-model="dialogVisible" width="560px">
      <el-form :model="form" label-width="90px" size="small">
        <el-form-item label="设备名称"><el-input v-model="form.equipmentName" /></el-form-item>
        <el-row :gutter="12">
          <el-col :span="12"><el-form-item label="类别"><el-select v-model="form.category" style="width:100%"><el-option v-for="c in categories" :key="c" :label="c" :value="c" /></el-select></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="证书号"><el-input v-model="form.certNo" /></el-form-item></el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="12"><el-form-item label="上次检验"><el-date-picker v-model="form.inspectionDate" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="下次检验"><el-date-picker v-model="form.nextInspectionDate" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item></el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="12"><el-form-item label="状态"><el-select v-model="form.status" style="width:100%"><el-option v-for="s in statuses" :key="s" :label="s" :value="s" /></el-select></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="检验机构"><el-input v-model="form.agency" /></el-form-item></el-col>
        </el-row>
        <el-form-item label="备注"><el-input v-model="form.notes" type="textarea" :rows="2" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="dialogVisible=false">取消</el-button><el-button type="primary" @click="handleSave">{{ editing ? '保存' : '创建' }}</el-button></template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import FilterBar from '@/components/base/FilterBar.vue';
import DataTable from '@/components/base/DataTable.vue';
import type { TableColumn } from '@/components/base/types';

const COLUMNS: TableColumn[] = [
  { prop: 'equipmentName', label: '设备名称', minWidth: 160, tooltip: true },
  { prop: 'category', label: '类别', width: 100, slot: 'c2' },
  { prop: 'certNo', label: '证书号', width: 140 },
  { prop: 'inspectionDate', label: '上次检验', width: 110 },
  { prop: 'nextInspectionDate', label: '下次检验', width: 110 },
  { prop: 'status', label: '状态', width: 90, slot: 'c6' },
  { prop: 'agency', label: '检验机构', minWidth: 140, tooltip: true },
  { label: '操作', width: 130, fixed: 'right', slot: 'c8' },
];

import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import request from '@/api/request'

const list = ref<any[]>([]); const total = ref(0); const page = ref(1); const pageSize = ref(20)
const categories = ['电梯', '锅炉', '压力容器', '起重机械', '其他']
const statuses = ['合格', '不合格', '待检', '过期']
const stats = reactive<any>({ total: 0, qualified: 0, pending: 0, expired: 0, expiring: 0 })
const filters = reactive<any>({ category: '', status: '', keyword: '' })
const dialogVisible = ref(false); const editing = ref(false); const editingId = ref<number | null>(null)
const form = reactive<any>({ equipmentName: '', category: '电梯', certNo: '', inspectionDate: '', nextInspectionDate: '', status: '待检', agency: '', notes: '' })

function categoryTagType(c: string) {
  const m: Record<string, string> = { '电梯': '', '锅炉': 'warning', '压力容器': 'danger', '起重机械': 'success', '其他': 'info' }
  return m[c] || 'info'
}
function statusTagType(s: string) {
  const m: Record<string, string> = { '合格': 'success', '不合格': 'danger', '待检': 'warning', '过期': 'info' }
  return m[s] || 'info'
}

function rowClass({ row }: any) {
  if (row.status === '过期') return 'row-expired'
  const nd = row.nextInspectionDate
  if (nd) {
    const diff = Math.ceil((new Date(nd + 'T00:00:00').getTime() - Date.now()) / 86400000)
    if (diff >= 0 && diff <= 30) return 'row-expiring'
  }
  return ''
}

async function fetchStats() {
  try {
    const res = await request.get('/equipment-certifications/stats')
    stats.total = res.data?.total ?? 0
    stats.qualified = res.data?.qualified ?? 0
    stats.pending = res.data?.pending ?? 0
    stats.expired = res.data?.expired ?? 0
    stats.expiring = res.data?.expiring ?? 0
  } catch (err: any) { ElMessage.error(err?.response?.data?.message || '统计加载失败') }
}

async function fetchData() {
  try {
    const res = await request.get('/equipment-certifications', { params: { page: page.value, pageSize: pageSize.value, category: filters.category, status: filters.status, keyword: filters.keyword } })
    list.value = res.data?.list || []
    total.value = res.data?.total || 0
  } catch (err: any) { ElMessage.error(err?.response?.data?.message || '列表加载失败') }
}

function showDialog(row: any) {
  if (row) {
    editing.value = true
    editingId.value = row.id
    Object.assign(form, { equipmentName: row.equipmentName, category: row.category, certNo: row.certNo, inspectionDate: row.inspectionDate, nextInspectionDate: row.nextInspectionDate, status: row.status, agency: row.agency, notes: row.notes })
  } else {
    editing.value = false
    editingId.value = null
    Object.assign(form, { equipmentName: '', category: '电梯', certNo: '', inspectionDate: '', nextInspectionDate: '', status: '待检', agency: '', notes: '' })
  }
  dialogVisible.value = true
}

async function handleSave() {
  try {
    if (editing.value && editingId.value != null) {
      await request.put('/equipment-certifications/' + editingId.value, form)
      ElMessage.success('已更新')
    } else {
      await request.post('/equipment-certifications', form)
      ElMessage.success('已创建')
    }
    dialogVisible.value = false
    fetchData()
    fetchStats()
  } catch (err: any) { ElMessage.error(err?.response?.data?.message || '保存失败') }
}

async function handleDelete(id: number) {
  try { await request.delete('/equipment-certifications/' + id); ElMessage.success('已删除'); fetchData(); fetchStats() }
  catch (err: any) { ElMessage.error(err?.response?.data?.message || '删除失败') }
}

onMounted(() => { fetchStats(); fetchData() })
</script>

<style lang="scss" scoped>
.page-title { font-size: 18px; font-weight: 700; color: $n-900; margin-bottom: 16px; }
.stats-row {
  display: flex; gap: 16px; margin-bottom: 16px;
  .stat-card {
    flex: 1; background: $n-0; border-radius: 8px; padding: 16px 20px;
    text-align: center; box-shadow: 0 1px 4px $n-100;
    .stat-value { font-size: 28px; font-weight: 700; color: $n-900; }
    .stat-label { font-size: 13px; color: $n-600; margin-top: 4px; }
    &.qualified { border-left: 4px solid $ok-600; }
    &.pending { border-left: 4px solid $warn-600; }
    &.expired { border-left: 4px solid $bad-600; }
    &.expiring { border-left: 4px solid $brand-600; }
  }
}
:deep(.row-expired) { background: $bad-100 !important; }
:deep(.row-expiring) { background: $warn-100 !important; }
</style>
