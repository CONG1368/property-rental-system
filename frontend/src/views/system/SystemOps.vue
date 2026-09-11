<template>
  <div class="system-ops">
    <div class="page-head">
      <h2 class="page-title">系统运维</h2>
      <el-button size="small" @click="router.push('/system/params')" style="margin-left:12px">技术配置（系统参数）</el-button>
    </div>

    <el-row :gutter="16">
      <el-col :span="12">
        <el-card header="系统信息" v-loading="loadingInfo">
          <el-descriptions :column="1" border size="small" v-if="info">
            <el-descriptions-item label="系统名称">{{ info.appName }}</el-descriptions-item>
            <el-descriptions-item label="版本号">{{ info.version }}</el-descriptions-item>
            <el-descriptions-item label="Node 版本">{{ info.nodeVersion }}</el-descriptions-item>
            <el-descriptions-item label="运行环境">{{ info.platform }}</el-descriptions-item>
            <el-descriptions-item label="启动时长">{{ formatUptime(info.uptimeSeconds) }}</el-descriptions-item>
            <el-descriptions-item label="内存占用">{{ info.memoryMB }} MB</el-descriptions-item>
            <el-descriptions-item label="数据库类型">{{ info.dbDialect }}</el-descriptions-item>
            <el-descriptions-item label="数据库文件">{{ info.dbStorage || '—' }}</el-descriptions-item>
            <el-descriptions-item label="用户数量">{{ info.userCount }}</el-descriptions-item>
            <el-descriptions-item label="Redis">{{ info.redisEnabled ? '启用' : '未启用' }}</el-descriptions-item>
          </el-descriptions>
        </el-card>
      </el-col>

      <el-col :span="12">
        <el-card header="数据维护" v-loading="loadingToggle">
          <div style="margin-bottom:16px">
            <div style="font-weight:600;margin-bottom:8px">审计日志开关</div>
            <div style="display:flex;align-items:center;gap:12px">
              <el-switch v-model="auditEnabled" active-text="开启" inactive-text="关闭" @change="toggleAudit" />
              <span style="font-size:12px;color:var(--n-600)">关闭后系统将不再记录操作审计日志</span>
            </div>
          </div>
          <div style="margin-bottom:16px">
            <div style="font-weight:600;margin-bottom:8px">演示数据开关</div>
            <div style="display:flex;align-items:center;gap:12px">
              <el-switch v-model="demoEnabled" active-text="开启" inactive-text="关闭" @change="toggleDemo" />
              <span style="font-size:12px;color:var(--n-600)">开启=新装/空库时生成演示数据；关闭后不再生成任何演示数据</span>
            </div>
          </div>
          <el-divider />
          <div style="margin-bottom:12px">
            <el-button type="primary" @click="exportBackup">下载数据库备份</el-button>
            <span style="font-size:12px;color:var(--n-600);margin-left:12px">仅支持 SQLite 数据库，含全部业务数据</span>
          </div>
          <el-alert type="warning" :closable="false" show-icon title="备份建议" description="重大变更/发版前请先下载数据库备份，便于回退。电子桌面版数据存储于 %APPDATA%/物业租赁综合管理系统/data/。" />
        </el-card>
      </el-col>
    </el-row>

    <el-card style="margin-top:16px" v-loading="loadingCron">
      <template #header>
        <div style="display:flex;align-items:center;gap:12px">
          <span>定时任务（Cron）</span>
          <el-tag :type="cronStarted ? 'success' : 'danger'" size="small">
            {{ cronStarted ? '调度器运行中' : '调度器已停止' }}
          </el-tag>
          <div style="margin-left:auto">
            <el-button size="small" @click="fetchCron">刷新</el-button>
            <el-button size="small" :type="cronStarted ? 'danger' : 'primary'" @click="toggleCron">
              {{ cronStarted ? '停止调度器' : '启动调度器' }}
            </el-button>
          </div>
        </div>
      </template>
      <DataTable :data="cronList" :columns="COLUMNS" row-key="id" empty-title="暂无数据" empty-description="调整筛选条件或新增记录后，数据会显示在这里">
        <template #c4="{ row }"><span v-if="!row.lastRun" style="color:var(--n-600)">未执行</span>
                  <span v-else>
                    <el-tag :type="row.lastRun.ok ? 'success' : 'danger'" size="small" effect="plain">
                      {{ row.lastRun.ok ? '成功' : '失败' }}
                    </el-tag>
                    <span style="margin-left:6px">{{ formatRunTime(row.lastRun.at) }}</span>
                    <div style="font-size:12px;color:var(--n-600)">{{ row.lastRun.detail }}</div>
                  </span></template>
        <template #c5="{ row }"><el-button link type="primary" size="small" :loading="runningKey === row.key" @click="runCronTask(row)">
                    立即执行
                  </el-button></template>
      </DataTable>
      <div style="margin-top:12px;font-size:12px;color:var(--n-600)">
        调度器随后端启动自动挂载（设 CRON_ENABLED=false 可关闭）。手动执行与定时执行走同一份逻辑；账单生成、折旧计提均已做幂等保护，重复执行不会产生重复数据。
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import DataTable from '@/components/base/DataTable.vue';
import type { TableColumn } from '@/components/base/types';

