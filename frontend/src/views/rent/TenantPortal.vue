<template>
  <div class="tenant-portal">
    <!-- 未登录：登录表单 -->
    <div v-if="!logged" class="login-wrap">
      <el-card class="login-card">
        <h2 class="portal-title">租户自助服务</h2>
        <el-form :model="loginForm" label-width="80px">
          <el-form-item label="手机号"><el-input v-model="loginForm.phone" placeholder="请输入登记手机号" /></el-form-item>
          <el-form-item label="服务口令"><el-input v-model="loginForm.pin" placeholder="请输入6位口令" show-password /></el-form-item>
          <el-button type="primary" style="width:100%" :loading="logging" @click="doLogin">登 录</el-button>
        </el-form>
        <div class="login-tip">演示口令请联系物业管理员获取（如 123456）</div>
      </el-card>
    </div>

    <!-- 已登录：门户内容 -->
    <div v-else class="portal-wrap">
      <header class="portal-header">
        <div class="ttl"><el-icon :size="18" style="vertical-align:-3px;margin-right:6px"><House /></el-icon>租户自助服务</div>
        <div class="user">{{ tenant?.name }}（{{ tenant?.phone }}）<el-button text type="danger" @click="logout">退出</el-button></div>
      </header>
      <el-tabs v-model="tab" class="portal-tabs">
        <el-tab-pane label="我的账单" name="bills">
          <TableSkeleton v-if="loading && !bills.length" :rows="8" :columns="7" />
          <el-table v-show="!(loading && !bills.length)" :data="bills" stripe v-loading="loading">
            <el-table-column prop="billNo" label="账单号" width="150" />
            <el-table-column prop="period" label="账期" width="100" />
            <el-table-column prop="totalAmount" label="金额" width="120" align="right"><template #default="{ row }">{{ fmt(row.totalAmount) }}</template></el-table-column>
            <el-table-column prop="dueDate" label="到期日" width="120" />
            <el-table-column prop="status" label="状态" width="90"><template #default="{ row }"><el-tag :type="row.status === '已缴' ? 'success' : row.status === '逾期' ? 'danger' : 'warning'" size="small">{{ row.status }}</el-tag></template></el-table-column>
            <el-table-column label="操作" width="90"><template #default="{ row }"><el-button v-if="row.status !== '已缴'" size="small" type="primary" link>去缴费</el-button></template></el-table-column>
                      <template #empty>
              <EmptyState title="暂无数据" description="调整筛选条件或新增记录后，数据会显示在这里" />
            </template>
          </el-table>
        </el-tab-pane>
        <el-tab-pane label="我的报修" name="repairs">
          <el-table :data="repairs" stripe v-loading="loading">
            <el-table-column prop="ticketNo" label="工单号" width="150" />
            <el-table-column prop="title" label="标题" min-width="160" />
            <el-table-column prop="status" label="状态" width="90"><template #default="{ row }"><el-tag size="small">{{ row.status }}</el-tag></template></el-table-column>
            <el-table-column label="操作" width="90"><template #default="{ row }"><el-button size="small" @click="submitRepairFromRow(row)">跟进</el-button></template></el-table-column>
          </el-table>
          <el-button type="primary" class="add-repair" @click="openRepair">提交报修</el-button>
        </el-tab-pane>
        <el-tab-pane label="公告" name="anns">
          <el-table :data="anns" stripe>
            <el-table-column prop="title" label="标题" min-width="180" />
            <el-table-column prop="category" label="类别" width="90" />
            <el-table-column prop="publishDate" label="日期" width="120" />
            <el-table-column prop="content" label="内容" min-width="240" show-overflow-tooltip />
          </el-table>
        </el-tab-pane>
        <el-tab-pane label="我的消息" name="msgs">
          <el-table :data="msgs" stripe v-loading="loading">
            <el-table-column prop="title" label="标题" width="180" />
            <el-table-column prop="content" label="内容" min-width="220" show-overflow-tooltip />
            <el-table-column prop="createdAt" label="时间" width="180" />
          </el-table>
        </el-tab-pane>
      </el-tabs>

      <el-dialog title="提交报修" v-model="repairDialog" width="520px">
        <el-form :model="repairForm" label-width="90px">
          <el-form-item label="合同" required>
            <el-select v-model="repairForm.contractId" style="width:100%"><el-option v-for="c in contracts" :key="c.id" :label="c.contractNo" :value="c.id" /></el-select>
          </el-form-item>
          <el-form-item label="标题" required><el-input v-model="repairForm.title" /></el-form-item>
          <el-form-item label="优先级"><el-select v-model="repairForm.priority" style="width:150px"><el-option label="低" value="低" /><el-option label="中" value="中" /><el-option label="高" value="高" /></el-select></el-form-item>
          <el-form-item label="描述"><el-input v-model="repairForm.description" type="textarea" :rows="3" /></el-form-item>
        </el-form>
        <template #footer><el-button @click="repairDialog = false">取消</el-button><el-button type="primary" @click="submitRepair">提交</el-button></template>
      </el-dialog>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { House } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { apiBaseURL } from '@/api/request';

