<template>
  <div class="clause-import">
    <h2 class="page-title">条款批量导入</h2>

    <el-card style="margin-bottom:16px">
      <template #header><span>上传文件</span></template>
      <el-upload
        ref="uploadRef"
        :auto-upload="false"
        :on-change="handleFileChange"
        :limit="1"
        accept=".xlsx,.xls,.docx,.pdf"
        drag
      >
        <el-icon :size="40"><UploadFilled /></el-icon>
        <div style="margin-top:8px;font-size:14px;color:#606266">拖拽文件到此处或 <em>点击上传</em></div>
        <template #tip>
          <div style="margin-top:8px;font-size:12px;color:#909399">Excel / Word / PDF，单文件 10MB</div>
        </template>
      </el-upload>
    </el-card>

    <!-- Excel 预览 -->
    <el-card v-if="fileType === 'excel'" style="margin-bottom:16px">
      <template #header><span>数据预览（前10行）</span></template>
      <el-table :data="excelPreview" border stripe size="small" max-height="400">
        <el-table-column prop="name" label="租客姓名" min-width="100" />
        <el-table-column prop="phone" label="租客手机" width="130" />
        <el-table-column prop="title" label="条款标题" min-width="140" />
        <el-table-column prop="content" label="条款内容" min-width="200" show-overflow-tooltip />
        <el-table-column prop="sortOrder" label="排序" width="70" />
      </el-table>
      <div style="margin-top:12px;color:#909399;font-size:12px">共 {{ excelRows.length }} 行</div>
      <el-button type="primary" size="large" style="margin-top:12px;width:100%" @click="importExcel" :loading="importing">
        确认导入（自动匹配租客）
      </el-button>
    </el-card>

    <!-- Word/PDF 文本编辑 -->
    <el-card v-if="fileType === 'doc'" style="margin-bottom:16px">
      <template #header><span>提取文本编辑</span></template>
      <el-input v-model="extractedText" type="textarea" :rows="12" placeholder="提取的文本内容..." />
      <div style="margin-top:16px">
        <el-form-item label="选择租客" style="margin-bottom:12px">
          <el-select v-model="selectedTenantIds" multiple filterable placeholder="搜索选择目标租客" style="width:100%">
            <el-option v-for="t in tenants" :key="t.id" :label="t.name + (t.phone ? ' - ' + t.phone : '')" :value="t.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="条款标题">
          <el-input v-model="clauseTitle" placeholder="输入条款标题" />
        </el-form-item>
      </div>
      <el-button type="primary" size="large" style="margin-top:12px;width:100%" @click="importManual" :loading="importing"
        :disabled="!selectedTenantIds.length || !clauseTitle || !extractedText">
        确认导入（已选 {{ selectedTenantIds.length }} 个租客）
      </el-button>
    </el-card>

    <!-- 导入结果 -->
    <el-card v-if="importResult" style="margin-bottom:16px">
      <template #header><span>导入结果</span></template>
      <el-alert :title="importResult.message" :type="importResult.code === 200 ? 'success' : 'error'" show-icon :closable="false" style="margin-bottom:16px" />
      <el-descriptions v-if="importResult.data" :column="3" border size="small">
        <el-descriptions-item label="更新合同数">{{ importResult.data.updatedContracts || 0 }}</el-descriptions-item>
        <el-descriptions-item label="未匹配租客">{{ (importResult.data.unmatched || []).join(', ') || '无' }}</el-descriptions-item>
        <el-descriptions-item label="跳过无合同">{{ importResult.data.skippedNoContract || 0 }}</el-descriptions-item>
      </el-descriptions>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { UploadFilled } from '@element-plus/icons-vue'
import * as XLSX from 'xlsx'
import request from '@/api/request'

const uploadRef = ref<any>(null)
const fileType = ref<'excel' | 'doc' | null>(null)

const excelRows = ref<any[]>([])
const excelPreview = ref<any[]>([])

const extractedText = ref('')
const tenants = ref<any[]>([])
const selectedTenantIds = ref<number[]>([])
const clauseTitle = ref('')

const importing = ref(false)
const importResult = ref<any>(null)

function handleFileChange(file: any) {
  importResult.value = null
  const raw = file.raw as File
  if (!raw) return
  const ext = raw.name.split('.').pop()?.toLowerCase()

  if (ext === 'xlsx' || ext === 'xls') {
    fileType.value = 'excel'
    parseExcel(raw)
  } else if (ext === 'docx' || ext === 'pdf') {
    fileType.value = 'doc'
    extractDocText(raw)
  } else {
    ElMessage.error('不支持的文件格式')
  }
}

function parseExcel(file: File) {
  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const wb = XLSX.read(e.target?.result, { type: 'binary' })
      const sheet = wb.Sheets[wb.SheetNames[0]]
      const rows: any[] = XLSX.utils.sheet_to_json(sheet)
      excelRows.value = rows.map((r: any) => ({
        name: r['租客姓名'] || r['name'] || '',
        phone: r['租客手机'] || r['phone'] || '',
        title: r['条款标题'] || r['title'] || '',
        content: r['条款内容'] || r['content'] || '',
        sortOrder: r['排序'] || r['sortOrder'] || 999,
      }))
      excelPreview.value = excelRows.value.slice(0, 10)
    } catch {
      ElMessage.error('Excel 解析失败')
    }
  }
  reader.readAsBinaryString(file)
}

async function extractDocText(file: File) {
  const fd = new FormData()
  fd.append('file', file)
  try {
    const res = await request.post('/contracts/extract-clause-text', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    } as any)
    extractedText.value = res.data.text || ''
    ElMessage.success('文本提取成功')
  } catch {
    ElMessage.error('文本提取失败')
  }
}

async function importExcel() {
  if (excelRows.value.length === 0) { ElMessage.warning('无数据可导入'); return }
  importing.value = true
  try {
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(excelRows.value.map((r: any) => ({
      '租客姓名': r.name,
      '租客手机': r.phone,
      '条款标题': r.title,
      '条款内容': r.content,
      '排序': r.sortOrder,
    })))
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const fd = new FormData()
    fd.append('file', blob, 'import.xlsx')
    const res = await request.post('/contracts/import-clauses', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    } as any)
    importResult.value = res as any
    ElMessage.success((res as any).message || '导入完成')
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || '导入失败')
  } finally { importing.value = false }
}

async function importManual() {
  if (!selectedTenantIds.value.length || !clauseTitle.value || !extractedText.value) return
  importing.value = true
  try {
    const res = await request.post('/contracts/import-clauses', {
      tenantIds: selectedTenantIds.value,
      clauses: [{ title: clauseTitle.value, content: extractedText.value, sortOrder: 999 }],
    })
    importResult.value = res as any
    ElMessage.success((res as any).message || '导入完成')
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || '导入失败')
  } finally { importing.value = false }
}

onMounted(async () => {
  try {
    const res = await request.get('/tenants', { params: { pageSize: 1000 } })
    tenants.value = res.data?.list || []
  } catch { /* ignore */ }
})
</script>

<style lang="scss" scoped>
.page-title { font-size: 18px; font-weight: 700; color: #0A3D62; margin-bottom: 16px; }
</style>
