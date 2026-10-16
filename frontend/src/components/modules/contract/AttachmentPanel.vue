<template>
  <el-card style="margin-top:16px">
    <template #header>
      <span>合同附件</span>
      <el-button size="small" type="primary" style="margin-left:12px" :loading="uploading" @click="pickFiles()">上传文件</el-button>
      <el-button size="small" @click="openGen">生成单据</el-button>
      <el-button size="small" @click="openGroups">常用附件组</el-button>
      <el-button size="small" :disabled="!tenantId" @click="inheritFromTenant">继承该租客上一份合同</el-button>
      <span style="font-size:12px;color:var(--n-600);margin-left:8px">
        可拖拽文件/文件夹到本卡片，或直接 Ctrl+V 粘贴截图；支持 PDF / Word / 图片 / Excel
      </span>
    </template>

    <!-- 拖拽投放区 -->
    <div
      class="drop-zone"
      :class="{ 'drop-zone--over': dragOver }"
      @dragover.prevent="dragOver = true"
      @dragleave="dragOver = false"
      @drop.prevent="onDrop"
    >
      <span v-if="dragOver">松开即可上传</span>
      <span v-else-if="!attachments.length">把文件拖到这里，或点右上角「上传文件」</span>
      <span v-else>已上传 {{ attachments.length }} 个附件（可继续拖入、粘贴或点「上传文件」）</span>
    </div>

    <!-- 待补材料清单（用户 2026-10-16：第 ⑤⑨ 项——按附件组一键列出该补什么，并自动判定已有/还缺） -->
    <div v-if="checklist.length" style="margin-top:14px">
      <div class="row-head">
        <span><b>待补材料</b>（{{ summaryText }}）</span>
        <span>
          <el-button link type="primary" size="small" @click="openGroups">换个附件组</el-button>
          <el-button v-if="missing > 0" link type="primary" size="small" @click="pickFiles(pendingItem())">补齐缺件</el-button>
        </span>
      </div>
      <DataTable :data="checklist" :columns="CHECK_COLUMNS" row-key="title" style="margin-top:6px">
        <template #c2="{ row }">
          <el-tag :type="row.done ? 'success' : (row.required ? 'danger' : 'warning')" size="small" effect="plain">
            {{ row.done ? '已有' : (row.required ? '必选·缺' : '选填·缺') }}
          </el-tag>
        </template>
        <template #c3="{ row }">{{ row.note || '—' }}</template>
        <template #c4="{ row }">
          <span v-if="row.done" style="font-size:12px;color:var(--n-600)">{{ row.matchedBy }}</span>
          <el-button v-else link type="primary" size="small" @click="pickFiles(row)">上传</el-button>
        </template>
        <template #c5="{ row }">
          <el-button link type="danger" size="small" @click="removeRequirement(row)">移除</el-button>
        </template>
      </DataTable>
      <div style="font-size:12px;color:var(--n-600);margin-top:4px">
        上传后把附件标题命名为材料名（如「房屋交接单」），系统会自动认定该项已补齐。
      </div>
    </div>
    <div v-else style="margin-top:14px;font-size:12px;color:var(--n-600)">
      还没有材料清单。点「常用附件组」选一套（如公寓标准附件包）即可一键列出该合同通常要附的材料。
    </div>

    <!-- 附件列表 -->
    <DataTable :data="attachments" :columns="COLUMNS" row-key="path" style="margin-top:12px"
      empty-title="暂无附件" empty-description="拖拽、粘贴或点「上传文件」添加；附件会按你设置的标题打印在合同的附件清单里">
      <template #c2="{ row }">
        <span v-if="row.title">{{ row.title }}</span>
        <span v-else style="color:var(--n-600);font-size:12px">未设置（打印用文件名）</span>
      </template>
      <template #c3="{ row }">{{ formatFileSize(row.size) }}</template>
      <template #c4="{ row }">{{ row.uploadedAt?.slice(0, 16)?.replace('T', ' ') }}</template>
      <template #c5="{ row }">
        <el-button link type="primary" size="small" @click="editTitle(row)">编辑标题</el-button>
      </template>
    </DataTable>

    <!-- 隐藏文件选择器：批量选择 / 针对某条待补材料上传 -->
    <input ref="fileInput" type="file" multiple hidden :accept="ATTACHMENT_ACCEPT" @change="onPicked" />

    <!-- 生成单据（① 模板库一键生成 / ③ 系统记录导出；用户 2026-10-16） -->
    <el-dialog v-model="genVisible" title="生成单据作为附件" width="900px">
      <div style="font-size:12px;color:var(--n-600);margin-bottom:8px">
        选一张模板 → 系统用本合同的租客/房源/金额自动填好 → 生成 Word 文件并直接作为附件（生成后可再改标题）。
        {{ genHint }}
      </div>
      <el-select v-model="genTemplateId" style="width:100%" placeholder="选择单据模板" @change="refreshGen">
        <el-option-group v-for="g in genGroups" :key="g.label" :label="g.label">
          <el-option v-for="t in g.items" :key="t.id" :label="t.name" :value="t.id" />
        </el-option-group>
      </el-select>
      <div v-if="genHTML" style="margin-top:10px;border:1px solid var(--el-border-color);border-radius:4px;padding:12px;max-height:340px;overflow:auto;font-size:13px" v-html="genHTML" />
      <div v-else style="margin-top:10px;font-size:12px;color:var(--n-600)">选中模板后这里会显示将要生成的单据预览。</div>
      <template #footer>
        <el-button @click="genVisible = false">取消</el-button>
        <el-button type="primary" :loading="genLoading" :disabled="!genTemplateId" @click="generateDoc">生成并作为附件</el-button>
      </template>
    </el-dialog>

    <!-- 常用附件组 -->
    <el-dialog v-model="groupVisible" title="常用附件组" width="860px">
      <div style="margin-bottom:8px;font-size:12px;color:var(--n-600)">
        内置 4 套标准包（公寓 / 厂房仓库 / 商铺 / 续约补充），内容可改、不可删；也可以自建任意组。
      </div>
      <DataTable :data="groups" :columns="GROUP_COLUMNS" row-key="id">
        <template #c2="{ row }">{{ row.scope }}</template>
        <template #c3="{ row }">{{ (row.items || []).length }} 项<span style="color:var(--n-600);font-size:12px">（必选 {{ (row.items || []).filter((i: any) => i.required).length }}）</span></template>
        <template #c4="{ row }">
          <el-button link type="primary" size="small" @click="applyGroup(row)">应用到本合同</el-button>
          <el-button link type="primary" size="small" @click="editGroup(row)">编辑</el-button>
          <el-button v-if="!row.isBuiltIn" link type="danger" size="small" @click="removeGroup(row)">删除</el-button>
        </template>
      </DataTable>
      <el-divider />
      <div class="row-head"><span><b>{{ groupForm.id ? '编辑附件组' : '新建附件组' }}</b></span></div>
      <el-form :model="groupForm" label-width="90px" style="margin-top:8px">
        <el-form-item label="组名"><el-input v-model="groupForm.name" placeholder="如：办公园区标准附件包" style="max-width:420px" /></el-form-item>
        <el-form-item label="适用业态">
          <el-select v-model="groupForm.scope" style="width:160px">
            <el-option v-for="s in SCOPES" :key="s" :label="s" :value="s" />
          </el-select>
        </el-form-item>
        <el-form-item label="说明"><el-input v-model="groupForm.description" placeholder="选填" style="max-width:420px" /></el-form-item>
        <el-form-item label="材料清单">
          <div v-for="(it, i) in groupForm.items" :key="i" class="item-row">
            <el-input v-model="it.title" placeholder="材料名，如房屋交接单" style="width:220px" />
            <el-checkbox v-model="it.required">必选</el-checkbox>
            <el-input v-model="it.note" placeholder="备注（选填）" style="width:220px" />
            <el-button link type="danger" size="small" @click="groupForm.items.splice(i, 1)">删除</el-button>
          </div>
          <el-button size="small" @click="groupForm.items.push({ title: '', required: true, note: '' })">添加一条</el-button>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="resetGroupForm">清空表单</el-button>
        <el-button type="primary" @click="saveGroup">保存附件组</el-button>
      </template>
    </el-dialog>
  </el-card>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import DataTable from '@/components/base/DataTable.vue';
