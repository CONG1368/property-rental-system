<template>
  <div class="perm-page">
    <!-- 顶部工具栏：角色（可搜索）+ 模块搜索 + 保存/全部回退 -->
    <div class="toolbar">
      <el-select v-model="role" placeholder="选择角色" style="width:200px" filterable clearable @change="onRoleChange">
        <el-option v-for="r in roles" :key="r" :label="r" :value="r" />
      </el-select>
      <el-input v-model="search" placeholder="搜索模块（名称/编码）" clearable style="width:220px" :prefix-icon="Search" />
      <span class="hint">勾选操作权限，保存后即时生效；「回退默认」清除某模块的定制。</span>
      <div style="flex:1" />
      <el-button type="warning" :disabled="!role" @click="confirmResetAll">全部回退默认</el-button>
      <el-button type="primary" :loading="saving" :disabled="!role" @click="doSave">保存当前角色权限</el-button>
    </div>

    <!-- 批量操作条：多选模块后批量设置/清空/回退 -->
    <div v-if="role" class="batch-bar">
      <el-checkbox-group v-model="batchActions" size="small">
        <el-checkbox v-for="a in actions" :key="a" :value="a">{{ actionLabels[a] }}</el-checkbox>
      </el-checkbox-group>
      <el-radio-group v-model="batchMode" size="small">
        <el-radio-button value="set">设为勾选</el-radio-button>
        <el-radio-button value="clear">设为未勾选</el-radio-button>
      </el-radio-group>
      <el-button size="small" type="primary" plain :disabled="!selected.length" @click="applyBatch">应用到所选模块</el-button>
      <el-button size="small" type="danger" plain :disabled="!selected.length" @click="confirmBatchReset">批量回退所选</el-button>
      <el-button size="small" :disabled="!filteredRows.length" @click="selectAllSearch">全选(匹配当前筛选)</el-button>
      <el-button size="small" :disabled="!selected.length" @click="clearSelection">取消选择</el-button>
      <span class="hint">已选 <b>{{ selected.length }}</b> 个模块</span>
    </div>

    <el-alert v-if="role" type="info" :closable="false" style="margin-bottom:12px">
      角色：<b>{{ role }}</b> — 模块 × 操作（含全局模块 <code>*</code>），共 {{ filteredRows.length }} 个模块
    </el-alert>

    <TableSkeleton v-if="loading && !filteredRows.length" :rows="8" :columns="7" />
    <el-table v-show="!(loading && !filteredRows.length)" ref="tableRef" :data="filteredRows" border v-loading="loading" row-key="module" @selection-change="onSelectionChange">
      <el-table-column type="selection" width="45" />
      <el-table-column prop="module" label="模块" width="180">
        <template #default="{ row }">
          <div class="mod-cell">
            <span>{{ moduleLabels[row.module] || row.module }}</span>
            <code class="mod-key">{{ row.module }}</code>
          </div>
        </template>
      </el-table-column>
      <el-table-column v-for="a in actions" :key="a" :label="actionLabels[a]" width="80" align="center">
        <template #default="{ row }">
          <el-checkbox :model-value="row[a]" :disabled="row.module === '*'" :title="row.module === '*' ? '全局兜底权限不直接编辑，请针对具体模块配置' : ''" @change="(v:any)=>toggle(row, a, v)" />
        </template>
      </el-table-column>
      <el-table-column label="操作" width="120" align="center">
        <template #default="{ row }">
          <el-button size="small" link type="danger" @click="confirmResetModule(row)">回退默认</el-button>
        </template>
      </el-table-column>
          <template #empty>
        <EmptyState title="暂无数据" description="调整筛选条件或新增记录后，数据会显示在这里" />
      </template>
    </el-table>

    <div v-if="!role" class="empty-tip">请先选择一个角色查看/配置权限矩阵。</div>

    <!-- 二次确认弹窗：管理员密码确认 -->
    <el-dialog v-model="confirmVisible" :title="confirmTitle" width="620px" @closed="resetConfirm">
      <div class="confirm-body">
        <el-alert type="warning" :closable="false" show-icon style="margin-bottom:12px">
          该操作将直接修改<b>权限配置</b>，请确认后输入<b>当前管理员密码</b>（二次确认）。
        </el-alert>

        <!-- 保存变更：展示差异清单 -->
        <template v-if="confirmMode === 'save'">
          <div class="diff-summary">共 <b>{{ dirtyModules.length }}</b> 个模块发生权限变更：</div>
          <el-table :data="dirtyModules" size="small" border max-height="260" style="margin-bottom:12px">
            <el-table-column label="模块" min-width="150">
              <template #default="{ row }">
                <span>{{ row.label }}</span>
                <code class="mod-key">{{ row.module }}</code>
              </template>
            </el-table-column>
            <el-table-column label="新增权限" min-width="160">
              <template #default="{ row }">
                <template v-if="row.add.length"><el-tag v-for="a in row.add" :key="a" size="small" type="success" style="margin:1px 3px 0 0">{{ actionLabels[a] }}</el-tag></template>
                <span v-else class="hint">—</span>
              </template>
            </el-table-column>
            <el-table-column label="移除权限" min-width="160">
              <template #default="{ row }">
                <template v-if="row.remove.length"><el-tag v-for="a in row.remove" :key="a" size="small" type="danger" style="margin:1px 3px 0 0">{{ actionLabels[a] }}</el-tag></template>
                <span v-else class="hint">—</span>
              </template>
            </el-table-column>
          </el-table>
        </template>

        <!-- 回退类操作：展示影响模块 -->
        <template v-else>
          <template v-if="confirmTargets.length">
            <div class="diff-summary">影响 <b>{{ confirmTargets.length }}</b> 个模块：{{ confirmTargets.map(t=>t.label).join('、') }}</div>
          </template>
        </template>

        <el-form label-width="120px" @submit.prevent>
          <el-form-item label="管理员密码">
            <el-input v-model="confirmPassword" type="password" placeholder="请输入当前管理员密码" show-password @keyup.enter="doConfirm" />
          </el-form-item>
        </el-form>
      </div>
      <template #footer>
        <el-button @click="confirmVisible = false">取消</el-button>
        <el-button type="primary" :loading="confirmLoading" @click="doConfirm">确认执行</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { Search } from '@element-plus/icons-vue';
