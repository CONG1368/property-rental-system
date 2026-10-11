<template>
  <el-card class="revision-panel" shadow="never">
    <template #header>
      <div class="panel-head">
        <span class="panel-title">租户条款修订</span>
        <div class="panel-actions">
          <el-tag v-if="pendingCount > 0" type="warning" size="small">待处理 {{ pendingCount }} 条</el-tag>
          <el-upload
            :action="uploadUrl"
            :headers="uploadHeaders"
            name="file"
            :show-file-list="false"
            accept=".docx,.doc,.pdf"
            :before-upload="onBeforeUpload"
            :on-success="onUploaded"
            :on-error="onUploadError"
          >
            <el-button type="primary" size="small" :loading="uploading">
              <el-icon><Upload /></el-icon> 上传租户修订版
            </el-button>
          </el-upload>
        </div>
      </div>
    </template>

    <el-alert
      v-if="pendingCount > 0"
      type="warning"
      :closable="false"
      show-icon
      style="margin-bottom:12px"
      :title="`租户回传的合同有 ${pendingCount} 份修订待确认`"
      :description="pendingHint"
    />

    <DataTable
      :data="revisions"
      :columns="COLUMNS"
      row-key="id"
      empty-title="暂无修订记录"
      empty-description="租户改动条款后，把回传的 Word / PDF 上传即可自动比对"
    >
      <template #c3="{ row }">{{ formatTime(row.createdAt) }}</template>
      <template #c4="{ row }">
        <el-tag :type="statusTagType(row.status)" size="small">{{ row.status }}</el-tag>
      </template>
      <template #c5="{ row }">
        <el-button link type="primary" size="small" @click="openDiff(row)">查看差异</el-button>
        <el-button v-if="row.status === '待处理'" link type="success" size="small" @click="apply(row)">应用到合同</el-button>
        <el-button v-if="row.status === '待处理'" link type="info" size="small" @click="ignore(row)">忽略</el-button>
      </template>
    </DataTable>

    <el-dialog v-model="diffVisible" title="条款差异：租户修订版 vs 合同当前条款" width="900px" top="6vh">
      <div class="diff-summary">{{ currentSummary }}</div>
      <div v-for="(it, i) in diffItems" :key="i" class="diff-item">
        <div class="diff-head">
          <el-tag :type="statusTagType(it.status)" size="small">{{ statusLabel(it.status) }}</el-tag>
          <span class="diff-title">{{ it.newTitle || it.oldTitle || '(无标题条款)' }}</span>
        </div>
        <div v-if="it.status === 'modified'" class="diff-body">
          <p v-if="it.titleChanged" class="diff-line">
            标题：「{{ it.oldTitle || '(无标题)' }}」 → 「{{ it.newTitle || '(无标题)' }}」
          </p>
          <p v-for="(f, j) in it.fragments" :key="j" class="diff-frag" :class="'frag-' + f.type">{{ f.text }}</p>
        </div>
        <div v-else-if="it.status === 'added'" class="diff-body">
          <p class="diff-frag frag-add">{{ it.newContent }}</p>
        </div>
        <div v-else-if="it.status === 'removed'" class="diff-body">
          <p class="diff-frag frag-remove">{{ it.oldContent }}</p>
        </div>
        <div v-else class="diff-body"><p class="diff-frag frag-same">{{ it.newContent }}</p></div>
      </div>
      <template #footer>
        <el-button @click="diffVisible = false">关闭</el-button>
        <el-button v-if="currentRow && currentRow.status === '待处理'" type="primary" @click="apply(currentRow)">应用到合同条款</el-button>
      </template>
    </el-dialog>
  </el-card>
</template>