import type { TableColumn } from '@/components/base/types';
import request, { apiBaseURL } from '@/api/request';
import { ATTACHMENT_ACCEPT, splitAllowed, checklistSummary } from '@/utils/attachment-upload';
import { buildDocContext, buildDocHTML, buildRows, docxFileName } from '@/utils/attachment-docs';
import { buildDocxBlob, DOCX_MIME } from '@/utils/docx';

/**
 * 合同附件面板（用户 2026-10-16 附件便捷化：⑥拖拽/批量/粘贴上传、⑨常用附件组、⑤待补清单+缺失提醒、⑩继承）。
 * 起草页与详情页共用同一份实现，避免两处逻辑分叉。
 */
const props = defineProps<{ contractId: number; tenantId?: number | null; editable?: boolean }>();
const emit = defineEmits<{ (e: 'changed'): void }>();

const attachments = ref<any[]>([]);
const checklist = ref<any[]>([]);
const missing = ref(0);
const missingRequired = ref(0);
const uploading = ref(false);
const dragOver = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);
let pendingTitle = '';

const COLUMNS: TableColumn[] = [
  { prop: 'name', label: '文件名', minWidth: 200, tooltip: true },
  { prop: 'title', label: '附件标题/备注', minWidth: 180, tooltip: true, slot: 'c2' },
  { label: '大小', width: 100, slot: 'c3' },
  { prop: 'uploadedAt', label: '上传时间', width: 170, slot: 'c4' },
  { label: '操作', width: 110, slot: 'c5' },
];
const CHECK_COLUMNS: TableColumn[] = [
  { prop: 'title', label: '材料', minWidth: 180, tooltip: true },
  { label: '状态', width: 110, slot: 'c2' },
  { prop: 'note', label: '备注', minWidth: 160, tooltip: true, slot: 'c3' },
  { label: '附件', width: 160, slot: 'c4' },
  { label: '操作', width: 90, slot: 'c5' },
];
const GROUP_COLUMNS: TableColumn[] = [
  { prop: 'name', label: '附件组', minWidth: 200, tooltip: true },
  { prop: 'scope', label: '适用业态', width: 110, slot: 'c2' },
  { label: '包含材料', width: 140, slot: 'c3' },
  { label: '操作', width: 230, slot: 'c4' },
];