import request from '@/api/request';

const roles = ['管理员', '总经理', '收租主管', '收租员', '财务主管', '会计', '出纳', '合同主管', '法务', '物业经理', '维修工', '安全主管'];
const actions = ['create', 'read', 'update', 'delete', 'approve', 'export'];
const actionLabels: Record<string, string> = { create: '新增', read: '查看', update: '修改', delete: '删除', approve: '审批', export: '导出' };
const moduleLabels: Record<string, string> = {
  '*': '全局模块', rent: '租赁管理', property: '房源管理', tenant: '租客管理',
  finance: '财务管理', contract: '合同管理', fire: '消防管理', workorder: '报修工单',
  facility: '设施设备维保', meter: '抄表计费', parking: '停车管理', complaint: '投诉建议',
  resident: '住户档案', announcement: '公告发布', vendor: '外包供应商', inventory: '仓库物料',
  reports: '报表中心', compliance: '法务合规', system: '系统设置',
};

const role = ref('');
const search = ref('');
const matrix = ref<any>({});
const loading = ref(false), saving = ref(false);
const moduleKeys = ref<string[]>([]);
const rows = ref<any[]>([]);

const tableRef = ref<any>(null);
const selected = ref<any[]>([]);

const batchActions = ref<string[]>(['read']);
const batchMode = ref<'set' | 'clear'>('set');

const confirmVisible = ref(false);
const confirmMode = ref<'save' | 'resetModule' | 'batchReset' | 'resetAll'>('save');
const confirmTitle = ref('确认权限变更');
const confirmPassword = ref('');
const confirmLoading = ref(false);
const dirtyModules = ref<any[]>([]);
const confirmTargets = ref<any[]>([]);

const currentPerms = computed(() => matrix.value[role.value] || {});

function effBaseline(m: string): string[] {
  const p = currentPerms.value;
  if (p[m]) return p[m];
  if (p['*']) return p['*'];
  return [];
}

function buildRows() {
  rows.value = moduleKeys.value.map(m => {
    const acts = effBaseline(m);
    const row: any = { name: m, module: m };
    actions.forEach(a => { row[a] = acts.includes(a); });
    return row;
  });
}

const filteredRows = computed(() => {
  const kw = search.value.trim().toLowerCase();
  if (!kw) return rows.value;
  return rows.value.filter(r => {
    const label = moduleLabels[r.module] || '';
    return (r.module || '').toLowerCase().includes(kw) || label.toLowerCase().includes(kw);
  });
});

function onRoleChange() { search.value = ''; selected.value = []; buildRows(); }

async function load() {
  loading.value = true;
  try {
    const r = await request.get('/permissions', { silent: true });
    matrix.value = r.data?.matrix || {};
    const keys = new Set<string>();
    Object.values(matrix.value).forEach((p: any) => Object.keys(p).forEach((k: any) => keys.add(k)));
    ['rent', 'property', 'finance', 'contract', 'fire', 'workorder', 'facility', 'meter', 'parking', 'complaint', 'resident', 'announcement', 'vendor', 'inventory', 'tenant', 'reports', 'compliance', '*'].forEach(k => keys.add(k));
    moduleKeys.value = ['*', ...Array.from(keys).filter(k => k !== '*')];
    if (role.value) buildRows();
  } catch {} finally { loading.value = false; }
}

