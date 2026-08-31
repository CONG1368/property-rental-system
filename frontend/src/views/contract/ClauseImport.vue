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
        accept=".xlsx,.xls,.docx,.doc,.pdf"
        drag
        class="upload-drag-area"
      >
        <el-icon :size="48"><UploadFilled /></el-icon>
        <div class="upload-text">将文件拖到此处，或 <em class="click-hint">点击选择文件</em></div>
        <template #tip>
          <div class="upload-tip">支持 Excel / Word (.docx / .doc) / PDF 格式</div>
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
      <div style="margin-top:8px">
        <el-form-item label="同步到模板">
          <el-select v-model="syncTemplateId" clearable placeholder="选择模板（可选）" style="width:100%">
            <el-option v-for="tpl in templates" :key="tpl.id" :label="tpl.name + ' (' + tpl.type + ')'" :value="tpl.id" />
          </el-select>
        </el-form-item>
      </div>
      <el-button type="primary" size="large" style="margin-top:12px;width:100%" @click="importExcel" :loading="importing">
        确认导入（自动匹配租客）
      </el-button>
    </el-card>

    <!-- Word/PDF 智能拆分条款 -->
    <el-card v-if="fileType === 'doc'" style="margin-bottom:16px">
      <template #header>
        <span>提取文本编辑</span>
        <el-button size="small" type="primary" text style="float:right" @click="smartSplit">
          <el-icon><MagicStick /></el-icon> 智能拆分
        </el-button>
        <span style="font-size:12px;color:#909399;float:right;margin-right:12px;line-height:28px">
          拆分阈值: <el-input-number v-model="splitMinLength" :min="10" :max="100" size="small" style="width:70px" /> 字
        </span>
      </template>
      <el-input v-model="extractedText" type="textarea" :rows="8" placeholder="提取的文本内容，或手动粘贴..." style="margin-bottom:12px" />
      <el-alert v-if="parsedClauses.length > 0" type="info" :closable="false" style="margin-bottom:12px">
        已识别 {{ parsedClauses.length }} 条条款，每条可在下方编辑标题和内容后导入
      </el-alert>
      <el-table v-if="parsedClauses.length > 0" :data="parsedClauses" border size="small" max-height="400" style="margin-bottom:12px">
        <el-table-column prop="title" label="条款标题" min-width="140">
          <template #default="{ row, $index }">
            <el-input v-model="row.title" size="small" placeholder="标题" />
          </template>
        </el-table-column>
        <el-table-column prop="content" label="条款内容" min-width="300">
          <template #default="{ row, $index }">
            <el-input v-model="row.content" type="textarea" :rows="2" size="small" placeholder="内容" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="60" fixed="right">
          <template #default="{ $index }">
            <el-button size="small" type="danger" text @click="parsedClauses.splice($index, 1)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div style="margin-top:12px">
        <el-form-item label="选择租客" style="margin-bottom:12px">
          <el-select v-model="selectedTenantIds" multiple filterable placeholder="搜索选择目标租客" style="width:100%">
            <el-option v-for="t in tenants" :key="t.id" :label="t.name + (t.phone ? ' - ' + t.phone : '')" :value="t.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="同步到模板" style="margin-bottom:12px">
          <el-select v-model="syncTemplateId" clearable placeholder="选择模板（可选，自动按业态匹配）" style="width:100%">
            <el-option v-for="tpl in templates" :key="tpl.id" :label="tpl.name + ' (' + tpl.type + ')'" :value="tpl.id" />
          </el-select>
          <span style="font-size:11px;color:#909399">导入的条款将同步到所选模板，新建合同时可一键加载</span>
        </el-form-item>
      </div>
      <div style="display:flex;gap:8px">
        <el-button type="primary" size="large" style="flex:1" @click="importParsedClauses" :loading="importing"
          :disabled="!selectedTenantIds.length || parsedClauses.length === 0">
          确认导入 {{ parsedClauses.length }} 条条款（已选 {{ selectedTenantIds.length }} 个租客）
        </el-button>
        <el-button size="large" @click="importManual" :loading="importing"
          :disabled="!selectedTenantIds.length || !extractedText"
          v-if="extractedText && parsedClauses.length === 0">
          作为单条导入
        </el-button>
      </div>
    </el-card>

    <!-- 导入结果 -->
    <el-card v-if="importResult" style="margin-bottom:16px">
      <template #header><span>导入结果</span></template>
      <el-alert :title="importResult.message" :type="importResult.code === 200 ? 'success' : 'error'" show-icon :closable="false" style="margin-bottom:16px" />
      <el-descriptions v-if="importResult.data" :column="3" border size="small">
        <el-descriptions-item label="更新合同数">{{ importResult.data.updatedContracts || 0 }}</el-descriptions-item>
        <el-descriptions-item label="暂存条款(待起草)">{{ importResult.data.pendingTenants || 0 }}</el-descriptions-item>
        <el-descriptions-item label="未匹配租客">{{ (importResult.data.unmatched || []).join(', ') || '无' }}</el-descriptions-item>
      </el-descriptions>
      <div v-if="importResult.data?.pendingTenants > 0" style="margin-top:8px;font-size:12px;color:#409EFF">
        暂存条款将在新建合同时自动加载到条款列表
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { UploadFilled, MagicStick } from '@element-plus/icons-vue'
import * as XLSX from 'xlsx'
import request, { apiBaseURL } from '@/api/request'

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
const parsedClauses = ref<{ title: string; content: string; sortOrder: number }[]>([])
const splitMinLength = ref(30)
const templates = ref<any[]>([])
const syncTemplateId = ref<number | null>(null)

