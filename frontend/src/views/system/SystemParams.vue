<template>
  <div class="system-params">
    <div class="toolbar">
      <h2 class="page-title">系统参数中心</h2>
      <el-button type="primary" @click="openCreate">新增配置项</el-button>
      <el-button @click="fetchData" :loading="loading">刷新</el-button>
      <el-switch v-model="hideTech" active-text="隐藏内置技术键" inactive-text="显示全部" style="margin-left:12px" />
      <span style="font-size:12px;color:var(--n-600)">本页仅面向开发/运维对接；业务配置请到各业务页（读卡器/水电表/打印/系统运维）操作</span>
    </div>

    <el-row :gutter="16">
      <el-col :span="6">
        <el-card header="分组筛选">
          <div
            v-for="g in groups"
            :key="g"
            class="group-item"
            :class="{ active: groupFilter === g }"
            @click="groupFilter = g; fetchData()"
          >
            {{ g }} <el-tag size="small" type="info">{{ groupCount(g) }}</el-tag>
          </div>
          <div class="group-item" :class="{ active: groupFilter === '' }" @click="groupFilter = ''; fetchData()">全部</div>
        </el-card>
      </el-col>

      <el-col :span="18">
        <DataTable :data="filteredList" :loading="loading" :columns="COLUMNS" row-key="id" v-model:page="page" :total="total" :page-size="pageSize" @page-change="fetchData" empty-title="暂无数据" empty-description="调整筛选条件或新增记录后，数据会显示在这里">
          <template #c2="{ row }"><span v-if="row.isSensitive && row.configValue" class="sensitive">••••••（敏感值）</span>
                      <span v-else-if="row.valueType === 'boolean'">{{ (row.configValue === '1' || row.configValue === 'true' || row.configValue === '是') ? '是' : '否' }}</span>
                      <span v-else>{{ row.configValue }}</span></template>
          <template #c6="{ row }"><el-tag :type="row.builtIn ? 'warning' : 'info'" size="small">{{ row.builtIn ? '是' : '否' }}</el-tag></template>
          <template #c7="{ row }"><el-button size="small" @click="openEdit(row)">编辑</el-button>
                      <el-popconfirm title="确定删除该配置项？" @confirm="handleDelete(row)">
                        <template #reference><el-button size="small" type="danger" :disabled="row.builtIn">删除</el-button></template>
                      </el-popconfirm></template>
        </DataTable>
      </el-col>
    </el-row>

    <!-- 新增/编辑配置项 -->
    <el-dialog :title="editing ? '编辑配置项' : '新增配置项'" v-model="dialogVisible" width="520px">
      <el-form label-width="100px">
        <el-form-item label="键名" required><el-input v-model="form.configKey" :disabled="!!editing" /></el-form-item>
        <el-form-item label="键值">
          <el-switch v-if="form.valueType === 'boolean'" v-model="form.boolValue" active-text="开" inactive-text="关" />
          <el-input v-else v-model="form.configValue" type="textarea" :rows="3" />
        </el-form-item>
        <el-form-item label="分组">
          <el-select v-model="form.configGroup" style="width:100%">
            <el-option v-for="g in groups" :key="g" :label="g" :value="g" />
          </el-select>
        </el-form-item>
        <el-form-item label="值类型">
          <el-select v-model="form.valueType" style="width:100%">
            <el-option label="字符串" value="string" /><el-option label="数字" value="number" />
            <el-option label="布尔" value="boolean" /><el-option label="JSON" value="json" />
          </el-select>
        </el-form-item>
        <el-form-item label="敏感值"><el-switch v-model="form.isSensitive" /></el-form-item>
        <el-form-item label="描述"><el-input v-model="form.description" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import DataTable from '@/components/base/DataTable.vue';
import type { TableColumn } from '@/components/base/types';

const COLUMNS: TableColumn[] = [
  { prop: 'configKey', label: '键名', width: 220 },
  { label: '键值', minWidth: 220, slot: 'c2' },
  { prop: 'configGroup', label: '分组', width: 110 },
  { prop: 'valueType', label: '类型', width: 90 },
  { prop: 'description', label: '描述', minWidth: 140 },
  { label: '内置', width: 70, slot: 'c6' },
  { label: '操作', width: 150, fixed: 'right', slot: 'c7' },
];

import { ref, onMounted, computed } from 'vue';
import { ElMessage } from 'element-plus';
import { confirmWithPassword } from '@/utils/confirm-password';
import request from '@/api/request';

const list = ref<any[]>([]);
const loading = ref(false);
const saving = ref(false);
const page = ref(1);
const pageSize = ref(200);
const total = ref(0);
const groupFilter = ref('');

