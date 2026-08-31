<template>
  <div class="system-ops">
    <h2 class="page-title">系统运维</h2>

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
              <span style="font-size:12px;color:#909399">关闭后系统将不再记录操作审计日志</span>
            </div>
          </div>
          <el-divider />
          <div style="margin-bottom:12px">
            <el-button type="primary" @click="exportBackup">下载数据库备份</el-button>
            <span style="font-size:12px;color:#909399;margin-left:12px">仅支持 SQLite 数据库，含全部业务数据</span>
          </div>
          <el-alert type="warning" :closable="false" show-icon title="备份建议" description="重大变更/发版前请先下载数据库备份，便于回退。电子桌面版数据存储于 %APPDATA%/物业租赁综合管理系统/data/。" />
        </el-card>
      </el-col>
    </el-row>

    <el-card header="定时任务（Cron）" style="margin-top:16px" v-loading="loadingCron">
      <el-table :data="cronList" stripe size="small">
        <el-table-column prop="name" label="任务名称" width="160" />
        <el-table-column prop="schedule" label="调度时间" width="160" />
        <el-table-column prop="desc" label="说明" />
      </el-table>
      <div style="margin-top:12px;font-size:12px;color:#909399">
        定时任务由后端调度器管理。当前调度器可通过环境变量/外部机制触发（项目约定：scheduler.start() 不自动调用，需手动触发或通过外部机制调度）。
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { confirmWithPassword } from '@/utils/confirm-password';
import { downloadWithAuth } from '@/utils/download';
import request from '@/api/request';

const info = ref<any>(null);
const loadingInfo = ref(false);
const cronList = ref<any[]>([]);
const loadingCron = ref(false);
const auditEnabled = ref(true);
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
  try { const res = await request.get('/system-ops/cron'); cronList.value = res.data?.list || []; } catch {} finally { loadingCron.value = false; }
}

async function fetchToggle() {
  try { const res = await request.get('/system-ops/audit-toggle'); auditEnabled.value = !!res.data?.enabled; } catch { /* silent */ }
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
.page-title { font-size:18px; font-weight:700; color:#0A3D62; margin:0 0 16px; }
</style>