const SCOPES = ['全部', '公寓', '厂房', '商铺'];
const summaryText = computed(() => checklistSummary({ missing: missing.value, missingRequired: missingRequired.value }));

function formatFileSize(bytes: number) {
  if (!bytes) return '0 B';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

async function loadAll() {
  if (!props.contractId) return;
  try {
    const [f, c] = await Promise.all([
      request.get('/contracts/' + props.contractId + '/files'),
      request.get('/attachment-groups/checklist/' + props.contractId),
    ]);
    attachments.value = (f as any).data?.list || [];
    checklist.value = (c as any).data?.checklist || [];
    missing.value = (c as any).data?.missing || 0;
    missingRequired.value = (c as any).data?.missingRequired || 0;
  } catch { /* 拦截器已提示 */ }
}

// ===== 上传（批量 / 拖拽 / 粘贴 / 针对某条待补材料）=====
function pickFiles(item?: any) {
  pendingTitle = item ? String(item.title || '') : '';
  fileInput.value?.click();
}
function onPicked(e: Event) {
  const input = e.target as HTMLInputElement;
  const files = Array.from(input.files || []);
  input.value = '';
  void uploadFiles(files, pendingTitle);
  pendingTitle = '';
}

async function filesFromDataTransfer(dt: DataTransfer | null): Promise<File[]> {
  const out: File[] = [];
  const items = dt?.items ? Array.from(dt.items as any) : [];
  const entries = items.map((it: any) => (typeof it.webkitGetAsEntry === 'function' ? it.webkitGetAsEntry() : null)).filter(Boolean);
  if (entries.length) {
    const walk = async (entry: any): Promise<void> => {
      if (!entry) return;
      if (entry.isFile) {
        const f: File | null = await new Promise((res) => entry.file((x: File) => res(x), () => res(null)));
        if (f) out.push(f);
      } else if (entry.isDirectory) {
        const reader = entry.createReader();
        const read = async (): Promise<any[]> => await new Promise((res) => reader.readEntries((r: any[]) => res(r), () => res([])));
        let chunk = await read();
        while (chunk.length) { for (const c of chunk) await walk(c); chunk = await read(); }
      }
    };
    for (const e of entries) await walk(e);
    if (out.length) return out;
  }
  return Array.from(dt?.files || []);
}

async function onDrop(e: DragEvent) {
  dragOver.value = false;
  const files = await filesFromDataTransfer(e.dataTransfer);
  if (!files.length) { ElMessage.warning('没有识别到文件（文件夹为空或没有读取权限）'); return; }
  await uploadFiles(files);
}

function onPaste(e: ClipboardEvent) {
  const files = Array.from(e.clipboardData?.files || []);
  if (!files.length) return;
  e.preventDefault();
  void uploadFiles(files);
}

async function uploadFiles(files: File[], titleFor = '') {
  const { allowed, rejected } = splitAllowed(files);
  if (rejected.length) ElMessage.warning('已跳过不支持的文件：' + rejected.slice(0, 5).join('、') + (rejected.length > 5 ? ' 等' : ''));
  if (!allowed.length) return;
  uploading.value = true;
  try {
    const fd = new FormData();
    allowed.forEach((f) => fd.append('files', f));
    const token = localStorage.getItem('accessToken');
    // 必须用 apiBaseURL：Electron 打包后是 file:// 协议，相对路径 '/api/...' 会失败（静态门禁 R4）
    const resp = await fetch(apiBaseURL + '/contracts/' + props.contractId + '/upload', {
      method: 'POST',
      headers: token ? { Authorization: 'Bearer ' + token } : {},
      body: fd,
    });
    const data = await resp.json();
    if (data?.code !== 200) { ElMessage.error(data?.message || '上传失败'); return; }
    const uploaded = data.data || [];
    if (titleFor) {
      for (const f of uploaded) {
        await request.put('/contracts/' + props.contractId + '/files/title', { path: f.path, title: titleFor });
      }
    }
    ElMessage.success('已上传 ' + uploaded.length + ' 个附件' + (titleFor ? '，并按材料名命名为「' + titleFor + '」' : ''));
    await loadAll();
    emit('changed');
  } catch (err: any) {
    ElMessage.error(err?.message || '上传失败');
  } finally { uploading.value = false; }
}

async function editTitle(row: any) {
  try {
    const { value } = await ElMessageBox.prompt(
      '标题/备注会打印在合同的「附件清单」里（例如把 scan_2026.pdf 显示成「房屋交接单」）。留空则回退用文件名。',
      '设置附件标题',
      { inputValue: row.title || '', inputPlaceholder: '如：房屋交接单', confirmButtonText: '保存', cancelButtonText: '取消' },
    );
    const res: any = await request.put('/contracts/' + props.contractId + '/files/title', { path: row.path, title: String(value || '').trim() });
    ElMessage.success(res.message || '附件标题已保存');
    await loadAll();
    emit('changed');
  } catch (err: any) {
    if (err === 'cancel' || err === 'close') return;
    if (err?.response?.data?.message) ElMessage.error(err.response.data.message);
  }
}

// ===== 待补清单 =====
async function removeRequirement(row: any) {
  try {
    await ElMessageBox.confirm('从待补清单里移除「' + row.title + '」？（不影响已上传的附件）', '确认', { type: 'warning' });
  } catch { return; }
  const res: any = await request.delete('/attachment-groups/checklist/' + props.contractId + '/item', { data: { title: row.title } });
  ElMessage.success(res.message || '已移除');
  await loadAll();
}
function pendingItem() {
  return checklist.value.find((i) => !i.done && i.required) || checklist.value.find((i) => !i.done) || null;
}

// ===== 常用附件组 =====
const groupVisible = ref(false);
const groups = ref<any[]>([]);
const groupForm = ref<any>({ id: 0, name: '', scope: '全部', description: '', items: [] });
function resetGroupForm() { groupForm.value = { id: 0, name: '', scope: '全部', description: '', items: [] }; }
async function openGroups() {
  groupVisible.value = true;
  const res: any = await request.get('/attachment-groups');
  groups.value = res.data?.list || [];
}
async function applyGroup(row: any) {
  const res: any = await request.post('/attachment-groups/checklist/' + props.contractId + '/apply', { groupId: row.id });
  ElMessage.success(res.message || '已应用');
  await loadAll();
  groupVisible.value = false;
}
function editGroup(row: any) {
  groupForm.value = { id: row.id, name: row.name, scope: row.scope || '全部', description: row.description || '', items: (row.items || []).map((i: any) => ({ title: i.title, required: !!i.required, note: i.note || '' })) };
}
async function saveGroup() {
  const payload = { ...groupForm.value, items: (groupForm.value.items || []).filter((i: any) => String(i.title || '').trim()) };
  if (!payload.name.trim()) { ElMessage.warning('请填写附件组名称'); return; }
  if (!payload.items.length) { ElMessage.warning('至少要有一条材料'); return; }
  const res: any = payload.id
    ? await request.put('/attachment-groups/' + payload.id, payload)
    : await request.post('/attachment-groups', payload);
  ElMessage.success(res.message || '已保存');
  await openGroups();
  if (!payload.id) resetGroupForm();
}
async function removeGroup(row: any) {
  try {
    await ElMessageBox.confirm('删除附件组「' + row.name + '」？（不影响已应用到合同的清单）', '确认', { type: 'warning' });
  } catch { return; }
  await request.delete('/attachment-groups/' + row.id);
  ElMessage.success('已删除');
  await openGroups();
}

// ===== 继承 =====
async function inheritFromTenant() {
  try {
    await ElMessageBox.confirm('把该租客上一份合同的附件条目与材料清单继承到本合同？重复的会自动跳过。', '继承附件', { type: 'info' });
  } catch { return; }
  try {
    const res: any = await request.post('/attachment-groups/inherit/' + props.contractId, { fromTenantId: props.tenantId });
    ElMessage.success(res.message || '已继承');
    await loadAll();
    emit('changed');
  } catch (err: any) {
    if (err?.response?.data?.message) ElMessage.error(err.response.data.message);
  }
}

// ===== 生成单据（① 模板库一键生成 / ③ 系统记录导出）=====
const genVisible = ref(false);
const genTemplates = ref<any[]>([]);
const genTemplateId = ref<number | null>(null);
const genHTML = ref('');
const genLoading = ref(false);
const contractData = ref<any>(null);
const companyInfo = ref<{ name: string; signer: string }>({ name: '', signer: '' });
// 提示文案放在常量里：模板插值 {{ }} 里不能直接写 ${...}（Vue 编译器会把它当成表达式，导致 Vite 500）
const genHint = '选一张模板，系统用本合同的租客/房源/金额自动填好，生成 Word 并直接作为附件（可再改标题）。模板里的占位符（${tenantName}、${contractNo} 等）会自动替换为合同数据。';

const genGroups = computed(() => {
  const order = ['标准单据', '系统记录', '自定义'];
  const map: Record<string, any[]> = {};
  for (const t of genTemplates.value) (map[t.category || '自定义'] = map[t.category || '自定义'] || []).push(t);
  return order.filter((k) => map[k]?.length).map((k) => ({ label: k, items: map[k] }));
});

async function openGen() {
  genVisible.value = true;
  if (!contractData.value) {
    try {
      const r: any = await request.get('/contracts/' + props.contractId);
      contractData.value = r.data || {};
    } catch { contractData.value = {}; }
  }
  if (!companyInfo.value.name) {
    try {
      const r: any = await request.get('/system-configs/keys', { params: { keys: 'company_name_for_print,company_signer' } });
      const map: Record<string, string> = {};
      (r.data || []).forEach((c: any) => { map[c.configKey] = c.configValue; });
      companyInfo.value = { name: map['company_name_for_print'] || '', signer: map['company_signer'] || '' };
    } catch { /* 未配置则留空 */ }
  }
  const r: any = await request.get('/attachment-templates');
  genTemplates.value = r.data?.list || [];
  if (!genTemplateId.value && genTemplates.value.length) genTemplateId.value = genTemplates.value[0].id;
  await refreshGen();
}

function genContext() {
  const c = contractData.value || {};
  return buildDocContext({
    contract: c, tenant: c.tenant, property: c.property,
    companyName: companyInfo.value.name, companySigner: companyInfo.value.signer,
  });
}

/** 取系统记录数据（③）：消防器材台账 / 本合同账单 / 合同条款全文 */
async function genRows(tpl: any): Promise<any[]> {
  const src = tpl?.dataSource || '';
  if (!src) return [];
  try {
    if (src === 'fire-equipment') {
      const r: any = await request.get('/fire-safety/equipment', { params: { page: 1, pageSize: 200 } });
      return buildRows(src, r.data?.rows || r.data?.list || []);
    }
    if (src === 'bills') {
      const r: any = await request.get('/bills', { params: { contractId: props.contractId, page: 1, pageSize: 200 } });
      return buildRows(src, r.data?.list || r.data?.rows || []);
    }
    if (src === 'contract-clauses') {
      const c = contractData.value || (await request.get('/contracts/' + props.contractId) as any).data || {};
      return buildRows(src, c);
    }
  } catch { /* 取数失败时先出空表，不阻断生成 */ }
  return [];
}

async function refreshGen() {
  const tpl = genTemplates.value.find((t) => t.id === genTemplateId.value);
  if (!tpl) { genHTML.value = ''; return; }
  const rows = await genRows(tpl);
  genHTML.value = buildDocHTML(tpl, genContext(), rows);
}

async function generateDoc() {
  const tpl = genTemplates.value.find((t) => t.id === genTemplateId.value);
  if (!tpl) return;
  genLoading.value = true;
  try {
    const rows = await genRows(tpl);
    const html = buildDocHTML(tpl, genContext(), rows);
    const blob = await buildDocxBlob(html, { title: tpl.docTitle || tpl.name, subject: '合同附件' } as any);
    const name = docxFileName(tpl.name, genContext().contractNo);
    const file = new File([blob], name, { type: DOCX_MIME });
    await uploadFiles([file], tpl.name);
    genVisible.value = false;
  } catch (err: any) {
    ElMessage.error(err?.message || '生成单据失败');
  } finally { genLoading.value = false; }
}

onMounted(() => { void loadAll(); window.addEventListener('paste', onPaste); });
onUnmounted(() => window.removeEventListener('paste', onPaste));
</script>

<style scoped>
.drop-zone {
  border: 1px dashed var(--el-border-color);
  border-radius: 4px;
  padding: 10px 12px;
  font-size: 12px;
  color: var(--n-600);
  text-align: center;
  transition: all 0.15s;
}
.drop-zone--over {
  border-color: var(--el-color-primary);
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}
.row-head { display: flex; justify-content: space-between; align-items: center; font-size: 13px; }
.item-row { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
</style>