<script setup lang="ts">
// 租户条款修订（用户 2026-10-11 要求）：
// 租户把改过的合同回传后，用户上传即可自动拆条比对，面板直接提示「改了哪些内容」，
// 看清差异后一键把修订版条款写回合同。
import { ref, computed, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import request, { apiBaseURL } from '@/api/request';
import { formatDate } from '@/utils/print-service';
import DataTable from '@/components/base/DataTable.vue';
import type { TableColumn } from '@/components/base/types';

// P5 约定：表格一律用共享 DataTable（禁止内联 el-table）
const COLUMNS: TableColumn[] = [
  { prop: 'sourceFileName', label: '文件', minWidth: 170, tooltip: true },
  { prop: 'summary', label: '改了哪些内容', minWidth: 220, tooltip: true },
  { label: '上传时间', width: 150, slot: 'c3' },
  { label: '状态', width: 90, slot: 'c4' },
  { label: '操作', width: 210, slot: 'c5', fixed: 'right' },
];

const props = defineProps<{ contractId: number | string }>();
const emit = defineEmits<{ (e: 'applied'): void }>();

const revisions = ref<any[]>([]);
const uploading = ref(false);
const diffVisible = ref(false);
const diffItems = ref<any[]>([]);
const currentRow = ref<any>(null);
const currentSummary = ref('');

const uploadUrl = computed(() => `${apiBaseURL}/contracts/${props.contractId}/clause-diff`);
const uploadHeaders = computed(() => ({ Authorization: 'Bearer ' + (localStorage.getItem('accessToken') || '') }));
const pendingList = computed(() => revisions.value.filter((r) => r.status === '待处理'));
const pendingCount = computed(() => pendingList.value.length);
const pendingHint = computed(() => pendingList.value.map((r) => `${r.sourceFileName}：${r.summary}`).join('；'));

function formatTime(v: string): string {
  return v ? String(formatDate(new Date(v))) : '-';
}
function statusTagType(status: string): 'success' | 'warning' | 'info' | 'danger' {
  if (status === '待处理') return 'warning';
  if (status === '已应用') return 'success';
  return 'info';
}
function statusLabel(status: string): string {
  return ({ unchanged: '无变化', modified: '已修改', added: '新增', removed: '已删除' } as Record<string, string>)[status] || status;
}

async function load(): Promise<void> {
  try {
    const res = await request.get(`/contracts/${props.contractId}/clause-revisions`);
    revisions.value = res.data || [];
  } catch { /* 拦截器已提示 */ }
}

function onBeforeUpload(): void { uploading.value = true; }

function showDiff(diff: any, row?: any): void {
  currentRow.value = row || null;
  currentSummary.value = diff?.summary || '';
  diffItems.value = diff?.items || [];
  diffVisible.value = true;
}

async function openDiff(row: any): Promise<void> {
  try {
    const res = await request.get(`/contracts/${props.contractId}/clause-revisions/${row.id}`);
    showDiff(res.data?.diff, row);
  } catch { ElMessage.error('加载差异失败'); }
}

function onUploaded(res: any): void {
  uploading.value = false;
  if (res?.code === 200) {
    const diff = res.data?.diff;
    ElMessage.success(`已解析租户修订版：${diff?.summary || ''}`);
    load();
    showDiff(diff, { status: '待处理', id: res.data?.revision?.id, summary: diff?.summary });
  } else {
    ElMessage.error(res?.message || '解析失败');
  }
}

function onUploadError(err: any): void {
  uploading.value = false;
  let msg = '上传失败';
  try { const j = JSON.parse(err?.message || '{}'); if (j?.message) msg = j.message; } catch { if (err?.message) msg = err.message; }
  ElMessage.error(msg);
}

async function apply(row: any): Promise<void> {
  if (!row?.id) return;
  try {
    await ElMessageBox.confirm('确定把租户修订版的条款写入本合同？合同当前的条款会被替换。', '应用到合同条款', { type: 'warning' });
  } catch { return; }
  try {
    const res = await request.post(`/contracts/${props.contractId}/clause-revisions/${row.id}/apply`);
    ElMessage.success(`已应用：合同条款更新为 ${res.data?.clauseCount ?? 0} 条`);
    diffVisible.value = false;
    await load();
    emit('applied');
  } catch { /* 拦截器已提示 */ }
}

async function ignore(row: any): Promise<void> {
  try {
    await ElMessageBox.confirm('忽略这份修订？忽略后不会再提示，合同条款保持不变。', '忽略修订', { type: 'info' });
  } catch { return; }
  try {
    await request.post(`/contracts/${props.contractId}/clause-revisions/${row.id}/ignore`);
    ElMessage.success('已忽略该修订');
    await load();
  } catch { /* 拦截器已提示 */ }
}

onMounted(load);
</script>

<style scoped>
.panel-head { display: flex; align-items: center; justify-content: space-between; }
.panel-title { font-weight: 600; }
.panel-actions { display: flex; align-items: center; gap: 10px; }
.diff-summary { margin-bottom: 12px; font-size: 13px; color: var(--n-600); }
.diff-item { padding: 10px 12px; margin-bottom: 10px; border: 1px solid var(--n-200); border-radius: 4px; }
.diff-head { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.diff-title { font-weight: 600; }
.diff-body { font-size: 13px; line-height: 1.9; }
.diff-line { margin: 2px 0; color: var(--n-600); }
.diff-frag { display: inline; margin: 0 2px 0 0; }
.frag-add { background: var(--el-color-success-light-9); color: var(--el-color-success); text-decoration: underline; }
.frag-remove { background: var(--el-color-danger-light-9); color: var(--el-color-danger); text-decoration: line-through; }
.frag-same { color: var(--n-700); }
</style>
