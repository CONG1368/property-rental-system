<template>
  <div class="portal-page">
    <el-card shadow="never" class="select-card">
      <div class="sel-row">
        <span class="lbl">选择租户</span>
        <el-select v-model="tenantId" filterable placeholder="搜索姓名/手机号选择租户" style="width:320px" @change="onTenantChange">
          <el-option v-for="t in tenants" :key="t.id" :label="`${t.name}（${t.phone}）`" :value="t.id" />
        </el-select>
      </div>
      <el-descriptions v-if="tenant" :column="4" border size="small">
        <el-descriptions-item label="姓名">{{ tenant.name }}</el-descriptions-item>
        <el-descriptions-item label="手机">{{ tenant.phone }}</el-descriptions-item>
        <el-descriptions-item label="信用等级"><el-tag :type="tenant.creditGrade === 'A' ? 'success' : tenant.creditGrade === 'B' ? 'primary' : tenant.creditGrade === 'C' ? 'warning' : 'danger'" size="small">{{ tenant.creditGrade }} ({{ tenant.creditScore }})</el-tag></el-descriptions-item>
        <el-descriptions-item label="状态">{{ tenant.status }}</el-descriptions-item>
      </el-descriptions>
    </el-card>

    <el-tabs v-model="tab" v-if="tenant">
      <!-- 发送通知 -->
      <el-tab-pane label="触达通知" name="notify">
        <el-card shadow="never">
          <div class="tpl-row">
            <el-button size="small" @click="fillTemplate('催缴')">催缴提醒</el-button>
            <el-button size="small" @click="fillTemplate('到期')">合同到期提醒</el-button>
            <el-button size="small" @click="fillTemplate('维修')">维修完成通知</el-button>
          </div>
          <el-form :model="notifyForm" label-width="90px" style="max-width:640px">
            <el-form-item label="渠道"><el-select v-model="notifyForm.channel" style="width:180px"><el-option label="站内信" value="站内信" /><el-option label="短信" value="短信" /></el-select></el-form-item>
            <el-form-item label="接收手机" v-if="notifyForm.channel === '短信'"><el-input v-model="notifyForm.phone" placeholder="默认取租户手机号" /></el-form-item>
            <el-form-item label="标题" required><el-input v-model="notifyForm.title" /></el-form-item>
            <el-form-item label="内容"><el-input v-model="notifyForm.content" type="textarea" :rows="3" /></el-form-item>
            <el-form-item><el-button type="primary" :loading="sending" @click="sendNotify">发送通知</el-button></el-form-item>
          </el-form>
        </el-card>
      </el-tab-pane>

      <!-- 消息记录 -->
      <el-tab-pane label="消息记录" name="msgs">
        <el-table :data="msgs" stripe v-loading="loadingMsgs">
          <el-table-column prop="channel" label="渠道" width="90"><template #default="{ row }"><el-tag size="small">{{ row.channel }}</el-tag></template></el-table-column>
          <el-table-column prop="title" label="标题" min-width="160" />
          <el-table-column prop="content" label="内容" min-width="220" show-overflow-tooltip />
          <el-table-column label="已读" width="80"><template #default="{ row }"><el-icon v-if="row.isRead" color="#0a7652"><Select /></el-icon><span v-else style="color:#5f6675">未读</span></template></el-table-column>
          <el-table-column prop="createdAt" label="时间" width="180" />
                  <template #empty>
            <EmptyState title="暂无数据" description="调整筛选条件或新增记录后，数据会显示在这里" />
          </template>
        </el-table>
        <el-pagination v-model:current-page="msgPage" :total="msgTotal" :page-size="msgPageSize" @current-change="loadMsgs" layout="total, prev, pager, next" style="margin-top:12px; justify-content:flex-end" />
      </el-tab-pane>

      <!-- 代提交报修 -->
      <el-tab-pane label="代提交报修" name="repair">
        <el-form :model="repairForm" label-width="90px" style="max-width:560px">
          <el-form-item label="合同" required>
            <el-select v-model="repairForm.contractId" filterable style="width:100%">
              <el-option v-for="c in tenantContracts" :key="c.id" :label="c.contractNo" :value="c.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="报修标题" required><el-input v-model="repairForm.title" /></el-form-item>
          <el-form-item label="优先级"><el-select v-model="repairForm.priority" style="width:160px"><el-option label="低" value="低" /><el-option label="中" value="中" /><el-option label="高" value="高" /><el-option label="紧急" value="紧急" /></el-select></el-form-item>
          <el-form-item label="描述"><el-input v-model="repairForm.description" type="textarea" :rows="3" /></el-form-item>
          <el-form-item><el-button type="primary" :loading="submitting" @click="submitRepair">代提交报修单</el-button></el-form-item>
        </el-form>
      </el-tab-pane>

      <!-- 公告 -->
      <el-tab-pane label="公告" name="ann">
        <el-table :data="anns" stripe>
          <el-table-column prop="title" label="标题" min-width="180" />
          <el-table-column prop="category" label="类别" width="90" />
          <el-table-column prop="publishDate" label="发布日期" width="130" />
          <el-table-column prop="content" label="内容" min-width="240" show-overflow-tooltip />
        </el-table>
      </el-tab-pane>
    </el-tabs>
    <el-empty v-else description="请先选择租户" />
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import { Select } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import request from '@/api/request';

