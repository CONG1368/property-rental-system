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
      </div>
    </div>

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
        <el-table :data="devices" size="small" stripe>
          <el-table-column prop="meterNo" label="表号" min-width="110" />
          <el-table-column prop="name" label="名称" min-width="130" />
          <el-table-column prop="area" label="区域" min-width="110" />
          <el-table-column prop="meterType" label="类型" width="70"><template #default="{row}"><el-tag size="small">{{ row.meterType }}</el-tag></template></el-table-column>
          <el-table-column prop="currentReading" label="当前读数" width="100" />
          <el-table-column prop="totalUsage" label="累计用量" width="100" />
          <el-table-column prop="status" label="状态" width="90" />
          <el-table-column label="关联" width="110">
            <template #default="{row}">
              <el-tag v-if="row.linkStatus === 'linked'" size="small" type="success">已关联</el-tag>
              <el-button v-else size="small" text type="primary" @click="openLink(row)">关联</el-button>
            </template>
          </el-table-column>
        </el-table>
        <el-pagination v-if="deviceTotal>20" layout="prev, pager, next" :total="deviceTotal" :page-size="20" v-model:current-page="devicePage" @current-change="loadDevices" style="margin-top:8px;justify-content:center" />
      </el-tab-pane>

      <el-tab-pane label="租币/租户余额" name="tenants">
        <el-table :data="tenants" size="small" stripe>
          <el-table-column prop="name" label="姓名" min-width="120" />
          <el-table-column prop="phone" label="电话" min-width="120" />
          <el-table-column prop="balance" label="余额" width="120" />
          <el-table-column prop="deviceCount" label="绑定设备数" width="100" />
          <el-table-column prop="status" label="状态" width="100" />
        </el-table>
      </el-tab-pane>

      <el-tab-pane label="充值记录" name="recharges">
        <el-table :data="recharges" size="small" stripe>
          <el-table-column prop="orderNo" label="单号" min-width="140" />
          <el-table-column prop="tenantName" label="租户" min-width="110" />
          <el-table-column prop="tenantPhone" label="电话" min-width="120" />
          <el-table-column prop="amount" label="金额" width="100" />
          <el-table-column prop="channel" label="方式" width="90" />
          <el-table-column prop="rechargeTime" label="时间" min-width="150" />
          <el-table-column prop="status" label="状态" width="90" />
        </el-table>
      </el-tab-pane>

      <el-tab-pane label="统计分析" name="stats">
        <el-row :gutter="12">
          <el-col :span="12">
            <h4>近 30 天充值趋势</h4>
            <el-table :data="stat.rechargeTrend || []" size="small" max-height="360">
              <el-table-column prop="date" label="日期" width="120" />
              <el-table-column prop="amount" label="金额(¥)" />
            </el-table>
          </el-col>
          <el-col :span="6">
            <h4>设备类型分布</h4>
            <div v-for="(v,k) in stat.deviceByType" :key="k" style="margin:4px 0"><el-tag size="small">{{k}}：{{v}}</el-tag></div>
            <h4 style="margin-top:12px">余额 Top10</h4>
            <div v-for="t in (stat.topBalance||[])" :key="t.name" style="font-size:12px;margin:2px 0">{{t.name}}：¥{{t.balance}}</div>
          </el-col>
          <el-col :span="6"><h4>今日充值</h4><div style="font-size:26px;color:#4f7cf7">¥{{ stat.todayRecharge }}</div></el-col>
        </el-row>
      </el-tab-pane>

      <el-tab-pane label="待关联" name="pending">
        <el-table :data="pending" size="small" stripe>
          <el-table-column prop="meterNo" label="平台表号" min-width="140" />
          <el-table-column prop="platformDeviceId" label="平台设备ID" min-width="140" />
          <el-table-column label="操作" width="120"><template #default="{row}"><el-button size="small" text type="primary" @click="openLink(row)">关联到仪表</el-button></template></el-table-column>
        </el-table>
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
import { ref, onMounted, onUnmounted } from 'vue';
import request from '@/api/request';
import { ElMessage } from 'element-plus';

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
.kpi { background: #fff; border: 1px solid #e7ecf5; border-radius: 10px; padding: 14px 16px; }
.kpi-v { font-size: 24px; font-weight: 700; color: #1f2430; }
.kpi-l { font-size: 12px; color: #8b93a3; }
</style>