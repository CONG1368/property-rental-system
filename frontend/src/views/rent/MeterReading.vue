<template>
  <div>
    <h2 class="page-title">抄表计费</h2>
    <el-tabs v-model="activeTab" @tab-change="onTabChange">
      <!-- 仪表页签 -->
      <el-tab-pane label="仪表" name="meter">
        <el-card>
          <el-row :gutter="12" style="margin-bottom:12px">
            <el-col :span="4">
              <el-select v-model="meterFilters.type" placeholder="类型" clearable @change="fetchMeters" style="width:100%">
                <el-option label="水" value="水" /><el-option label="电" value="电" /><el-option label="燃气" value="燃气" />
              </el-select>
            </el-col>
            <el-col :span="6">
              <el-input v-model="meterFilters.keyword" placeholder="表号关键字" clearable @keyup.enter="fetchMeters" style="width:100%" />
            </el-col>
            <el-col :span="4"><el-button type="primary" @click="fetchMeters">查询</el-button></el-col>
            <el-col :span="10" style="text-align:right"><el-button type="success" @click="showMeterDialog">新增仪表</el-button></el-col>
          </el-row>
          <el-table :data="meterList" size="small" stripe>
            <el-table-column prop="meterNo" label="表号" min-width="130" />
            <el-table-column prop="type" label="类型" width="80"><template #default="{ row }"><el-tag :type="typeTag(row.type)" size="small">{{ row.type }}</el-tag></template></el-table-column>
            <el-table-column prop="unit" label="单位" width="70" />
            <el-table-column label="关联房源" width="150"><template #default="{ row }">{{ row.property?.name || '-' }}</template></el-table-column>
            <el-table-column prop="lastReading" label="上次读数" width="100" />
            <el-table-column prop="pricePerUnit" label="单价" width="90" />
            <el-table-column label="操作" width="140">
              <template #default="{ row }">
                <el-button link size="small" type="primary" @click="showReadDialog(row)">抄表</el-button>
                <el-button link size="small" @click="showMeterDetail(row)">详情</el-button>
              </template>
            </el-table-column>
          </el-table>
          <el-pagination v-if="meterTotal > 0" style="margin-top:12px" v-model:current-page="meterPage" :page-size="meterPageSize" :total="meterTotal" @current-change="fetchMeters" layout="total, prev, pager, next" />
        </el-card>
      </el-tab-pane>

      <!-- 抄表记录页签 -->
      <el-tab-pane label="抄表记录" name="reading">
        <el-card>
          <el-row :gutter="12" style="margin-bottom:12px">
            <el-col :span="3">
              <el-select v-model="readingFilters.type" placeholder="类型" clearable @change="fetchReadings" style="width:100%">
                <el-option label="水" value="水" /><el-option label="电" value="电" /><el-option label="燃气" value="燃气" />
              </el-select>
            </el-col>
            <el-col :span="3">
              <el-select v-model="readingFilters.billed" placeholder="账单" clearable @change="fetchReadings" style="width:100%">
                <el-option label="未生成" value="未生成" /><el-option label="已生成" value="已生成" />
              </el-select>
            </el-col>
            <el-col :span="4">
              <el-input v-model="readingFilters.period" placeholder="期间 YYYY-MM" clearable @keyup.enter="fetchReadings" style="width:100%" />
            </el-col>
            <el-col :span="3"><el-button type="primary" @click="fetchReadings">查询</el-button></el-col>
            <el-col :span="11" style="text-align:right">
              <el-input v-model="genPeriod" placeholder="账期 YYYY-MM" style="width:140px;margin-right:8px" />
              <el-button type="warning" @click="handleGenerateBills">生成账单</el-button>
            </el-col>
          </el-row>
          <el-table :data="readingList" size="small" stripe>
            <el-table-column prop="period" label="期间" width="90" />
            <el-table-column label="表号" min-width="130"><template #default="{ row }">{{ row.meter?.meterNo || '-' }}</template></el-table-column>
            <el-table-column prop="previousReading" label="上次" width="90" />
            <el-table-column prop="currentReading" label="本次" width="90" />
            <el-table-column prop="usage" label="用量" width="90" />
            <el-table-column prop="pricePerUnit" label="单价" width="90" />
            <el-table-column prop="amount" label="金额" width="100" />
            <el-table-column prop="reader" label="抄表人" width="90" />
            <el-table-column label="账单" width="90"><template #default="{ row }"><el-tag :type="row.billed === '已生成' ? 'success' : 'info'" size="small">{{ row.billed === '已生成' ? '已生成' : '未生成' }}</el-tag></template></el-table-column>
          </el-table>
          <el-pagination v-if="readingTotal > 0" style="margin-top:12px" v-model:current-page="readingPage" :page-size="readingPageSize" :total="readingTotal" @current-change="fetchReadings" layout="total, prev, pager, next" />
        </el-card>
      </el-tab-pane>
    </el-tabs>

    <!-- 新增仪表弹窗 -->
    <el-dialog title="新增仪表" v-model="meterDialogVisible" width="560px">
      <el-form :model="meterForm" label-width="90px" size="small">
        <el-row :gutter="12">
          <el-col :span="12"><el-form-item label="关联房源"><el-select v-model="meterForm.propertyId" style="width:100%"><el-option v-for="p in properties" :key="p.id" :label="p.name" :value="p.id" /></el-select></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="关联租客"><el-select v-model="meterForm.tenantId" style="width:100%"><el-option v-for="t in tenants" :key="t.id" :label="t.name" :value="t.id" /></el-select></el-form-item></el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="12"><el-form-item label="类型"><el-select v-model="meterForm.type" style="width:100%"><el-option label="水" value="水" /><el-option label="电" value="电" /><el-option label="燃气" value="燃气" /></el-select></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="单位"><el-input v-model="meterForm.unit" /></el-form-item></el-col>
        </el-row>
        <el-form-item label="表号"><el-input v-model="meterForm.meterNo" placeholder="如 D-2023-001" /></el-form-item>
        <el-row :gutter="12">
          <el-col :span="12"><el-form-item label="初始读数"><el-input-number v-model="meterForm.lastReading" :min="0" :precision="2" style="width:100%" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="单价"><el-input-number v-model="meterForm.pricePerUnit" :min="0" :precision="4" style="width:100%" /></el-form-item></el-col>
        </el-row>
        <el-form-item label="备注"><el-input v-model="meterForm.notes" type="textarea" :rows="2" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="meterDialogVisible = false">取消</el-button><el-button type="primary" @click="handleMeterSave">创建</el-button></template>
    </el-dialog>

    <!-- 抄表弹窗 -->
    <el-dialog title="抄表" v-model="readDialogVisible" width="460px">
      <el-form :model="readForm" label-width="90px" size="small">
        <el-form-item label="表号"><span>{{ readForm.meter?.meterNo || '-' }}（{{ readForm.meter?.type || '-' }}）</span></el-form-item>
        <el-form-item label="上次读数"><span>{{ readForm.meter?.lastReading ?? '-' }}</span></el-form-item>
        <el-form-item label="本次读数"><el-input-number v-model="readForm.currentReading" :min="0" :precision="2" style="width:100%" /></el-form-item>
        <el-form-item label="抄表人"><el-input v-model="readForm.reader" placeholder="抄表人姓名" /></el-form-item>
        <el-form-item label="抄表日期"><el-date-picker v-model="readForm.readDate" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item>
        <el-form-item label="单价"><el-input-number v-model="readForm.pricePerUnit" :min="0" :precision="4" style="width:100%" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="readDialogVisible = false">取消</el-button><el-button type="primary" @click="handleReadSave">保存抄表</el-button></template>
    </el-dialog>

    <!-- 仪表详情弹窗（编辑 + 删除 + 抄表历史） -->
    <el-dialog title="仪表详情" v-model="detailDialogVisible" width="720px">
      <el-form :model="detailMeter" label-width="90px" size="small">
        <el-row :gutter="12">
          <el-col :span="12"><el-form-item label="关联房源"><el-select v-model="detailMeter.propertyId" style="width:100%"><el-option v-for="p in properties" :key="p.id" :label="p.name" :value="p.id" /></el-select></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="关联租客"><el-select v-model="detailMeter.tenantId" style="width:100%"><el-option v-for="t in tenants" :key="t.id" :label="t.name" :value="t.id" /></el-select></el-form-item></el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="12"><el-form-item label="类型"><el-select v-model="detailMeter.type" style="width:100%"><el-option label="水" value="水" /><el-option label="电" value="电" /><el-option label="燃气" value="燃气" /></el-select></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="单位"><el-input v-model="detailMeter.unit" /></el-form-item></el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="12"><el-form-item label="表号"><el-input v-model="detailMeter.meterNo" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="单价"><el-input-number v-model="detailMeter.pricePerUnit" :min="0" :precision="4" style="width:100%" /></el-form-item></el-col>
        </el-row>
        <el-form-item label="备注"><el-input v-model="detailMeter.notes" type="textarea" :rows="2" /></el-form-item>
      </el-form>
      <el-divider content-position="left">抄表历史</el-divider>
      <el-table :data="detailReadings" size="small" stripe max-height="260">
        <el-table-column prop="period" label="期间" width="90" />
        <el-table-column prop="previousReading" label="上次" width="90" />
        <el-table-column prop="currentReading" label="本次" width="90" />
        <el-table-column prop="usage" label="用量" width="90" />
        <el-table-column prop="amount" label="金额" width="100" />
        <el-table-column prop="reader" label="抄表人" width="90" />
        <el-table-column label="账单" width="90"><template #default="{ row }"><el-tag :type="row.billed === '已生成' ? 'success' : 'info'" size="small">{{ row.billed === '已生成' ? '已生成' : '未生成' }}</el-tag></template></el-table-column>
      </el-table>
      <template #footer>
        <el-button type="danger" link style="float:left" @click="handleDetailDelete">删除仪表</el-button>
        <el-button @click="detailDialogVisible = false">关闭</el-button>
        <el-button type="primary" @click="handleDetailSave">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import request from '@/api/request'