const COLUMNS: TableColumn[] = [
  { prop: 'name', label: '任务名称', width: 140 },
  { prop: 'schedule', label: '调度时间', width: 140 },
  { prop: 'desc', label: '说明', minWidth: 220 },
  { label: '最近执行', width: 230, slot: 'c4' },
  { label: '操作', width: 100, fixed: 'right', slot: 'c5' },
];

import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { confirmWithPassword } from '@/utils/confirm-password';
import { downloadWithAuth } from '@/utils/download';
import request from '@/api/request';

const router = useRouter();
const info = ref<any>(null);
const loadingInfo = ref(false);
const cronList = ref<any[]>([]);
const loadingCron = ref(false);
const cronStarted = ref(false);
const runningKey = ref('');
const auditEnabled = ref(true);
const demoEnabled = ref(true);
const loadingToggle = ref(false);

function formatUptime(sec: number) {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return d + ' 天 ' + h + ' 小时';
  if (h > 0) return h + ' 小时 ' + m + ' 分';
  return m + ' 分钟';
}

async function fetchInfo() {
  loadingInfo.value = true;
  try { const res = await request.get('/system-ops/info'); info.value = res.data; } catch {} finally { loadingInfo.value = false; }
}

async function fetchCron() {
  loadingCron.value = true;
  try {
    const res = await request.get('/system-ops/cron');
    cronList.value = res.data?.list || [];
    cronStarted.value = !!res.data?.started;
  } catch {} finally { loadingCron.value = false; }
}

function formatRunTime(iso: string) {
  if (!iso) return '';
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
}

// 手动触发单个任务：与定时执行共用后端同一份逻辑，已做幂等保护
async function runCronTask(row: any) {
  runningKey.value = row.key;
  try {
    // 拦截器实际返回的是 body（{ code, data, message }），类型上仍是 AxiosResponse，故断言
    const res: any = await request.post('/system-ops/cron/run/' + row.key, {});
    ElMessage.success(res.message || '执行完成');
    await fetchCron();
  } catch { /* 拦截器已提示 */ } finally { runningKey.value = ''; }
}

// 启停调度器（不可逆影响自动化，需二次确认）
async function toggleCron() {
  const next = !cronStarted.value;
  const pwd = await confirmWithPassword(next ? '确认启动定时任务调度器？' : '确认停止定时任务调度器？停止后账单生成、催缴、折旧等将不再自动执行。');
  if (!pwd) return;
  try {
    const res: any = await request.post('/system-ops/cron/toggle', { enabled: next, confirmPassword: pwd });
    ElMessage.success(res.message || '已切换');
    await fetchCron();
  } catch { /* 拦截器已提示 */ }
}

async function fetchToggle() {
  try { const res = await request.get('/system-ops/audit-toggle'); auditEnabled.value = !!res.data?.enabled; } catch { /* silent */ }
  try { const res = await request.get('/system-ops/demo-toggle'); demoEnabled.value = !!res.data?.enabled; } catch { /* silent */ }
}

async function toggleAudit(val: boolean | string | number) {
  loadingToggle.value = true;
  try {
    const pwd = await confirmWithPassword('切换审计日志开关需重新输入登录密码确认', '二次确认');
    if (pwd === null) { auditEnabled.value = !val; return; }
    await request.post('/system-ops/audit-toggle', { enabled: Boolean(val), confirmPassword: pwd });
    ElMessage.success('审计日志已' + (val ? '开启' : '关闭'));
  } catch (err: any) {
    auditEnabled.value = !val;
    ElMessage.error(err?.response?.data?.message || '切换失败');
  } finally { loadingToggle.value = false; }
}

async function toggleDemo(val: boolean | string | number) {
  loadingToggle.value = true;
  try {
    const pwd = await confirmWithPassword('切换演示数据开关需重新输入登录密码确认', '二次确认');
    if (pwd === null) { demoEnabled.value = !val; return; }
    await request.post('/system-ops/demo-toggle', { enabled: Boolean(val), confirmPassword: pwd });
    ElMessage.success('演示数据已' + (val ? '开启' : '关闭'));
  } catch (err: any) {
    demoEnabled.value = !val;
    ElMessage.error(err?.response?.data?.message || '切换失败');
  } finally { loadingToggle.value = false; }
}

async function exportBackup() {
  try {
    const pwd = await confirmWithPassword('下载数据库备份需重新输入登录密码确认', '二次确认');
    if (!pwd) return;
    // 带鉴权下载（Authorization Bearer + apiBaseURL），confirmPassword 通过查询参数传给后端
    await downloadWithAuth('/system-ops/backup', { confirmPassword: pwd }, 'database_backup.sqlite');
    ElMessage.success('备份下载已开始');
  } catch { /* silent */ }
}

onMounted(() => { fetchInfo(); fetchCron(); fetchToggle(); });
</script>

<style lang="scss" scoped>
.toolbar { display:flex; align-items:center; gap:12px; margin-bottom:16px; }
.page-head { display:flex; align-items:center; gap:12px; margin-bottom:16px; }
.page-title { font-size:18px; font-weight:700; color:$n-900; margin:0; }
</style>