const tenants = ref<any[]>([]); const tenantId = ref<number | null>(null); const tenant = ref<any>(null);
const tab = ref('notify');
const sending = ref(false); const submitting = ref(false);
const msgs = ref<any[]>([]); const msgTotal = ref(0); const msgPage = ref(1); const msgPageSize = ref(20); const loadingMsgs = ref(false);
const anns = ref<any[]>([]);
const tenantContracts = ref<any[]>([]);
const notifyForm = ref({ channel: '站内信', phone: '', title: '', content: '' });
const repairForm = ref({ contractId: null, title: '', priority: '中', description: '' });

async function loadTenants() { try { const r = await request.get('/tenants', { params: { pageSize: 200 } }); tenants.value = r.data?.list || []; } catch {} }
function onTenantChange(id: number) { tenant.value = tenants.value.find(t => t.id === id) || null; tab.value = 'notify'; loadMsgs(); loadContracts(); }

function fillTemplate(t: string) {
  if (t === '催缴') { notifyForm.value.title = '租金催缴提醒'; notifyForm.value.content = '您有账单尚未缴清，请及时缴纳，以免产生滞纳金。'; notifyForm.value.channel = '短信'; }
  else if (t === '到期') { notifyForm.value.title = '合同到期提醒'; notifyForm.value.content = '您的租赁合同即将到期，如需续约请及时联系管理员。'; }
  else if (t === '维修') { notifyForm.value.title = '维修完成通知'; notifyForm.value.content = '您提交的报修已处理完成，感谢您的理解与支持。'; }
}
async function sendNotify() {
  if (!notifyForm.value.title) return ElMessage.warning('请输入标题');
  sending.value = true;
  try {
    const res = await request.post('/notifications/send-to-tenant', { tenantId: tenantId.value, channel: notifyForm.value.channel, title: notifyForm.value.title, content: notifyForm.value.content, phone: notifyForm.value.phone || undefined });
    ElMessage.success('通知已发送'); notifyForm.value.title = ''; notifyForm.value.content = ''; loadMsgs();
  } catch (err: any) { ElMessage.error(err?.response?.data?.message || '发送失败'); } finally { sending.value = false; }
}
async function loadMsgs() {
  if (!tenantId.value) return;
  loadingMsgs.value = true;
  try { const r = await request.get(`/notifications/tenant/${tenantId.value}`, { params: { page: msgPage.value, pageSize: msgPageSize.value } }); msgs.value = r.data?.list || []; msgTotal.value = r.data?.total || 0; }
  catch {} finally { loadingMsgs.value = false; }
}
async function loadContracts() {
  if (!tenantId.value) return;
  try { const r = await request.get('/contracts', { params: { pageSize: 200 } }); tenantContracts.value = (r.data?.list || []).filter((c: any) => c.tenantId === tenantId.value && c.status !== '已终止'); } catch {}
}
async function submitRepair() {
  if (!repairForm.value.contractId) return ElMessage.warning('请选择合同');
  const c = tenantContracts.value.find(x => x.id === repairForm.value.contractId);
  if (!c) return ElMessage.error('未找到合同');
  submitting.value = true;
  try {
    await request.post('/work-orders', { propertyId: c.propertyId, tenantId: tenantId.value, title: repairForm.value.title, type: '报修', priority: repairForm.value.priority, description: repairForm.value.description, reporter: tenant.value?.name, phone: tenant.value?.phone });
    ElMessage.success('报修单已提交'); repairForm.value = { contractId: null, title: '', priority: '中', description: '' };
  } catch (err: any) { ElMessage.error(err?.response?.data?.message || '提交失败'); } finally { submitting.value = false; }
}
async function loadAnns() { try { const r = await request.get('/announcements', { params: { pageSize: 50 } }); anns.value = r.data?.list || []; } catch {} }
onMounted(() => { loadTenants(); loadAnns(); });
</script>

<style lang="scss" scoped>
.portal-page { padding: 0; }
.select-card { margin-bottom: 16px; }
.sel-row { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
.lbl { font-weight: 600; }
.tpl-row { margin-bottom: 12px; display: flex; gap: 8px; flex-wrap: wrap; }
</style>