const activeTab = ref('meter')

// ===== 仪表 =====
const meterList = ref<any[]>([]); const meterTotal = ref(0); const meterPage = ref(1); const meterPageSize = ref(20)
const meterFilters = reactive<any>({ type: '', keyword: '' })
const properties = ref<any[]>([]); const tenants = ref<any[]>([])

// ===== 抄表记录 =====
const readingList = ref<any[]>([]); const readingTotal = ref(0); const readingPage = ref(1); const readingPageSize = ref(20)
const readingFilters = reactive<any>({ type: '', billed: '', period: '' })
const genPeriod = ref(currentPeriod())

// 仪表弹窗
const meterDialogVisible = ref(false)
const meterForm = reactive<any>({ id: null, propertyId: null, tenantId: null, type: '电', unit: '度', meterNo: '', lastReading: 0, pricePerUnit: 0, notes: '' })

// 抄表弹窗
const readDialogVisible = ref(false)
const readForm = reactive<any>({ meter: null, currentReading: 0, reader: '', readDate: '', pricePerUnit: 0 })

// 详情弹窗
const detailDialogVisible = ref(false)
const detailMeter = reactive<any>({ id: null, propertyId: null, tenantId: null, type: '电', unit: '度', meterNo: '', lastReading: 0, lastReadingDate: '', pricePerUnit: 0, notes: '' })
const detailReadings = ref<any[]>([])