const TOKEN_KEY = 'tenantToken';
const logged = ref(false); const logging = ref(false); const loading = ref(false);
const tab = ref('bills');
const loginForm = ref({ phone: '', pin: '' });
const tenant = ref<any>(null); const contracts = ref<any[]>([]);
const bills = ref<any[]>([]); const repairs = ref<any[]>([]); const anns = ref<any[]>([]); const msgs = ref<any[]>([]);
const repairDialog = ref(false);
const repairForm = ref({ contractId: null, title: '', priority: '中', description: '' });

function fmt(v: any): string { return Number(v || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 }); }
function token() { return localStorage.getItem(TOKEN_KEY) || ''; }
async function api(path: string, opts: any = {}) {
  const resp = await fetch(apiBaseURL + path, { ...opts, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token(), ...(opts.headers || {}) } });
  return resp.json();
}
async function doLogin() {
  if (!loginForm.value.phone || !loginForm.value.pin) return ElMessage.warning('请输入手机号与口令');
  logging.value = true;
  try {
    const j = await fetch(apiBaseURL + '/tenant-auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(loginForm.value) }).then(r => r.json());
    if (j.code !== 200) return ElMessage.error(j.message || '登录失败');
    localStorage.setItem(TOKEN_KEY, j.data.token); tenant.value = j.data.tenant; logged.value = true; loadData();
  } catch { ElMessage.error('登录失败'); } finally { logging.value = false; }
}
function logout() { localStorage.removeItem(TOKEN_KEY); logged.value = false; }
async function loadData() {
  loading.value = true;
  try {
    const [prof, bl, rp, an, ms] = await Promise.all([
      api('/tenant-portal/profile'), api('/tenant-portal/bills'), api('/tenant-portal/repairs'), api('/tenant-portal/announcements'), api('/tenant-portal/notifications'),
    ]);
    if (prof.data) { tenant.value = prof.data.tenant; contracts.value = prof.data.contracts || []; }
    bills.value = bl.data?.list || []; repairs.value = rp.data?.list || []; anns.value = an.data?.list || []; msgs.value = ms.data?.list || [];
  } catch { /* 静默 */ } finally { loading.value = false; }
}
function submitRepairFromRow(row: any) { ElMessage.info(`工单 ${row.ticketNo} 处理中，请留意状态变化`); }
function openRepair() { repairForm.value = { contractId: contracts.value[0]?.id || null, title: '', priority: '中', description: '' }; repairDialog.value = true; }
async function submitRepair() {
  if (!repairForm.value.title) return ElMessage.warning('请输入标题');
  try { const j = await api('/tenant-portal/repairs', { method: 'POST', body: JSON.stringify(repairForm.value) }); if (j.code === 200) { ElMessage.success('报修已提交'); repairDialog.value = false; loadData(); } else ElMessage.error(j.message || '提交失败'); }
  catch { ElMessage.error('提交失败'); }
}
onMounted(() => { if (token()) { logged.value = true; loadData(); } });
</script>

<style lang="scss" scoped>
.tenant-portal { min-height: 100vh; background: #f5f7fa; }
.login-wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; }
.login-card { width: 400px; padding: 12px 6px; }
.portal-title { text-align: center; margin-bottom: 18px; color: #1f2430; }
.login-tip { margin-top: 12px; color: #909399; font-size: 12px; text-align: center; }
.portal-wrap { max-width: 1100px; margin: 0 auto; padding: 16px; }
.portal-header { display: flex; justify-content: space-between; align-items: center; background: #fff; padding: 14px 20px; border-radius: 8px; margin-bottom: 16px; }
.ttl { font-size: 18px; font-weight: 700; color: #1f2430; }
.user { color: #606266; }
.add-repair { margin-top: 12px; }
</style>