const dialogVisible = ref(false);
const editing = ref(false);
const form = ref<any>({ configKey: '', configValue: '', configGroup: '其他', valueType: 'string', isSensitive: false, description: '', boolValue: true });
function isTrue(v: any) { const s = String(v ?? '').trim().toLowerCase(); return s === '1' || s === 'true' || s === 'yes' || s === 'on' || s === '是'; }

// 内置/技术键：已迁移到各业务页（读卡器/水电表/打印/系统运维）的配置，普通用户不应在此手改
const hideTech = ref(true);
const TECH_KEY_PREFIXES = ['id_card_', 'meter_platform_', 'smtp_', 'sms_', 'wechat_', 'redis_', 'demo_'];
const TECH_KEYS = ['audit_enabled', 'demo_enabled', 'demo_seeded', 'company_name_for_print'];
function isTechKey(key: string) {
  const k = String(key || '');
  if (TECH_KEYS.includes(k)) return true;
  return TECH_KEY_PREFIXES.some((p) => k.startsWith(p));
}

// 先应用 hideTech（隐藏内置技术键），再做分组筛选
const visibleList = computed(() => {
  if (!hideTech.value) return list.value;
  return list.value.filter((i) => !(i.builtIn && isTechKey(i.configKey)));
});

const filteredList = computed(() => {
  if (!groupFilter.value) return visibleList.value;
  return visibleList.value.filter((i) => (i.configGroup || '其他') === groupFilter.value);
});

const groups = computed(() => {
  const set = new Set<string>(visibleList.value.map((i) => i.configGroup || '其他'));
  return Array.from(set);
});

function groupCount(g: string) {
  return visibleList.value.filter((i) => (i.configGroup || '其他') === g).length;
}

async function fetchData() {
  loading.value = true;
  try {
    const res = await request.get('/system-configs', { params: { page: page.value, pageSize: pageSize.value } });
    list.value = res.data?.list || [];
    total.value = visibleList.value.length;
  } catch { /* silent */ } finally { loading.value = false; }
}

function openCreate() {
  editing.value = false;
  form.value = { configKey: '', configValue: '', configGroup: groupFilter.value || '其他', valueType: 'string', isSensitive: false, description: '', boolValue: true };
  dialogVisible.value = true;
}

function openEdit(row: any) {
  editing.value = true;
  form.value = { ...row, isSensitive: !!row.isSensitive, boolValue: isTrue(row.configValue) };
  dialogVisible.value = true;
}

async function handleSave() {
  if (!form.value.configKey) { ElMessage.error('键名不能为空'); return; }
  saving.value = true;
  try {
    const pwd = await confirmWithPassword(editing.value ? '保存系统配置需重新输入登录密码确认' : '新增系统配置需重新输入登录密码确认', '二次确认');
    if (!pwd) return;
    if (editing.value) {
      const cv = form.value.valueType === 'boolean' ? (form.value.boolValue ? '1' : '0') : form.value.configValue;
      await request.put('/system-configs/' + form.value.configKey, { configValue: cv, description: form.value.description, confirmPassword: pwd });
    } else {
      const cv = form.value.valueType === 'boolean' ? (form.value.boolValue ? '1' : '0') : form.value.configValue;
      await request.post('/system-configs', { ...form.value, configValue: cv, confirmPassword: pwd });
    }
    ElMessage.success('已保存');
    dialogVisible.value = false;
    fetchData();
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.message || '保存失败');
  } finally { saving.value = false; }
}

async function handleDelete(row: any) {
  try {
    const pwd = await confirmWithPassword('删除配置项需重新输入登录密码确认', '二次确认');
    if (!pwd) return;
    await request.delete('/system-configs/' + row.configKey, { data: { confirmPassword: pwd } });
    ElMessage.success('已删除');
    fetchData();
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.message || '删除失败');
  }
}

onMounted(fetchData);
</script>

<style lang="scss" scoped>
.toolbar { display:flex; align-items:center; gap:12px; margin-bottom:16px; }
.page-title { font-size:18px; font-weight:700; color:$n-900; margin:0; }
.group-item {
  padding:10px 12px; border-radius:6px; cursor:pointer; margin-bottom:6px;
  display:flex; justify-content:space-between; align-items:center;
  font-size:14px; color:$n-900; transition: all .15s;
  &:hover { background:$n-50; }
  &.active { background:$brand-600; color:$n-0; }
}
.sensitive { font-family: monospace; color:$n-600; letter-spacing:2px; }
</style>