function handleFileChange(file: any) {
  importResult.value = null
  const raw: File = file.raw || file
  if (!raw || !raw.name) { ElMessage.error('文件读取失败，请重试'); return }
  const ext = raw.name.split('.').pop()?.toLowerCase()

  if (ext === 'xlsx' || ext === 'xls') {
    fileType.value = 'excel'
    parseExcel(raw)
  } else if (ext === 'docx' || ext === 'doc' || ext === 'pdf') {
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
      const wb = XLSX.read(e.target?.result, { type: 'array' })
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
  reader.readAsArrayBuffer(file)
}

async function extractDocText(file: File) {
  const fd = new FormData()
  fd.append('file', file)
  try {
    // 使用原生 fetch 避免 axios 默认 Content-Type 与 FormData multipart 冲突
    const token = localStorage.getItem('accessToken')
    const resp = await fetch(`${apiBaseURL}/contracts/extract-clause-text`, {
      method: 'POST',
      headers: token ? { Authorization: 'Bearer ' + token } : {},
      body: fd,
    })
    const data = await resp.json()
    if (data.code !== 200) throw new Error(data.message || '提取失败')
    extractedText.value = data.data?.text || ''
    ElMessage.success('文本提取成功，已自动尝试智能拆分')
    smartSplit()
  } catch (e: any) {
    ElMessage.error(e?.message || '文本提取失败，请检查文件格式是否正确')
  }
}

// 智能拆分：将长文本按中文合同条款编号拆分为多条
function smartSplit() {
  const text = extractedText.value || '';
  if (!text.trim()) return;
  // 跳过错误提示文本（以括号开头的是提取失败提示）
  if (/^\(此/.test(text.trim())) return;
  parsedClauses.value = [];
  const minLen = splitMinLength.value;

  // 多层级匹配：第X条/第X款 → 中文数字编号 → 阿拉伯数字编号 → 括号编号 → 按段落
  const patternGroups: { name: string; patterns: RegExp[] }[] = [
    {
      name: '「第X条/第X款」',
      patterns: [
        /第[一二三四五六七八九十百千\d]+条\s*[：:、.\s]*/g,
        /第[一二三四五六七八九十百千\d]+款\s*[：:、.\s]*/g,
        /第[一二三四五六七八九十百千\d]+章\s*[：:、.\s]*/g,
        /第[一二三四五六七八九十百千\d]+节\s*[：:、.\s]*/g,
      ],
    },
    {
      name: '「中文数字编号」',
      patterns: [
        /[一二三四五六七八九十百千]+、\s*/g,
        /[一二三四五六七八九十百千]+．\s*/g,
      ],
    },
    {
      name: '「阿拉伯数字编号」',
      patterns: [
        /\d+[\.、．]\s*/g,
        /（\d+）\s*/g,
        /\(\d+\)\s*/g,
      ],
    },
  ];

  // 逐级尝试匹配
  for (const group of patternGroups) {
    let bestPattern: RegExp | null = null;
    let bestCount = 0;
    for (const p of group.patterns) {
      p.lastIndex = 0;
      const matches = text.match(p);
      const count = matches ? matches.length : 0;
      if (count > bestCount && count >= 2) { bestCount = count; bestPattern = p; }
    }
    if (bestPattern) {
      bestPattern.lastIndex = 0;
      const parts = text.split(bestPattern).filter(s => s.trim().length > 0);
      const titles = text.match(bestPattern) || [];
      if (parts.length >= 2) {
        parsedClauses.value = parts.map((content, i) => ({
          title: (titles[i] || `第${i + 1}条`).replace(/[：:、.\s]/g, '').trim() || `第${i + 1}条`,
          content: content.trim(),
          sortOrder: i + 1,
        }));
        ElMessage.success(`已识别 ${parts.length} 条条款 ${group.name}，请检查调整后确认导入`);
        return;
      }
    }
  }

  // 最终回退：按空行拆分
  const parts = text.split(/\n\s*\n/).filter((s: string) => s.trim().length >= minLen);
  if (parts.length >= 2) {
    parsedClauses.value = parts.map((content, i) => ({
      title: `第${i + 1}条`,
      content: content.trim(),
      sortOrder: i + 1,
    }));
    ElMessage.success(`已按段落拆分为 ${parts.length} 条，请检查调整后确认导入`);
    return;
  }

  // 按单换行拆分（段落过密的情况）
  const lineParts = text.split(/\n/).filter((s: string) => s.trim().length >= minLen);
  if (lineParts.length >= 3) {
    parsedClauses.value = lineParts.map((content, i) => ({
      title: `第${i + 1}条`,
      content: content.trim(),
      sortOrder: i + 1,
    }));
    ElMessage.success(`已按行拆分为 ${lineParts.length} 条，请检查调整后确认导入`);
    return;
  }

  ElMessage.info('未识别到条款结构，请手动编辑文本或作为单条导入');
}

async function importParsedClauses() {
  if (!selectedTenantIds.value.length || parsedClauses.value.length === 0) return;
  importing.value = true;
  try {
    const res = await request.post('/contracts/import-clauses', {
      tenantIds: selectedTenantIds.value,
      clauses: parsedClauses.value.map((c, i) => ({
        title: c.title || `第${i + 1}条`,
        content: c.content,
        sortOrder: i + 1,
      })),
      templateId: syncTemplateId.value || undefined,
    });
    importResult.value = res as any;
    ElMessage.success((res as any).message || '导入完成');
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || '导入失败');
  } finally { importing.value = false; }
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
    const res = await request.post('/contracts/import-clauses', fd)
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
      templateId: syncTemplateId.value || undefined,
    })
    importResult.value = res as any
    ElMessage.success((res as any).message || '导入完成')
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || '导入失败')
  } finally { importing.value = false }
}

