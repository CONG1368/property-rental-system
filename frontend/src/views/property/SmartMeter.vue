<template>
  <div class="smart-meter">
    <div class="page-head">
      <h2 class="page-title">智能水电表</h2>
      <div class="head-actions">
        <el-tag :type="tokenExpired ? 'danger' : 'success'" size="small">
          {{ tokenCaptured ? (tokenExpired ? '会话已过期' : '已捕获会话') : '未登录平台' }}
        </el-tag>
        <el-button type="primary" :loading="syncing" @click="loginAndSync">
          {{ tokenCaptured ? '重新登录并同步' : '登录并同步' }}
        </el-button>
        <el-button v-if="timerActive" @click="stopSync">停止同步</el-button>
        <el-button @click="openPlatformConfig">平台设置</el-button>
      </div>
    </div>

    <!-- 平台设置 -->
    <el-dialog title="智能水电表平台设置" v-model="cfgVisible" width="560px">
      <el-form label-width="120px">
        <el-form-item label="平台地址" required><el-input v-model="cfgForm.url" placeholder="https://bzp.iyunmu.com/prepaidBack" /></el-form-item>
        <el-form-item label="登录账号"><el-input v-model="cfgForm.username" placeholder="平台登录账号（token 由桌面版从同机会话获取）" /></el-form-item>
        <el-form-item label="同步间隔(分)"><el-input-number v-model="cfgForm.intervalMin" :min="1" :max="60" /></el-form-item>
        <el-divider content-position="left">高级（一般无需修改）</el-divider>
        <el-form-item label="接口路径(JSON)"><el-input v-model="cfgForm.endpoints" type="textarea" :rows="3" placeholder='{"devices":"/web/device/",...}' /></el-form-item>
        <el-form-item label="分页参数(JSON)"><el-input v-model="cfgForm.pagination" type="textarea" :rows="2" placeholder='{"pageParam":"page",...}' /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="cfgVisible=false">取消</el-button>
        <el-button type="primary" :loading="cfgSaving" @click="savePlatformConfig">保存</el-button>
      </template>
    </el-dialog>

    <el-alert v-if="lastSyncAt" type="info" :closable="false" style="margin-bottom:12px">
      上次同步：{{ lastSyncAt }} ｜ 窗口内每 {{ intervalMin }} 分钟自动补一次 ｜ 会话有效至 {{ tokenExpStr }}
    </el-alert>
    <el-alert v-if="errorMsg" type="error" :closable="true" @close="errorMsg=''" style="margin-bottom:12px">{{ errorMsg }}</el-alert>

    <el-row :gutter="12" class="kpi-row">
      <el-col :span="6"><div class="kpi"><div class="kpi-v">{{ overview.devices }}</div><div class="kpi-l">设备数</div></div></el-col>
      <el-col :span="6"><div class="kpi"><div class="kpi-v">¥{{ overview.totalBalance }}</div><div class="kpi-l">总余额</div></div></el-col>
      <el-col :span="6"><div class="kpi"><div class="kpi-v">¥{{ overview.rechargesToday }}</div><div class="kpi-l">今日充值</div></div></el-col>
      <el-col :span="6"><div class="kpi"><div class="kpi-v">{{ overview.onlineRate }}%</div><div class="kpi-l">在线设备率</div></div></el-col>
    </el-row>

    <el-tabs v-model="tab" @tab-change="onTab">
      <el-tab-pane label="设备台账" name="devices">
        <el-tooltip content="仅桌面版可登录平台同步；浏览器开发模式请手动取 token 后到系统参数配置" placement="top">
          <el-button size="small" @click="loadDevices" style="margin-bottom:8px">刷新</el-button>
        </el-tooltip>
        <DataTable :data="devices" :columns="COLUMNS" row-key="id" v-model:page="devicePage" :total="deviceTotal" :page-size="20" @page-change="loadDevices">
          <template #c4="{ row }"><el-tag size="small">{{ row.meterType }}</el-tag></template>
          <template #c8="{ row }"><el-tag v-if="row.linkStatus === 'linked'" size="small" type="success">已关联</el-tag>
                      <el-button v-else size="small" text type="primary" @click="openLink(row)">关联</el-button></template>
        </DataTable>
      </el-tab-pane>

      <el-tab-pane label="租币/租户余额" name="tenants">
        <DataTable :data="tenants" :columns="COLUMNS_2" row-key="id">
        </DataTable>
      </el-tab-pane>

      <el-tab-pane label="充值记录" name="recharges">
        <DataTable :data="recharges" :columns="COLUMNS_3" row-key="id">
        </DataTable>
      </el-tab-pane>

      <el-tab-pane label="统计分析" name="stats">
        <el-row :gutter="12">
          <el-col :span="12">
            <h4>近 30 天充值趋势</h4>
            <DataTable :data="stat.rechargeTrend || []" :columns="COLUMNS_4" row-key="id">
            </DataTable>
          </el-col>
          <el-col :span="6">
            <h4>设备类型分布</h4>
            <div v-for="(v,k) in stat.deviceByType" :key="k" style="margin:4px 0"><el-tag size="small">{{k}}：{{v}}</el-tag></div>
            <h4 style="margin-top:12px">余额 Top10</h4>
            <div v-for="t in (stat.topBalance||[])" :key="t.name" style="font-size:12px;margin:2px 0">{{t.name}}：¥{{t.balance}}</div>
          </el-col>
          <el-col :span="6"><h4>今日充值</h4><div style="font-size:26px;color:var(--brand-600)">¥{{ stat.todayRecharge }}</div></el-col>
        </el-row>
      </el-tab-pane>

      <el-tab-pane label="待关联" name="pending">
        <DataTable :data="pending" :columns="COLUMNS_5" row-key="id">
          <template #c3="{ row }"><el-button size="small" text type="primary" @click="openLink(row)">关联到仪表</el-button></template>
        </DataTable>
      </el-tab-pane>
    </el-tabs>

    <el-dialog v-model="linkVisible" title="关联平台设备到系统仪表" width="480px">
      <el-form label-width="90px">
        <el-form-item label="平台表号"><el-input :model-value="linkTarget?.meterNo" disabled /></el-form-item>
        <el-form-item label="系统仪表">
          <el-select v-model="linkMeterId" filterable placeholder="按表号选择系统仪表" style="width:100%">
            <el-option v-for="m in meterOptions" :key="m.id" :label="m.meterNo + '（' + m.type + '）'" :value="m.id" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer><el-button @click="linkVisible=false">取消</el-button><el-button type="primary" :loading="linking" @click="doLink">保存</el-button></template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import DataTable from '@/components/base/DataTable.vue';