function currentPeriod(): string {
  const now = new Date()
  return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0')
}
function today(): string { return new Date().toISOString().slice(0, 10) }
function typeTag(type: string): string { return type === '水' ? 'primary' : type === '电' ? 'success' : 'warning' }

async function fetchMeters() {
  const params: any = { page: meterPage.value, pageSize: meterPageSize.value, type: meterFilters.type, keyword: meterFilters.keyword }
  try { const res = await request.get('/meters', { params }); meterList.value = res.data.list; meterTotal.value = res.data.total } catch {}
}
async function fetchReadings() {
  const params: any = { page: readingPage.value, pageSize: readingPageSize.value, type: readingFilters.type, billed: readingFilters.billed, period: readingFilters.period }
  try { const res = await request.get('/meters/readings', { params }); readingList.value = res.data.list; readingTotal.value = res.data.total } catch {}
}
function onTabChange(name: any) {
  if (name === 'meter') fetchMeters()
  else fetchReadings()
}

// ===== 仪表创建 =====
function showMeterDialog() {
  Object.assign(meterForm, { id: null, propertyId: null, tenantId: null, type: '电', unit: '度', meterNo: '', lastReading: 0, pricePerUnit: 0, notes: '' })
  meterDialogVisible.value = true
}
async function handleMeterSave() {
  try {
    await request.post('/meters', meterForm)
    ElMessage.success('仪表已创建')
    meterDialogVisible.value = false
    fetchMeters()
  } catch {}
}

