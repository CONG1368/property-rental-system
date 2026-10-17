<template>
  <el-card style="margin-top:16px">
    <template #header>
      <span>合同附件</span>
      <el-button size="small" type="primary" style="margin-left:12px" :loading="uploading" @click="pickFiles()">上传文件</el-button>
      <el-button size="small" @click="openCamera">拍照上传</el-button>
      <el-button size="small" @click="scanNow">扫描仪扫描</el-button>
      <el-button size="small" @click="openPhoneUpload('direct')">手机上传</el-button>
      <el-button size="small" @click="openPhoneUpload('review')">租户上传（需审核）</el-button>
      <el-button size="small" @click="pullESign">回传电子签文件</el-button>
      <el-button size="small" @click="openRefs">引用已有资料</el-button>
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

    <!-- 引用已有资料（④ • 引用型附件：只记引用不复制文件） -->
    <el-dialog v-model="refVisible" title="引用已有资料作为附件" width="720px">
      <div style="font-size:12px;color:var(--n-600);margin-bottom:8px">
        引用租客档案里已上传的资料作为本合同附件：<b>不复制文件</b>，打印时按其标题列在附件目录里（实际文件仍以租客档案中的原件为准）。
      </div>
      <div v-if="refs.length === 0" style="font-size:13px;color:var(--n-600)">该租客档案里还没有可引用的资料（可在「租客档案」里上传身份证照片或附件后再来引用）。</div>
      <DataTable v-else :data="refs" :columns="REF_COLUMNS" row-key="kind">
        <template #c2="{ row }">
          <img v-if="row.kind === 'tenant-id-photo' && row.preview" :src="row.preview" style="height:38px;border-radius:4px" />
          <span v-else style="font-size:12px;color:var(--n-600)">—</span>
        </template>
        <template #c3="{ row }">
          <el-button link type="primary" size="small" @click="attachRef(row)">引用</el-button>
        </template>
      </DataTable>
      <template #footer><el-button @click="refVisible = false">关闭</el-button></template>
    </el-dialog>

    <!-- 待审核附件（⑬ 租户自助上传后的审核箱；有内容时才出现） -->
    <div v-if="inbox.length > 0" style="margin-top:14px">
      <div class="row-head">
        <span><b>待审核附件</b>（{{ inbox.length }} 个，租户/手机上传后需通过才成为正式附件）</span>
        <el-button link type="primary" size="small" @click="approveAllInbox">全部通过</el-button>
      </div>
      <DataTable :data="inbox" :columns="INBOX_COLUMNS" row-key="path" style="margin-top:6px">
        <template #c2="{ row }">{{ row.source || '租户上传' }}</template>
        <template #c3="{ row }">{{ row.uploadedAt?.slice(0, 16)?.replace('T', ' ') }}</template>
        <template #c4="{ row }">
          <el-button link type="primary" size="small" @click="approveInbox(row)">通过</el-button>
          <el-button link type="danger" size="small" @click="rejectInbox(row)">驳回</el-button>
        </template>
      </DataTable>
    </div>

    <!-- 附件列表 -->
    <div v-if="attachments.length > 0" style="font-size:12px;color:var(--n-600);margin:10px 0 2px">
      共 {{ attachments.length }} 件：打印/导出时会在甲乙双方签名之后另起一页列出「附件目录」，编号与顺序即下方列表的顺序（可拖动排序按钮调整）。
    </div>
    <DataTable :data="attachments" :columns="COLUMNS" row-key="path" style="margin-top:12px"
      empty-title="暂无附件" empty-description="拖拽、粘贴或点「上传文件」添加；附件会按你设置的标题打印在合同的附件清单里">
      <template #c2="{ row }">
        <span v-if="row.title">{{ row.title }}</span>
        <span v-else style="color:var(--n-600);font-size:12px">未设置（打印用文件名）</span>
        <el-tag v-if="row.source === '引用'" size="small" type="warning" effect="plain" style="margin-left:4px">引用</el-tag>
      </template>
      <template #c3="{ row }">
        <el-select :model-value="row.group || ''" size="small" placeholder="未分组" clearable style="width:112px" @change="(v: string) => setGroup(row, v)">
          <el-option v-for="g in ATTACHMENT_GROUPS" :key="g" :label="g" :value="g" />
        </el-select>
      </template>
      <template #c4="{ row }">{{ formatFileSize(row.size) }}</template>
      <template #c5="{ row }">{{ row.uploadedAt?.slice(0, 16)?.replace('T', ' ') }}</template>
      <template #c6="{ row }">
        <el-button link type="primary" size="small" @click="editTitle(row)">编辑标题</el-button>
        <el-button link type="primary" size="small" :disabled="row.path === attachments[0]?.path" @click="moveAttachment(row, -1)">上移</el-button>
        <el-button link type="primary" size="small" :disabled="row.path === attachments[attachments.length - 1]?.path" @click="moveAttachment(row, 1)">下移</el-button>
      </template>
    </DataTable>

    <!-- 隐藏文件选择器：批量选择 / 针对某条待补材料上传 -->
    <input ref="fileInput" type="file" multiple hidden :accept="ATTACHMENT_ACCEPT" @change="onPicked" />

    <!-- 拍照上传（⑦ 拍照/扫描仪直传：摄像头直拍 → 直接作为附件；用户 2026-10-16） -->
    <el-dialog v-model="camVisible" title="拍照上传" width="720px" @close="closeCamera">
      <video ref="camVideo" autoplay playsinline muted style="width:100%;max-height:60vh;border-radius:6px" />
      <div style="margin-top:8px;font-size:12px;color:var(--n-600)">对准证件/单据拍摄，光线充足、四角完整；拍完直接上传为该合同附件（标题自动记为「现场照片」）。</div>
      <template #footer>
        <el-button @click="closeCamera">关闭</el-button>
        <el-button type="primary" @click="shoot">拍照并上传</el-button>
      </template>
    </el-dialog>

    <!-- 手机上传（⑧ 手机扫码/链接上传） -->
    <el-dialog v-model="phoneVisible" title="手机上传附件" width="640px">
      <div v-if="phoneLoading" style="font-size:13px;color:var(--n-600)">正在生成链接…</div>
      <div v-else>
        <p style="font-size:13px;margin:0 0 8px">用手机浏览器打开下面这个地址（与电脑在<b>同一 WiFi</b>），即可拍照或选文件直接上传到本合同附件里，<b>免装 App、免登录</b>：</p>
        <el-input :model-value="phoneUrl" readonly>
          <template #append><el-button @click="copyPhoneUrl">复制</el-button></template>
        </el-input>
        <p style="font-size:12px;color:var(--n-600);margin-top:8px">
          链接 {{ phoneMinutes }} 分钟内有效，仅对本合同生效。{{ phoneMode === 'review' ? '此链接为「租户上传」，上传后进入「待审核附件」，你通过后才成为正式附件。' : '上传后直接成为正式附件。' }}
          手机上传完成后点右下角按钮刷新；若手机打不开，请确认同一 WiFi 且防火墙允许 3001 端口。
        </p>
      </div>
      <template #footer>
        <el-button @click="phoneVisible = false">关闭</el-button>
        <el-button type="primary" @click="refreshAfterPhone">我已上传，刷新附件</el-button>
      </template>
    </el-dialog>

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
      <el-divider>模板管理（可自定义单据）</el-divider>
      <div class="row-head">
        <span style="font-size:12px;color:var(--n-600)">占位符点一下即复制，粘到标题/说明/字段值/条款里，生成时自动替换为合同数据</span>
        <span>
          <el-button size="small" @click="newTemplate">新建模板</el-button>
          <el-button size="small" :disabled="!editing" @click="duplicateTemplate">复制为新模板</el-button>
          <el-button size="small" type="primary" :loading="tplSaving" :disabled="!editing" @click="saveTemplate">保存模板</el-button>
          <el-button v-if="editing && !editing.isBuiltIn" size="small" type="danger" @click="removeTemplate">删除模板</el-button>
        </span>
      </div>
      <div style="margin:6px 0">
        <el-tag v-for="p in placeholders" :key="p.key" size="small" effect="plain" style="margin:2px 4px 2px 0;cursor:pointer" @click="copyPlaceholder(p.key)">{{ p.label }}</el-tag>
      </div>
      <div v-if="!editing" style="font-size:12px;color:var(--n-600)">在上方下拉里选一张模板即可编辑（内置模板也能改内容），或点「新建模板」从空白开始。</div>
      <el-form v-else :model="editing" label-width="96px" size="small" style="margin-top:4px">
        <el-form-item label="模板名称">
          <el-input v-model="editing.name" style="max-width:320px" />
          <el-tag v-if="editing.isBuiltIn" size="small" type="info" style="margin-left:8px">内置（可改不可删）</el-tag>
        </el-form-item>
        <el-form-item label="分类 / 业态">
          <el-select v-model="editing.category" style="width:132px">
            <el-option v-for="c in ['标准单据', '系统记录', '自定义']" :key="c" :label="c" :value="c" />
          </el-select>
          <el-select v-model="editing.scope" style="width:112px;margin-left:8px">
            <el-option v-for="s in SCOPES" :key="s" :label="s" :value="s" />
          </el-select>
          <el-input-number v-model="editing.sortOrder" :min="0" :max="9999" :controls="false" style="width:80px;margin-left:8px" />
        </el-form-item>
        <el-form-item label="文档标题"><el-input v-model="editing.docTitle" placeholder="如：房屋交接单" style="max-width:420px" /></el-form-item>
        <el-form-item label="开头说明"><el-input v-model="editing.intro" type="textarea" :rows="2" placeholder="可含占位符，如：甲方 ${companyName} 与乙方 ${tenantName} 确认如下：" /></el-form-item>
        <el-form-item label="字段表">
          <div v-for="(f, i) in editing.fields" :key="'f' + i" class="item-row">
            <el-input v-model="f.label" placeholder="字段名，如 合同编号" style="width:180px" />
            <el-input v-model="f.value" placeholder="值，可含占位符，如 ${contractNo}" style="width:300px" />
            <el-button link type="danger" size="small" @click="editing.fields.splice(i, 1)">删除</el-button>
          </div>
          <el-button size="small" @click="editing.fields.push({ label: '', value: '' })">加字段</el-button>
        </el-form-item>
        <el-form-item label="条款段落">
          <div v-for="(c, i) in editing.clauses" :key="'c' + i" class="item-row">
            <el-input v-model="editing.clauses[i]" placeholder="一条一段，可含占位符" style="width:480px" />
            <el-button link type="danger" size="small" @click="editing.clauses.splice(i, 1)">删除</el-button>
          </div>
          <el-button size="small" @click="editing.clauses.push('')">加条款</el-button>
        </el-form-item>
        <el-form-item label="签署栏">
          <div v-for="(s, i) in editing.signatures" :key="'s' + i" class="item-row">
            <el-input v-model="s.label" placeholder="如 甲方（签字）" style="width:180px" />
            <el-input v-model="s.name" placeholder="姓名，可含占位符" style="width:240px" />
            <el-button link type="danger" size="small" @click="editing.signatures.splice(i, 1)">删除</el-button>
          </div>
          <el-button size="small" @click="editing.signatures.push({ label: '甲方', name: '' })">加签署栏</el-button>
        </el-form-item>
        <el-form-item label="引用系统记录">
          <el-select v-model="editing.dataSource" clearable placeholder="不引用（普通单据）" style="width:280px">
            <el-option label="消防器材台账" value="fire-equipment" />
            <el-option label="本合同账单明细" value="bills" />
            <el-option label="本合同条款全文" value="contract-clauses" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="editing.dataSource" label="表格列">
          <div v-for="(col, i) in editing.tableColumns" :key="'col' + i" class="item-row">
            <el-input v-model="col.key" placeholder="字段键，如 name" style="width:180px" />
            <el-input v-model="col.label" placeholder="列名，如 器材名称" style="width:200px" />
            <el-button link type="danger" size="small" @click="editing.tableColumns.splice(i, 1)">删除</el-button>
          </div>
          <el-button size="small" @click="editing.tableColumns.push({ key: '', label: '' })">加列</el-button>
        </el-form-item>
      </el-form>
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
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import DataTable from '@/components/base/DataTable.vue';
import type { TableColumn } from '@/components/base/types';
import request, { apiBaseURL } from '@/api/request';
import { ATTACHMENT_ACCEPT, ATTACHMENT_GROUPS, splitAllowed, checklistSummary } from '@/utils/attachment-upload';
import { buildDocContext, buildDocHTML, buildRows, docxFileName, cloneTemplate, duplicateName } from '@/utils/attachment-docs';
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
  { prop: 'name', label: '文件名', minWidth: 170, tooltip: true },
  { prop: 'title', label: '附件标题/备注', minWidth: 150, tooltip: true, slot: 'c2' },
  { prop: 'group', label: '分组', width: 130, slot: 'c3' },
  { label: '大小', width: 90, slot: 'c4' },
  { prop: 'uploadedAt', label: '上传时间', width: 150, slot: 'c5' },
  { label: '操作', width: 210, slot: 'c6' },
];
const REF_COLUMNS: TableColumn[] = [
  { prop: 'title', label: '资料', minWidth: 220, tooltip: true },
  { label: '预览', width: 90, slot: 'c2' },
  { label: '操作', width: 90, slot: 'c3' },
];
const INBOX_COLUMNS: TableColumn[] = [
  { prop: 'name', label: '文件名', minWidth: 200, tooltip: true },
  { prop: 'source', label: '来源', width: 110, slot: 'c2' },
  { prop: 'uploadedAt', label: '上传时间', width: 170, slot: 'c3' },
  { label: '操作', width: 130, slot: 'c4' },
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

const inbox = ref<any[]>([]);

async function loadAll() {
  if (!props.contractId) return;
  try {
    const [f, c, i] = await Promise.all([
      request.get('/contracts/' + props.contractId + '/files'),
      request.get('/attachment-groups/checklist/' + props.contractId),
      request.get('/contracts/' + props.contractId + '/attachment-inbox'),
    ]);
    attachments.value = (f as any).data?.list || [];
    checklist.value = (c as any).data?.checklist || [];
    missing.value = (c as any).data?.missing || 0;
    missingRequired.value = (c as any).data?.missingRequired || 0;
    inbox.value = (i as any).data?.list || [];
  } catch { /* 拦截器已提示 */ }
}

// ===== 待审核附件：租户自助上传后由管理员通过/驳回（第 ⑬ 项）=====
async function approveInbox(row: any) {
  try {
    const res: any = await request.post('/contracts/' + props.contractId + '/attachment-inbox/approve', { path: row.path });
    ElMessage.success(res.message || '已通过');
    await loadAll();
    emit('changed');
  } catch (err: any) {
    if (err?.response?.data?.message) ElMessage.error(err.response.data.message);
  }
}

async function approveAllInbox() {
  try {
    await ElMessageBox.confirm('通过全部 ' + inbox.value.length + ' 个待审核附件？通过后即成为正式合同附件。', '确认', { type: 'warning' });
  } catch { return; }
  try {
    const res: any = await request.post('/contracts/' + props.contractId + '/attachment-inbox/approve', { paths: inbox.value.map((i) => i.path) });
    ElMessage.success(res.message || '已全部通过');
    await loadAll();
    emit('changed');
  } catch (err: any) {
    if (err?.response?.data?.message) ElMessage.error(err.response.data.message);
  }
}

async function rejectInbox(row: any) {
  try {
    await ElMessageBox.confirm('驳回「' + (row.title || row.name) + '」？该文件会被删除。', '确认驳回', { type: 'warning' });
  } catch { return; }
  try {
    const res: any = await request.post('/contracts/' + props.contractId + '/attachment-inbox/reject', { path: row.path });
    ElMessage.success(res.message || '已驳回');
    await loadAll();
  } catch (err: any) {
    if (err?.response?.data?.message) ElMessage.error(err.response.data.message);
  }
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

// ===== 电子签回传归档（⑫）：签署完成的 PDF 拉回来作为附件；未启用电子签时明确提示 =====
async function pullESign() {
  try {
    const res: any = await request.post('/contracts/' + props.contractId + '/esign/pull-signed', {});
    ElMessage.success(res.message || '已回传签署文件');
    await loadAll();
    emit('changed');
  } catch (err: any) {
    ElMessage.warning(err?.response?.data?.message || '回传失败');
  }
}

// ===== 扫描仪直传（⑦：接 Windows WIA，扫描件直接入册）=====
async function scanNow() {
  try {
    const probe: any = await request.get('/contracts/' + props.contractId + '/scan-devices');
    if (!probe.data?.available) {
      ElMessage.warning(probe.message || '未检测到扫描仪，可改用「拍照上传」或「上传文件」');
      return;
    }
    try {
      await ElMessageBox.confirm('检测到扫描仪：' + (probe.data.devices || []).join('、') + '。请把纸张放入扫描仪后点「确定」开始扫描。', '扫描仪扫描', { type: 'info', confirmButtonText: '开始扫描' });
    } catch { return; }
    const res: any = await request.post('/contracts/' + props.contractId + '/scan', { title: '扫描件' });
    ElMessage.success(res.message || '已扫描并加入附件');
    await loadAll();
    emit('changed');
  } catch (err: any) {
    if (err?.response?.data?.message) ElMessage.error(err.response.data.message);
  }
}

// ===== 引用已有资料（④ 引用型附件）=====
const refVisible = ref(false);
const refs = ref<any[]>([]);

async function openRefs() {
  refVisible.value = true;
  try {
    const r: any = await request.get('/contracts/' + props.contractId + '/ref-candidates');
    refs.value = r.data?.list || [];
  } catch { refs.value = []; }
}

async function attachRef(row: any) {
  try {
    const res: any = await request.post('/contracts/' + props.contractId + '/files/attach-ref', { kind: row.kind, refId: row.refId, title: row.title });
    ElMessage.success(res.message || '已引用');
    refVisible.value = false;
    await loadAll();
    emit('changed');
  } catch (err: any) {
    if (err?.response?.data?.message) ElMessage.error(err.response.data.message);
  }
}

// 附件分组与排序（用户 2026-10-16 第 ⑪ 项）：分组后打印的「附件目录」会按分组列出；顺序即打印时的附件1/2/3
async function setGroup(row: any, group: string) {
  try {
    const res: any = await request.put('/contracts/' + props.contractId + '/files/group', { path: row.path, group: group || '' });
    ElMessage.success(res.message || '附件分组已保存');
    await loadAll();
    emit('changed');
  } catch (err: any) {
    if (err?.response?.data?.message) ElMessage.error(err.response.data.message);
  }
}

async function moveAttachment(row: any, delta: number) {
  const list = [...attachments.value];
  const i = list.findIndex((a) => a.path === row.path);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  try {
    await request.put('/contracts/' + props.contractId + '/files/order', { paths: list.map((a) => a.path) });
    await loadAll();
    emit('changed');
  } catch (err: any) {
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

// ===== 拍照直传（⑦）=====
const camVisible = ref(false);
const camVideo = ref<HTMLVideoElement | null>(null);
let camStream: MediaStream | null = null;

async function openCamera() {
  camVisible.value = true;
  try {
    camStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
    await nextTick();
    if (camVideo.value) { camVideo.value.srcObject = camStream; await camVideo.value.play(); }
  } catch (err: any) {
    ElMessage.warning('无法打开摄像头（' + String(err?.name || '未知原因') + '）：可改用「上传文件」选择手机/相机拍好的照片');
    closeCamera();
  }
}

function closeCamera() {
  camStream?.getTracks().forEach((t) => t.stop());
  camStream = null;
  camVisible.value = false;
}

async function shoot() {
  const v = camVideo.value;
  if (!v) return;
  const canvas = document.createElement('canvas');
  canvas.width = v.videoWidth || 1280;
  canvas.height = v.videoHeight || 720;
  canvas.getContext('2d')?.drawImage(v, 0, 0, canvas.width, canvas.height);
  const blob: Blob | null = await new Promise((resolve) => canvas.toBlob((bl) => resolve(bl), 'image/jpeg', 0.9));
  if (!blob) { ElMessage.error('拍照失败，请重试'); return; }
  const file = new File([blob], '现场照片_' + Date.now() + '.jpg', { type: 'image/jpeg' });
  closeCamera();
  await uploadFiles([file], '现场照片');
}

// ===== 手机上传（⑧）=====
const phoneVisible = ref(false);
const phoneUrl = ref('');
const phoneMinutes = ref(30);
const phoneLoading = ref(false);
const phoneMode = ref<'direct' | 'review'>('direct');

async function openPhoneUpload(mode: 'direct' | 'review' = 'direct') {
  phoneVisible.value = true;
  phoneLoading.value = true;
  phoneMode.value = mode;
  try {
    const r: any = await request.post('/contracts/' + props.contractId + '/upload-session', { minutes: 30, mode });
    phoneUrl.value = r.data?.url || '';
    phoneMinutes.value = Number(r.data?.minutes || 30);
  } catch { phoneVisible.value = false; } finally { phoneLoading.value = false; }
}

function copyPhoneUrl() {
  navigator.clipboard?.writeText(phoneUrl.value).then(() => ElMessage.success('已复制链接'), () => ElMessage.info(phoneUrl.value));
}

async function refreshAfterPhone() {
  await loadAll();
  ElMessage.success('附件列表已刷新');
}

const placeholders = ref<{ key: string; label: string }[]>([]);
const editing = ref<any>(null);
const tplSaving = ref(false);

function loadDraft() {
  const tpl = genTemplates.value.find((t) => t.id === genTemplateId.value);
  editing.value = tpl ? cloneTemplate(tpl) : null;
  void refreshGen();
}

function newTemplate() {
  const base = cloneTemplate({ name: '', docTitle: '', category: '自定义', scope: '全部' });
  base.id = 0;
  base.isBuiltIn = 0;
  base.signatures = [{ label: '甲方', name: '$' + '{companySigner}' }, { label: '乙方', name: '$' + '{tenantName}' }];
  editing.value = base;
  void refreshGen();
}

function duplicateTemplate() {
  if (!editing.value) return;
  const copy = cloneTemplate(editing.value);
  copy.id = 0;
  copy.isBuiltIn = 0;
  copy.category = '自定义';
  copy.name = duplicateName(copy.name, genTemplates.value.map((t) => t.name));
  editing.value = copy;
}

async function saveTemplate() {
  if (!editing.value) return;
  const payload = editing.value;
  if (!String(payload.name || '').trim()) { ElMessage.warning('请填写模板名称'); return; }
  tplSaving.value = true;
  try {
    const res: any = payload.id
      ? await request.put('/attachment-templates/' + payload.id, payload)
      : await request.post('/attachment-templates', payload);
    ElMessage.success(res.message || '模板已保存');
    const r: any = await request.get('/attachment-templates');
    genTemplates.value = r.data?.list || [];
    placeholders.value = r.data?.placeholders || placeholders.value;
    genTemplateId.value = res.data?.id || payload.id || genTemplateId.value;
    loadDraft();
  } catch (err: any) {
    if (err?.response?.data?.message) ElMessage.error(err.response.data.message);
  } finally { tplSaving.value = false; }
}

async function removeTemplate() {
  if (!editing.value?.id) return;
  try {
    await ElMessageBox.confirm('删除模板「' + editing.value.name + '」？已经生成过的附件不受影响。', '确认删除', { type: 'warning' });
  } catch { return; }
  try {
    await request.delete('/attachment-templates/' + editing.value.id);
    ElMessage.success('模板已删除');
    const r: any = await request.get('/attachment-templates');
    genTemplates.value = r.data?.list || [];
    genTemplateId.value = genTemplates.value[0]?.id || null;
    loadDraft();
  } catch (err: any) {
    if (err?.response?.data?.message) ElMessage.error(err.response.data.message);
  }
}

function copyPlaceholder(key: string) {
  const text = '$' + '{' + key + '}';
  navigator.clipboard?.writeText(text).then(() => ElMessage.success('已复制 ' + text), () => ElMessage.info(text));
}

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
  placeholders.value = r.data?.placeholders || [];
  if (!genTemplateId.value && genTemplates.value.length) genTemplateId.value = genTemplates.value[0].id;
  loadDraft();
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
  // 预览优先用「正在编辑的草稿」，改一处立刻能看到效果；「生成并作为附件」使用已保存的模板
  const tpl = editing.value || genTemplates.value.find((t) => t.id === genTemplateId.value);
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

watch(genTemplateId, () => { if (genVisible.value) loadDraft(); });

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