import type { TableColumn } from '@/components/base/types';

const COLUMNS_5: TableColumn[] = [
  { prop: 'meterNo', label: '平台表号', minWidth: 140 },
  { prop: 'platformDeviceId', label: '平台设备ID', minWidth: 140 },
  { label: '操作', width: 120, slot: 'c3' },
];

const COLUMNS_4: TableColumn[] = [
  { prop: 'date', label: '日期', width: 120 },
  { prop: 'amount', label: '金额(¥)' },
];

const COLUMNS_3: TableColumn[] = [
  { prop: 'orderNo', label: '单号', minWidth: 140 },
  { prop: 'tenantName', label: '租户', minWidth: 110 },
  { prop: 'tenantPhone', label: '电话', minWidth: 120 },
  { prop: 'amount', label: '金额', width: 100 },
  { prop: 'channel', label: '方式', width: 90 },
  { prop: 'rechargeTime', label: '时间', minWidth: 150 },
  { prop: 'status', label: '状态', width: 90 },
];

const COLUMNS_2: TableColumn[] = [
  { prop: 'name', label: '姓名', minWidth: 120 },
  { prop: 'phone', label: '电话', minWidth: 120 },
  { prop: 'balance', label: '余额', width: 120 },
  { prop: 'deviceCount', label: '绑定设备数', width: 100 },
  { prop: 'status', label: '状态', width: 100 },
];