// ===== 抄表 =====
function showReadDialog(row: any) {
  Object.assign(readForm, { meter: row, currentReading: Number(row.lastReading || 0), reader: '', readDate: today(), pricePerUnit: Number(row.pricePerUnit || 0) })
  readDialogVisible.value = true
}
async function handleReadSave() {
  try {
    await request.post('/meters/' + readForm.meter.id + '/read', { currentReading: readForm.currentReading, reader: readForm.reader, readDate: readForm.readDate, pricePerUnit: readForm.pricePerUnit })
    ElMessage.success('抄表成功')
    readDialogVisible.value = false
    fetchMeters()
  } catch {}
}

// ===== 仪表详情 =====
async function showMeterDetail(row: any) {
  Object.assign(detailMeter, row)
  detailReadings.value = []
  detailDialogVisible.value = true
  try {
    const res = await request.get('/meters/' + row.id + '/readings', { params: { page: 1, pageSize: 100 } })
    detailReadings.value = res.data.list || []
  } catch {}
}
async function handleDetailSave() {
  try {
    await request.put('/meters/' + detailMeter.id, detailMeter)
    ElMessage.success('仪表已更新')
    detailDialogVisible.value = false
    fetchMeters()
  } catch {}
}
async function handleDetailDelete() {
  try {
    await request.delete('/meters/' + detailMeter.id)
    ElMessage.success('仪表已删除')
    detailDialogVisible.value = false
    fetchMeters()
  } catch {}
}

// ===== 生成账单 =====
async function handleGenerateBills() {
  if (!genPeriod.value) { ElMessage.error('请输入账期 YYYY-MM'); return }
  try {
    const res = await request.post('/meters/readings/generate-bills', { period: genPeriod.value })
    ElMessage.success('成功生成 ' + res.data.generated + ' 条账单，跳过 ' + res.data.skipped + ' 条')
    fetchReadings()
  } catch {}
}

onMounted(async () => {
  try {
    const [pr, tr] = await Promise.all([
      request.get('/properties', { params: { pageSize: 200 } }),
      request.get('/tenants', { params: { pageSize: 200 } }),
    ])
    properties.value = pr.data.list || []
    tenants.value = tr.data.list || []
  } catch {}
  fetchMeters()
})
</script>

<style lang="scss" scoped>
.page-title { font-size: 18px; font-weight: 700; color: #1f2430; margin-bottom: 16px; }
</style>
