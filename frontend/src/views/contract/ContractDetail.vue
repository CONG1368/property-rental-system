<template>
  <div class="contract-detail">
    <el-page-header @back="$router.back()" :title="'合同详情 - ' + contract?.contractNo" />
    <el-card style="margin-top:16px" v-if="contract">
      <template #header>
        <span>合同信息</span>
        <el-tag style="margin-left:12px" :type="statusTagType(contract.status)">{{ contract.status }}</el-tag>
      </template>
      <el-descriptions :column="3" border>
        <el-descriptions-item label="合同编号">{{ contract.contractNo }}</el-descriptions-item>
        <el-descriptions-item label="月租金">{{ contract.rentAmount }}</el-descriptions-item>
        <el-descriptions-item label="押金">{{ contract.depositAmount }}</el-descriptions-item>
        <el-descriptions-item label="开始日期">{{ contract.startDate }}</el-descriptions-item>
        <el-descriptions-item label="结束日期">{{ contract.endDate }}</el-descriptions-item>
        <el-descriptions-item label="付款周期">{{ contract.paymentCycle }}</el-descriptions-item>
        <el-descriptions-item label="计费模式">{{ contract.billingMode }}</el-descriptions-item>
        <el-descriptions-item label="签署日期">{{ contract.signedAt || '--' }}</el-descriptions-item>
        <el-descriptions-item label="创建时间">{{ contract.createdAt?.slice(0, 10) }}</el-descriptions-item>
      </el-descriptions>

      <el-descriptions :column="1" border style="margin-top:16px" v-if="contract.tenant || contract.property">
        <el-descriptions-item label="租客">{{ contract.tenant?.name || '--' }}</el-descriptions-item>
        <el-descriptions-item label="房源">{{ contract.property?.name || '--' }} — {{ contract.property?.address || '' }}</el-descriptions-item>
      </el-descriptions>

      <div style="margin-top:20px; display:flex; gap:10px; flex-wrap:wrap">
        <!-- 起草中 -->
        <template v-if="contract.status === '起草中'">
          <el-button size="small" @click="$router.push('/contract/draft/' + contract.id)">编辑合同</el-button>
          <el-button type="success" @click="handleAction('submit')">提交审批</el-button>
        </template>

        <!-- 审批中：驳回 + 去审批 -->
        <template v-if="contract.status === '审批中'">
          <el-button type="danger" @click="handleAction('reject')">驳回</el-button>
          <el-button type="warning" @click="$router.push('/contract/approval')">去审批页面</el-button>
        </template>

        <!-- 已签订：签署 -->
        <template v-if="contract.status === '已签订'">
          <el-button type="primary" @click="handleAction('sign')">签署生效</el-button>
        </template>

        <!-- 执行中：终止 + 续约 -->
        <template v-if="contract.status === '执行中'">
          <el-button type="danger" @click="handleAction('terminate')">终止合同</el-button>
          <el-button type="primary" @click="showRenew">续约</el-button>
        </template>

        <!-- 已到期：终止 + 续约 -->
        <template v-if="contract.status === '已到期'">
          <el-button type="danger" @click="handleAction('terminate')">终止合同</el-button>
          <el-button type="primary" @click="showRenew">续约</el-button>
        </template>

        <!-- 已驳回：编辑 + 重新提交 -->
        <template v-if="contract.status === '已驳回'">
          <el-button size="small" @click="$router.push('/contract/draft/' + contract.id)">重新编辑</el-button>
        </template>

        <!-- 已终止：仅显示删除 -->
        <el-popconfirm title="确定删除该合同?" @confirm="handleDelete" v-if="contract.status === '已终止'">
          <template #reference><el-button type="danger">删除合同</el-button></template>
        </el-popconfirm>

        <!-- 其他状态均显示删除 -->
        <el-popconfirm v-if="contract.status !== '已终止'" title="确定删除该合同?" @confirm="handleDelete">
          <template #reference><el-button type="danger">删除合同</el-button></template>
        </el-popconfirm>
      </div>
    </el-card>

    <!-- 费用配置 -->
    <el-card style="margin-top:16px" v-if="contract">
      <template #header><span>费用配置（每月）</span></template>
      <el-descriptions :column="3" border v-if="billingConfig">
        <el-descriptions-item label="水费">¥{{ Number(billingConfig.waterFee || 0).toFixed(2) }}</el-descriptions-item>
        <el-descriptions-item label="电费">¥{{ Number(billingConfig.electricFee || 0).toFixed(2) }}</el-descriptions-item>
        <el-descriptions-item label="物业费">¥{{ Number(billingConfig.propertyFee || 0).toFixed(2) }}</el-descriptions-item>
        <el-descriptions-item label="月租金" :span="2">¥{{ Number(contract.rentAmount || 0).toFixed(2) }}</el-descriptions-item>
        <el-descriptions-item label="月费用合计">¥{{ monthlyTotal.toFixed(2) }}</el-descriptions-item>
      </el-descriptions>
      <el-empty v-else description="暂无费用配置" :image-size="60" />
    </el-card>

    <!-- 合同附件 -->
    <el-card style="margin-top:16px" v-if="contract">
      <template #header>
        <span>合同附件</span>
        <el-upload
          :action="'/api/contracts/' + contract.id + '/upload'"
          :headers="uploadHeaders"
          multiple
          :show-file-list="false"
          :on-success="onUploadSuccess"
          :on-error="onUploadError"
          style="display:inline-block;margin-left:16px"
        >
          <el-button size="small" type="primary">上传文件</el-button>
        </el-upload>
        <span style="font-size:12px;color:#909399;margin-left:8px">支持 PDF/DOC/DOCX/图片/Excel，单文件≤10MB</span>
      </template>
      <el-table :data="attachments" size="small" empty-text="暂无附件">
        <el-table-column prop="name" label="文件名" min-width="200" show-overflow-tooltip />
        <el-table-column label="大小" width="100"><template #default="{ row }">{{ formatFileSize(row.size) }}</template></el-table-column>
        <el-table-column prop="uploadedAt" label="上传时间" width="170"><template #default="{ row }">{{ row.uploadedAt?.slice(0, 16)?.replace('T', ' ') }}</template></el-table-column>
      </el-table>
    </el-card>

    <!-- 续约对话框 -->
    <el-dialog title="合同续约" v-model="renewVisible" width="450px">
      <el-form :model="renewForm" label-width="100px">
        <el-form-item label="原到期日"><span>{{ contract?.endDate }}</span></el-form-item>
        <el-form-item label="新到期日"><el-date-picker v-model="renewForm.newEndDate" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item>
        <el-form-item label="新月租金"><el-input-number v-model="renewForm.newRent" :min="0" :precision="2" style="width:100%" /></el-form-item>
        <el-form-item label="备注"><el-input v-model="renewForm.notes" type="textarea" :rows="2" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="renewVisible = false">取消</el-button><el-button type="primary" @click="handleRenew">确认续约</el-button></template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import request from '@/api/request';