onMounted(async () => {
  try {
    const [tenantRes, tplRes] = await Promise.all([
      request.get('/tenants', { params: { pageSize: 1000 } }),
      request.get('/contract-templates'),
    ])
    tenants.value = tenantRes.data?.list || []
    templates.value = tplRes.data?.list || []
    // 默认选中「常用条款模板-通用」（按第一个租客的房源类型自动匹配）
    if (templates.value.length > 0) {
      const defaultTpl = templates.value.find((t: any) => t.name === '常用条款模板-通用')
        || templates.value.find((t: any) => t.name.startsWith('常用条款模板'))
        || templates.value[0]
      if (defaultTpl) syncTemplateId.value = defaultTpl.id
    }
  } catch { /* ignore */ }
})
</script>

<style lang="scss" scoped>
.page-title { font-size: 18px; font-weight: 700; color: #1f2430; margin-bottom: 16px; }
.upload-drag-area {
  :deep(.el-upload-dragger) {
    padding: 40px 20px;
    cursor: pointer;
  }
}
.upload-text {
  margin-top: 12px;
  font-size: 15px;
  color: #34495E;
  .click-hint {
    color: #1f2430;
    text-decoration: underline;
    cursor: pointer;
    font-style: normal;
    font-weight: 600;
  }
}
.upload-tip {
  margin-top: 8px;
  font-size: 12px;
  color: #909399;
}
</style>