const COLUMNS: TableColumn[] = [
  { prop: 'meterNo', label: '表号', minWidth: 110 },
  { prop: 'name', label: '名称', minWidth: 130 },
  { prop: 'area', label: '区域', minWidth: 110 },
  { prop: 'meterType', label: '类型', width: 70, slot: 'c4' },
  { prop: 'currentReading', label: '当前读数', width: 100 },
  { prop: 'totalUsage', label: '累计用量', width: 100 },
  { prop: 'status', label: '状态', width: 90 },
  { label: '关联', width: 110, slot: 'c8' },
];

import { ref, onMounted, onUnmounted } from 'vue';
import request from '@/api/request';
import { ElMessage } from 'element-plus';
import { confirmWithPassword } from '@/utils/confirm-password';

const tab = ref('devices');
const syncing = ref(false);
const errorMsg = ref('');
const intervalMin = ref(10);
const lastSyncAt = ref('');
const tokenCaptured = ref(false);
const tokenExpired = ref(false);
const tokenExpStr = ref('');
const timerActive = ref(false);
const overview = ref({ devices: 0, totalBalance: 0, rechargesToday: 0, onlineRate: 0 });
const devices = ref<any[]>([]);
const deviceTotal = ref(0);
const devicePage = ref(1);
const tenants = ref<any[]>([]);
const recharges = ref<any[]>([]);
const stat = ref<any>({});
const pending = ref<any[]>([]);
const linkVisible = ref(false);
const linkTarget = ref<any>(null);
const linkMeterId = ref<number | null>(null);
const meterOptions = ref<any[]>([]);
const linking = ref(false);

async function refreshStatus() {
  try {
    const res: any = await request.get('/smart-meter/status');
    lastSyncAt.value = res?.data?.lastSyncAt ? String(res.data.lastSyncAt).replace('T', ' ').slice(0, 19) : '';
    intervalMin.value = res?.data?.intervalMin ?? 10;
  } catch { /* silent */ }
  if ((window as any).electronAPI?.getMeterTokenStatus) {
    const s: any = await (window as any).electronAPI.getMeterTokenStatus();
    tokenCaptured.value = !!s?.captured;
    tokenExpired.value = !!s?.expired;
    tokenExpStr.value = s?.tokenExpSec ? new Date(s.tokenExpSec * 1000).toLocaleString('zh-CN') : '';
  }
}

async function loadOverview() {
  const res: any = await request.get('/smart-meter/overview');
  overview.value = res?.data || overview.value;
}
async function loadDevices() {
  const res: any = await request.get('/smart-meter/devices', { params: { page: devicePage.value, pageSize: 20 } });
  devices.value = res?.data?.list || [];
  deviceTotal.value = res?.data?.total || 0;
}
async function loadTenants() { const res: any = await request.get('/smart-meter/tenants', { params: { pageSize: 50 } }); tenants.value = res?.data?.list || []; }
async function loadRecharges() { const res: any = await request.get('/smart-meter/recharges', { params: { pageSize: 50 } }); recharges.value = res?.data?.list || []; }
async function loadStats() { const res: any = await request.get('/smart-meter/statistics'); stat.value = res?.data || {}; }
async function loadPending() { const res: any = await request.get('/smart-meter/pending'); pending.value = res?.data || []; }
async function loadMeterOptions() {
  const res: any = await request.get('/meters', { params: { pageSize: 100 } });
  meterOptions.value = res?.data?.list || [];
}

function onTab() {
  if (tab.value === 'devices') loadDevices();
  else if (tab.value === 'tenants') loadTenants();
  else if (tab.value === 'recharges') loadRecharges();
  else if (tab.value === 'stats') loadStats();
  else if (tab.value === 'pending') loadPending();
}

// ---- 平台设置（方案2：水电表配置迁移到业务页）----
const cfgVisible = ref(false);
const cfgSaving = ref(false);
const cfgForm = ref<any>({ url: '', username: '', intervalMin: 10, endpoints: '', pagination: '' });