const route = useRoute();
const router = useRouter();
const contract = ref<any>(null);

const billingConfig = computed(() => contract.value?.billingConfig || {});
const monthlyTotal = computed(() => Number(contract.value?.rentAmount || 0) + Number(billingConfig.value.waterFee || 0) + Number(billingConfig.value.electricFee || 0) + Number(billingConfig.value.propertyFee || 0));

const renewVisible = ref(false);
const renewForm = ref({ newEndDate: '', newRent: 0, notes: '' });

// 文件上传
const uploadHeaders = computed(() => ({ Authorization: 'Bearer ' + localStorage.getItem('accessToken') }));
const attachments = ref<any[]>([]);

function formatFileSize(bytes: number) {
  if (!bytes || bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + units[i];
}

function onUploadSuccess(res: any) {
  if (res.code === 200) {
    ElMessage.success(`上传成功 ${res.data.length} 个文件`);
    fetchAttachments();
  }
}
function onUploadError() { ElMessage.error('文件上传失败'); }

async function fetchAttachments() {
  if (!contract.value?.id) return;
  try {
    const res = await request.get('/contracts/' + contract.value.id + '/files');
    attachments.value = res.data?.list || [];
  } catch { /* 附件加载失败不影响主流程 */ }
}

function statusTagType(status: string) {
  const map: Record<string, string> = { '执行中': 'success', '审批中': 'warning', '已签订': 'primary', '已驳回': 'danger', '已到期': 'info', '已终止': 'info', '起草中': 'info' };
  return map[status] || 'info';
}

async function fetchContract() {
  try { const res = await request.get('/contracts/' + route.params.id); contract.value = res.data; } catch { ElMessage.error('加载合同详情失败'); }
}

async function handleAction(action: string) {
  try {
    await request.post(`/contracts/${contract.value!.id}/${action}`);
    ElMessage.success('操作成功');
    fetchContract();
  } catch (e: any) { ElMessage.error(e?.response?.data?.message || '操作失败'); }
}

async function handleDelete() {
  try {
    await request.delete('/contracts/' + contract.value!.id);
    ElMessage.success('合同已删除');
    router.push('/contract/list');
  } catch { ElMessage.error('删除失败'); }
}

function showRenew() {
  renewForm.value = { newEndDate: '', newRent: contract.value?.rentAmount || 0, notes: '' };
  renewVisible.value = true;
}

async function handleRenew() {
  try {
    await request.post('/contracts/' + contract.value!.id + '/renew', {
      newEndDate: renewForm.value.newEndDate || undefined,
      newRent: renewForm.value.newRent,
      notes: renewForm.value.notes,
    });
    ElMessage.success('续约合同已创建');
    renewVisible.value = false;
    fetchContract();
  } catch (e: any) { ElMessage.error(e?.response?.data?.message || '续约失败'); }
}

onMounted(async () => { await fetchContract(); await fetchAttachments(); });
</script>
