<template>
  <div class="contract-detail">
    <el-page-header @back="$router.back()" :title="'合同详情 - ' + contract?.contractNo">
      <template #content>
        <el-dropdown @command="handlePrint" v-if="contract && ['执行中','已签订','已到期'].includes(contract.status)" style="margin-left:16px">
          <el-button type="primary" plain size="small">
            <el-icon><Printer /></el-icon> 打印 <el-icon><ArrowDown /></el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="native"><el-icon><Printer /></el-icon> 直接打印</el-dropdown-item>
              <el-dropdown-item command="pdf"><el-icon><Download /></el-icon> 导出PDF</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </template>
    </el-page-header>
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
        <el-descriptions-item label="付款周期">{{ paymentCycleLabel }}</el-descriptions-item>
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
      <template #header><span>费用配置</span></template>
      <el-descriptions :column="3" border>
        <el-descriptions-item label="月租金">¥{{ Number(contract.rentAmount || 0).toFixed(2) }}（大写：{{ chineseRent }}）</el-descriptions-item>
        <el-descriptions-item label="付款周期">{{ paymentCycleLabel }}</el-descriptions-item>
        <el-descriptions-item label="每期应交租金" :span="1">
          <span style="font-weight:bold;color:#0A3D62;font-size:16px">¥{{ periodRent.toFixed(2) }}</span>
          <span style="font-size:12px;color:#909399">（大写：{{ chinesePeriodRent }}）</span>
        </el-descriptions-item>
        <el-descriptions-item label="押金">¥{{ Number(contract.depositAmount || 0).toFixed(2) }}</el-descriptions-item>
        <template v-if="feeItemList.length > 0">
          <el-descriptions-item v-for="fi in feeItemList" :key="fi.name" :label="fi.name">
            ¥{{ Number(fi.amount).toFixed(2) }} {{ fi.unit || '' }}
          </el-descriptions-item>
          <el-descriptions-item label="每期费用合计">
            <span style="font-weight:bold;color:#e67e22">¥{{ periodFeeTotal.toFixed(2) }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="每期应付总计" :span="1">
            <span style="font-weight:bold;color:#d35400;font-size:16px">¥{{ periodTotal.toFixed(2) }}</span>
            <span style="font-size:12px;color:#909399">（大写：{{ chinesePeriodTotal }}）</span>
          </el-descriptions-item>
        </template>
        <el-descriptions-item v-if="feeItemList.length === 0" label="费用明细" :span="2">
          <span style="color:#909399">暂无自定义费用项</span>
        </el-descriptions-item>
      </el-descriptions>
      <el-empty v-if="!contract.rentAmount && feeItemList.length === 0" description="暂无费用配置" :image-size="60" />
    </el-card>

    <!-- 合同附件 -->
    <el-card style="margin-top:16px" v-if="contract">
      <template #header>
        <span>合同附件</span>
        <el-upload
          :action="apiBaseURL + '/contracts/' + contract.id + '/upload'"
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

    <!-- 合同条款 -->
    <el-card style="margin-top:16px" v-if="contract">
      <template #header><span>合同条款</span></template>
      <el-timeline v-if="sortedClauses.length > 0">
        <el-timeline-item
          v-for="(clause, index) in sortedClauses"
          :key="index"
          :timestamp="'第' + (index + 1) + '条'"
          placement="top"
        >
          <el-card shadow="hover" size="small">
            <h4 style="margin:0 0 8px 0;color:#0A3D62">{{ clause.title || '(无标题)' }}</h4>
            <p style="margin:0;font-size:13px;color:#606266;white-space:pre-wrap">{{ clause.content }}</p>
          </el-card>
        </el-timeline-item>
      </el-timeline>
      <el-empty v-else description="本合同暂无条款约定" :image-size="40" />
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
import { Printer, ArrowDown, Download } from '@element-plus/icons-vue';
import request, { apiBaseURL } from '@/api/request';
import { printDocument, isElectron, formatDate } from '@/utils/print-service';
import { buildContractHTML } from '@/components/print/ContractPrint';

const route = useRoute();
const router = useRouter();
const contract = ref<any>(null);

// 付款周期 → 月数映射
const CYCLE_MONTHS: Record<string, number> = {
  '月': 1, '季': 3, '半年': 6, '年': 12, '两年': 24, '三年': 36, '五年': 60,
};

const cycleMonths = computed(() => CYCLE_MONTHS[contract.value?.paymentCycle] || 1);
const periodRent = computed(() => Number(contract.value?.rentAmount || 0) * cycleMonths.value);

// 费用项列表（兼容新旧格式）
const feeItemList = computed(() => {
  const bc = contract.value?.billingConfig || {};
  if (bc.feeItems && Array.isArray(bc.feeItems)) return bc.feeItems;
  // 旧格式兼容
  const items: { name: string; amount: number; unit: string }[] = [];
  if (Number(bc.waterFee || 0) > 0) items.push({ name: '水费', amount: Number(bc.waterFee), unit: '元/吨' });
  if (Number(bc.electricFee || 0) > 0) items.push({ name: '电费', amount: Number(bc.electricFee), unit: '元/度' });
  if (Number(bc.propertyFee || 0) > 0) items.push({ name: '物业费', amount: Number(bc.propertyFee), unit: '元/㎡/月' });
  return items;
});

const periodFeeTotal = computed(() => {
  return feeItemList.value.reduce((sum: number, fi: { name: string; amount: number; unit: string }) => {
    if (fi.unit === '元/月' || fi.unit === '元/吨' || fi.unit === '元/度' || fi.unit === '元/㎡/月') {
      return sum + Number(fi.amount) * cycleMonths.value;
    }
    return sum + Number(fi.amount);
  }, 0);
});

const periodTotal = computed(() => periodRent.value + periodFeeTotal.value);

function toChinese(n: number): string {
  if (!n || n === 0) return '零元整';
  const units = ['', '拾', '佰', '仟', '万', '拾', '佰', '仟', '亿'];
  const digits = ['零', '壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖'];
  let num = Math.round(n * 100);
  const jiao = num % 100;
  num = Math.floor(num / 100);
  let result = '';
  let unitIdx = 0;
  if (num === 0) result = '零';
  while (num > 0) {
    const d = num % 10;
    if (d !== 0) result = digits[d] + units[unitIdx] + result;
    else if (result && result[0] !== '零') result = '零' + result;
    num = Math.floor(num / 10);
    unitIdx++;
  }
  result = result.replace(/零+$/, '') + '元';
  if (jiao > 0) {
    const j = Math.floor(jiao / 10);
    const f = jiao % 10;
    if (j > 0) result += digits[j] + '角';
    if (f > 0) result += digits[f] + '分';
  } else result += '整';
  return result;
}

const chineseRent = computed(() => toChinese(Number(contract.value?.rentAmount || 0)));
const chinesePeriodRent = computed(() => toChinese(periodRent.value));
const chinesePeriodTotal = computed(() => toChinese(periodTotal.value));

const paymentCycleLabel = computed(() => {
  const map: Record<string, string> = {
    '月': '月付（每月）', '季': '季付（每3个月）', '半年': '半年付（每6个月）',
    '年': '年付（每12个月）', '两年': '两年付（每24个月）', '三年': '三年付（每36个月）', '五年': '五年付（每60个月）',
  };
  return map[contract.value?.paymentCycle] || contract.value?.paymentCycle || '--';
});

const sortedClauses = computed(() => {
  let raw = contract.value?.clauses;
  // SQLite JSON 字段可能返回字符串，安全解析
  if (typeof raw === 'string') {
    try { raw = JSON.parse(raw); } catch { raw = []; }
  }
  const list = (Array.isArray(raw) ? raw : []) as any[];
  return [...list].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
});

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

async function getCompanyInfo() {
  let companyName = '物业租赁管理公司';
  let companyLogo = ''; let companySeal = '';
  try {
    const res = await request.get('/system-configs/keys', { params: { keys: 'company_name_for_print,company_logo,company_seal' } });
    const map: Record<string, string> = {};
    (res.data || []).forEach((c: any) => { map[c.configKey] = c.configValue; });
    if (map['company_name_for_print']) companyName = map['company_name_for_print'];
    if (map['company_logo']) companyLogo = map['company_logo'];
    if (map['company_seal']) companySeal = map['company_seal'];
  } catch { /* use defaults */ }
  return { companyName, companyLogo, companySeal };
}

async function handlePrint(mode: string) {
  if (!contract.value) return;
  try {
    const info = await getCompanyInfo();
    const html = buildContractHTML({
      contractNo: contract.value.contractNo,
      propertyName: contract.value.property?.name || '-',
      propertyAddress: contract.value.property?.address || '',
      propertyArea: contract.value.property?.area || 0,
      tenantName: contract.value.tenant?.name || '-',
      tenantIdType: contract.value.tenant?.idType || '',
      tenantIdNumber: contract.value.tenant?.idNumber || '',
      tenantPhone: contract.value.tenant?.phone || '',
      startDate: contract.value.startDate,
      endDate: contract.value.endDate,
      rentAmount: Number(contract.value.rentAmount || 0),
      depositAmount: Number(contract.value.depositAmount || 0),
      paymentCycle: contract.value.paymentCycle || '-',
      feeItems: feeItemList.value,
      status: contract.value.status || '',
      notes: contract.value.notes || '',
      clauses: sortedClauses.value,
      ...info,
    });
    await printDocument({ title: `租赁合同_${contract.value.contractNo}`, paperSize: 'A4', htmlContent: html, mode: mode as any });
    ElMessage.success(mode === 'native' ? '已发送到打印机' : 'PDF导出成功');
  } catch (e: any) { ElMessage.error(e.message || '打印失败'); }
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