function onSelectionChange(sel: any[]) { selected.value = sel; }
function clearSelection() { tableRef.value?.clearSelection(); }
function selectAllSearch() {
  filteredRows.value.forEach(row => { tableRef.value?.toggleRowSelection(row, true); });
}

function toggle(row: any, act: string, v: boolean) { row[act] = v; }

function computeDirty() {
  const list: any[] = [];
  rows.value.forEach(row => {
    if (row.module === '*') return;
    const base = effBaseline(row.module);
    const cur = actions.filter((a: any) => row[a]);
    const baseSet = new Set(base);
    const curSet = new Set(cur);
    const add = cur.filter(a => !baseSet.has(a));
    const remove = base.filter(a => !curSet.has(a));
    if (add.length || remove.length) {
      list.push({ module: row.module, label: moduleLabels[row.module] || row.module, add, remove, target: cur });
    }
  });
  return list;
}

function doSave() {
  if (!role.value) return;
  const diff = computeDirty();
  if (!diff.length) { ElMessage.info('当前角色没有权限变更'); return; }
  dirtyModules.value = diff;
  openConfirm('save', '确认保存权限变更');
}

function confirmResetModule(row: any) {
  confirmTargets.value = [{ module: row.module, label: moduleLabels[row.module] || row.module }];
  openConfirm('resetModule', '回退默认权限 — ' + row.module);
}

function confirmBatchReset() {
  if (!selected.value.length) return;
  confirmTargets.value = selected.value.map((s: any) => ({ module: s.module, label: moduleLabels[s.module] || s.module }));
  openConfirm('batchReset', '批量回退默认权限（' + confirmTargets.value.length + ' 个模块）');
}

function confirmResetAll() {
  confirmTargets.value = [];
  openConfirm('resetAll', '全部回退默认权限');
}

function openConfirm(mode: 'save' | 'resetModule' | 'batchReset' | 'resetAll', title: string) {
  confirmMode.value = mode;
  confirmTitle.value = title;
  confirmPassword.value = '';
  confirmVisible.value = true;
}

function resetConfirm() {
  confirmPassword.value = '';
  dirtyModules.value = [];
  confirmTargets.value = [];
  confirmMode.value = 'save';
}

async function doConfirm() {
  if (!confirmPassword.value) { ElMessage.warning('请输入管理员密码以完成二次确认'); return; }
  confirmLoading.value = true;
  try {
    const mode = confirmMode.value;
    const pwd = confirmPassword.value;
    if (mode === 'save') {
      for (const d of dirtyModules.value) {
        await request.put('/permissions', { role: role.value, module: d.module, actions: d.target, confirmPassword: pwd }, { silent: true });
      }
      ElMessage.success('已保存 ' + dirtyModules.value.length + ' 个模块的权限变更');
    } else if (mode === 'resetModule' || mode === 'batchReset') {
      for (const t of confirmTargets.value) {
        await request.delete('/permissions/' + role.value + '/' + t.module, { data: { confirmPassword: pwd }, silent: true });
      }
      ElMessage.success('已回退 ' + confirmTargets.value.length + ' 个模块的默认权限');
    } else if (mode === 'resetAll') {
      await request.post('/permissions/reset', { confirmPassword: pwd }, { silent: true });
      ElMessage.success('已全部回退默认权限');
    }
    await load();
    tableRef.value?.clearSelection();
    confirmVisible.value = false;
  } catch (err: any) {
    const msg = err?.response?.data?.message || '操作失败';
    ElMessage.error(msg);
  } finally { confirmLoading.value = false; }
}

function applyBatch() {
  if (!selected.value.length) { ElMessage.warning('请先选择要批量操作的模块'); return; }
  const actSet = new Set(batchActions.value);
  selected.value.forEach((row: any) => {
    actions.forEach(a => {
      if (actSet.has(a)) row[a] = batchMode.value === 'set';
    });
  });
  ElMessage.success('已对 ' + selected.value.length + ' 个模块批量' + (batchMode.value === 'set' ? '勾选' : '清空'));
}

onMounted(() => load());
</script>

<style lang="scss" scoped>
.perm-page { padding: 0; }
.toolbar { display: flex; gap: 10px; align-items: center; margin-bottom: 14px; flex-wrap: wrap; }
.batch-bar { display: flex; gap: 10px; align-items: center; margin-bottom: 14px; padding: 8px 12px; background: #f7f8fa; border: 1px solid #ebeef5; border-radius: 6px; flex-wrap: wrap; }
.hint { color: #909399; font-size: 12px; }
.mod-cell { display: flex; flex-direction: column; line-height: 1.2; }
.mod-key { color: #909399; font-size: 11px; }
.empty-tip { color: #909399; text-align: center; padding: 48px 0; }
.diff-summary { margin-bottom: 8px; font-size: 13px; color: #303133; }
.confirm-body { padding-top: 4px; }
</style>