async function openPlatformConfig() {
  try {
    const res: any = await request.get('/smart-meter/platform-config');
    const d = res?.data || {};
    cfgForm.value = {
      url: d.url || '',
      username: d.username || '',
      intervalMin: d.intervalMin || 10,
      endpoints: d.endpoints || '',
      pagination: d.pagination || '',
    };
    cfgVisible.value = true;
  } catch (e: any) { ElMessage.error(e?.response?.data?.message || '读取平台配置失败'); }
}

async function savePlatformConfig() {
  if (!cfgForm.value.url) { ElMessage.error('平台地址不能为空'); return; }
  cfgSaving.value = true;
  try {
    const pwd = await confirmWithPassword('保存水电表平台配置需重新输入登录密码确认', '二次确认');
    if (!pwd) return;
    await request.put('/smart-meter/platform-config', { ...cfgForm.value, confirmPassword: pwd });
    ElMessage.success('平台配置已保存');
    cfgVisible.value = false;
    refreshStatus();
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || '保存失败（仅管理员可操作）');
  } finally { cfgSaving.value = false; }
}

async function loginAndSync() {
  timerActive.value = true;
  if ((window as any).electronAPI?.openPlatformLogin) {
    const sysToken = localStorage.getItem('accessToken') || '';
    const r: any = await (window as any).electronAPI.openPlatformLogin(sysToken);
    if (r?.status === 'already-open') ElMessage.info('平台登录窗口已打开'); 
  } else {
    ElMessage.warning('当前为浏览器开发模式：请在系统参数配置 meter_platform_token 后手动触发同步（桌面版可自动登录捕获 token）');
    timerActive.value = false;
    return;
  }
}

async function stopSync() {
  timerActive.value = false;
  if ((window as any).electronAPI?.stopMeterSync) await (window as any).electronAPI.stopMeterSync();
  ElMessage.success('已停止窗口内同步');
}

async function openLink(row: any) {
  linkTarget.value = row;
  linkMeterId.value = null;
  await loadMeterOptions();
  linkVisible.value = true;
}
async function doLink() {
  if (!linkTarget.value?.platformDeviceId || !linkMeterId.value) { ElMessage.warning('请选择系统仪表'); return; }
  linking.value = true;
  try {
    await request.post('/smart-meter/link', { platformDeviceId: linkTarget.value.platformDeviceId, meterId: linkMeterId.value });
    ElMessage.success('已关联');
    linkVisible.value = false;
    loadDevices(); loadPending();
  } catch (e: any) { ElMessage.error(e?.response?.data?.message || '关联失败'); }
  finally { linking.value = false; }
}

// 监听桌面版事件（token 捕获/同步结果/失效）
let unSub: any = null;
function setupListener() {
  if ((window as any).electronAPI?.onSmartMeterEvent) {
    unSub = (window as any).electronAPI.onSmartMeterEvent((p: any) => {
      if (p?.event === 'token-invalid') { errorMsg.value = p?.message || '平台会话已失效，请重新登录'; timerActive.value = false; }
      if (p?.event === 'synced') { ElMessage.success('同步完成'); refreshStatus(); loadOverview(); onTab(); }
      if (p?.event === 'token-captured') { ElMessage.success('已捕获平台会话，开始同步'); refreshStatus(); loadOverview(); onTab(); }
    });
  }
}

onMounted(() => { refreshStatus(); loadOverview(); loadDevices(); setupListener(); });
onUnmounted(() => { if (unSub) unSub(); });
</script>

<style scoped>
.smart-meter { padding: 4px; }
.page-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.head-actions { display: flex; gap: 8px; align-items: center; }
.kpi-row { margin-bottom: 12px; }
.kpi { background: $n-0; border: 1px solid $n-100; border-radius: 10px; padding: 14px 16px; }
.kpi-v { font-size: 24px; font-weight: 700; color: $n-900; }
.kpi-l { font-size: 12px; color: $n-400; }
</style>