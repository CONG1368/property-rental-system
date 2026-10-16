<template>
  <div class="contract-draft">
    <h2 class="page-title">{{ isEdit ? '编辑合同' : '起草合同' }}</h2>

    <!-- 基本信息 -->
    <el-card style="margin-bottom:16px">
      <template #header><span>基本信息</span></template>
      <el-form :model="form" label-width="110px">
        <el-row :gutter="16">
          <el-col :span="8"><el-form-item label="合同编号"><el-input v-model="form.contractNo" :disabled="isEdit" /></el-form-item></el-col>
          <el-col :span="8">
            <el-form-item label="房源">
              <el-select v-model="form.propertyId" style="width:100%" placeholder="请选择房源" filterable @change="onPropertyChange">
                <el-option v-for="p in properties" :key="p.id" :label="p.name + ' (' + p.type + ' ' + p.area + '㎡)'" :value="p.id" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="租客">
              <el-select v-model="form.tenantId" style="width:100%" placeholder="请选择租客" filterable>
                <el-option v-for="t in tenants" :key="t.id" :label="t.name + (t.contactPerson ? ' (' + t.contactPerson + ')' : '')" :value="t.id" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="6"><el-form-item label="月租金"><el-input-number v-model="form.rentAmount" :min="0" :precision="2" style="width:100%" /></el-form-item></el-col>
          <el-col :span="6">
            <el-form-item label="押金">
              <div class="amount-row">
                <el-input-number v-model="form.depositAmount" :min="0" :precision="2" style="width:100%" />
              </div>
              <div class="quick-row">
                <span class="quick-label">＝</span>
                <el-input-number v-model="quickMonths.deposit" :min="0" :step="0.5" :precision="2" :controls="false" size="small" style="width:64px" />
                <span class="quick-label">个月租金</span>
                <el-button size="small" text type="primary" @click="fillAmountByRent('deposit')">填入</el-button>
              </div>
              <div v-if="rentMonthsHint(form.depositAmount)" class="amount-months">相当于 {{ rentMonthsHint(form.depositAmount) }} 个月租金（¥{{ Number(form.rentAmount || 0).toFixed(2) }}/月）</div>
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item label="履约违约金">
              <div class="amount-row">
                <el-input-number v-model="form.performancePenalty" :min="0" :precision="2" style="width:100%" />
              </div>
              <div class="quick-row">
                <span class="quick-label">＝</span>
                <el-input-number v-model="quickMonths.penalty" :min="0" :step="0.5" :precision="2" :controls="false" size="small" style="width:64px" />
                <span class="quick-label">个月租金</span>
                <el-button size="small" text type="primary" @click="fillAmountByRent('penalty')">填入</el-button>
              </div>
              <div v-if="rentMonthsHint(form.performancePenalty)" class="amount-months">相当于 {{ rentMonthsHint(form.performancePenalty) }} 个月租金（¥{{ Number(form.rentAmount || 0).toFixed(2) }}/月）</div>
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item label="计费模式">
              <el-select v-model="form.billingMode" style="width:100%"><el-option label="固定" value="固定" /><el-option label="阶梯" value="阶梯" /><el-option label="抽成" value="抽成" /></el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="8">
            <el-form-item label="首期应交租金">
              <el-input-number v-model="form.firstPeriodRent" :min="0" :precision="2" style="width:100%" />
              <div class="quick-row">
                <span class="quick-label">＝</span>
                <el-input-number v-model="quickMonths.period" :min="0" :step="1" :precision="2" :controls="false" size="small" style="width:64px" />
                <span class="quick-label">个月租金</span>
                <el-button size="small" text type="primary" @click="fillAmountByRent('period')">填入</el-button>
              </div>
            </el-form-item>
          </el-col>
          <el-col :span="16">
            <el-form-item label=" ">
              <span style="font-size:12px;color:var(--n-600);line-height:1.6">
                填 0 即自动按「月租金 × 付款周期」＝ ¥{{ autoPeriodRent.toFixed(2) }}；
                几年一起交的可直接填实际金额，或用左侧「N 个月租金」一键填入（月数自己定）。
              </span>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="8"><el-form-item label="开始日期"><el-date-picker v-model="form.startDate" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item></el-col>
          <el-col :span="8"><el-form-item label="结束日期"><el-date-picker v-model="form.endDate" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item></el-col>
          <el-col :span="8">
            <el-form-item label="付款周期">
              <el-select v-model="form.paymentCycle" style="width:100%"><el-option label="月付" value="月" /><el-option label="季付" value="季" /><el-option label="半年付" value="半年" /><el-option label="年付" value="年" /><el-option label="两年付" value="两年" /><el-option label="三年付" value="三年" /><el-option label="五年付" value="五年" /></el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="24">
            <el-form-item label="乙方证件信息">
              <el-switch v-model="writeTenantContact" active-text="写入合同" inactive-text="不写入" />
              <span style="margin-left:10px;font-size:12px;color:var(--n-600)">
                选填：开启后打印合同会在乙方栏、以及合同底部的「乙方签约信息」里写入租客登记的电话与证件信息；关闭或档案里没登记的项目留空供手写。
              </span>
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
    </el-card>

    <!-- 费用配置 -->
    <el-card style="margin-bottom:16px">
      <template #header>
        <span>费用配置</span>
        <el-button size="small" type="primary" style="margin-left:12px" @click="addFeeItem">+ 添加费用项</el-button>
      </template>
      <div v-if="feeItems.length === 0" style="color:var(--n-600);font-size:13px;padding:8px 0">暂无费用项，点击"添加费用项"开始配置</div>
      <div v-for="(item, index) in feeItems" :key="index" style="display:flex;gap:12px;align-items:center;margin-bottom:10px;flex-wrap:wrap">
        <el-select v-model="item.name" placeholder="费用名称" style="width:180px" filterable allow-create clearable>
          <el-option label="月租金" value="月租金" />
          <el-option label="水费" value="水费" />
          <el-option label="电费" value="电费" />
          <el-option label="物业费" value="物业费" />
          <el-option label="空调费" value="空调费" />
          <el-option label="暖气费" value="暖气费" />
          <el-option label="燃气费" value="燃气费" />
          <el-option label="网络费" value="网络费" />
          <el-option label="停车费" value="停车费" />
          <el-option label="垃圾处理费" value="垃圾处理费" />
          <el-option label="电梯费" value="电梯费" />
          <el-option label="公共区域维护费" value="公共区域维护费" />
          <el-option label="保安费" value="保安费" />
          <el-option label="清洁费" value="清洁费" />
          <el-option label="绿化费" value="绿化费" />
          <el-option label="消防维护费" value="消防维护费" />
          <el-option label="装修押金" value="装修押金" />
          <el-option label="其他费用" value="其他费用" />
        </el-select>
        <el-input-number v-model="item.amount" :min="0" :precision="2" style="width:160px" placeholder="金额" />
        <el-select v-model="item.unit" style="width:120px" @change="onFeeUnitChange(item)">
          <el-option label="元/月" value="元/月" />
          <el-option label="元/㎡/月" value="元/㎡/月" />
          <el-option label="元/吨" value="元/吨" />
          <el-option label="元/度" value="元/度" />
          <el-option label="元/次" value="元/次" />
          <el-option label="元/年" value="元/年" />
          <el-option label="元/季" value="元/季" />
          <el-option label="一次性" value="一次性" />
        </el-select>
        <el-input-number v-if="item.unit === '元/㎡/月'" v-model="item.area" :min="0" :precision="2" style="width:150px" placeholder="计费面积" />
        <span v-if="item.unit === '元/㎡/月'" style="font-size:12px;color:var(--n-600)">㎡（默认房源面积，可改）</span>
        <el-button size="small" type="danger" :icon="Delete" circle @click="feeItems.splice(index, 1)" />
      </div>
      <div v-if="selectedProperty" style="font-size:12px;color:var(--n-600);margin-top:4px">
        房源费率参考：水费 {{ selectedProperty.waterFeeRate }}元/吨 | 电费 {{ selectedProperty.electricFeeRate }}元/度 | 物业费 {{ selectedProperty.propertyFeeRate }}元/㎡/月
      </div>
    </el-card>

    <!-- 收款方式 -->
    <el-card style="margin-bottom:16px">
      <template #header><span>收款方式</span></template>
      <el-form-item label="收款方式">
        <el-select v-model="paymentMethod" placeholder="请选择收款方式" @change="onPaymentMethodChange" style="width:100%">
          <el-option label="现金" value="现金" />
          <el-option label="银行汇款" value="银行汇款" />
          <el-option label="微信支付" value="微信支付" />
          <el-option label="支付宝" value="支付宝" />
        </el-select>
      </el-form-item>
      <template v-if="paymentMethod === '银行汇款'">
        <el-row :gutter="16">
          <el-col :span="8">
            <el-form-item label="开户银行"><el-input v-model="bankName" placeholder="如：中国工商银行XX支行" /></el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="银行账号"><el-input v-model="bankAccountNumber" placeholder="收款银行账号" /></el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="收款户名"><el-input v-model="bankAccountName" placeholder="收款账户户名" /></el-form-item>
          </el-col>
        </el-row>
      </template>
    </el-card>

    <!-- 税务信息 -->
    <el-card style="margin-bottom:16px">
      <template #header><span>税务信息</span></template>
      <el-row :gutter="16">
        <el-col :span="8">
          <el-form-item label="价格类型">
            <el-select v-model="taxType" style="width:100%">
              <el-option label="含税" value="含税" />
              <el-option label="不含税" value="不含税" />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item label="税率(%)">
            <el-input-number v-model="taxRate" :min="0" :max="17" :precision="1" :step="0.5" style="width:100%" />
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item label="发票类型">
            <el-select v-model="invoiceType" style="width:100%">
              <el-option label="增值税普通发票" value="增值税普通发票" />
              <el-option label="增值税专用发票" value="增值税专用发票" />
              <el-option label="收据" value="收据" />
              <el-option label="不开票" value="不开票" />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>
    </el-card>

    <!-- 合同细则 -->
    <el-card style="margin-bottom:16px">
      <template #header><span>合同细则</span></template>
      <el-row :gutter="16">
        <el-col :span="8">
          <el-form-item label="维修责任">
            <el-select v-model="maintenanceParty" style="width:100%">
              <el-option label="甲方（出租方）" value="甲方" />
              <el-option label="乙方（承租方）" value="乙方" />
              <el-option label="双方按约定" value="按约定" />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item label="允许转租">
            <el-switch v-model="subletAllowed" active-text="允许" inactive-text="禁止" />
          </el-form-item>
        </el-col>
      </el-row>
      <el-row :gutter="16">
        <el-col :span="8">
          <el-form-item label="解约通知期(天)">
            <el-input-number v-model="terminationNotice" :min="0" :max="365" style="width:100%" />
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item label="续约通知期(天)">
            <el-input-number v-model="renewalNotice" :min="0" :max="365" style="width:100%" />
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item label="押金退还条件">
            <el-input v-model="depositTerms" placeholder="如：退租验房无误后15日内无息退还" />
          </el-form-item>
        </el-col>
      </el-row>
    </el-card>

    <!-- 消防安全约定 -->
    <el-card style="margin-bottom:16px">
      <template #header><span>消防安全约定</span></template>
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="消防责任方">
            <el-radio-group v-model="fireResponsibilityParty" size="small">
              <el-radio-button value="甲方">甲方</el-radio-button>
              <el-radio-button value="乙方">乙方</el-radio-button>
              <el-radio-button value="双方">双方</el-radio-button>
            </el-radio-group>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="检查频率">
            <el-select v-model="fireInspectionFrequency" size="small" style="width:100%">
              <el-option label="每月" value="每月" />
              <el-option label="每季" value="每季" />
              <el-option label="每半年" value="每半年" />
              <el-option label="每年" value="每年" />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>
      <!-- 消防条款 -->
      <div style="margin-top:12px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
          <span style="font-size:13px;font-weight:bold;color:var(--n-900)">消防条款</span>
          <el-button size="small" type="primary" text @click="addFireClause">+ 添加</el-button>
        </div>
        <div v-for="(c,i) in fireSafetyClauses" :key="i" style="margin-bottom:8px;padding:10px;border:1px solid var(--n-200);border-radius:4px">
          <div style="display:flex;gap:8px;margin-bottom:6px">
            <el-input v-model="c.title" placeholder="条款标题" size="small" style="flex:1" />
            <el-button size="small" type="danger" @click="removeFireClause(i)">删除</el-button>
          </div>
          <el-input v-model="c.content" type="textarea" :rows="2" placeholder="条款内容" size="small" />
        </div>
        <el-empty v-if="fireSafetyClauses.length === 0" description="暂无消防条款，点击添加" :image-size="30" />
      </div>
      <!-- 消防限制 -->
      <div style="margin-top:16px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
          <span style="font-size:13px;font-weight:bold;color:var(--n-900)">禁止事项</span>
          <el-button size="small" type="danger" text @click="addFireRestriction">+ 添加</el-button>
        </div>
        <div v-for="(r,i) in fireSafetyRestrictions" :key="i" style="display:flex;gap:8px;margin-bottom:6px;align-items:center">
          <el-input v-model="fireSafetyRestrictions[i]" placeholder="禁止事项内容" size="small" style="flex:1" />
          <el-button size="small" type="danger" @click="removeFireRestriction(i)">删除</el-button>
        </div>
        <el-empty v-if="fireSafetyRestrictions.length === 0" description="暂无禁止事项，点击添加" :image-size="30" />
      </div>
      <!-- 消防器材 -->
      <div style="margin-top:16px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
          <span style="font-size:13px;font-weight:bold;color:var(--n-900)">消防器材要求</span>
          <el-button size="small" type="success" text @click="addFireEquipment">+ 添加</el-button>
        </div>
        <div v-for="(e,i) in fireSafetyEquipment" :key="i" style="display:flex;gap:8px;margin-bottom:6px;align-items:center">
          <el-input v-model="fireSafetyEquipment[i]" placeholder="器材名称，如：4kg干粉灭火器×2具" size="small" style="flex:1" />
          <el-button size="small" type="danger" @click="removeFireEquipment(i)">删除</el-button>
        </div>
        <el-empty v-if="fireSafetyEquipment.length === 0" description="暂无消防器材要求，点击添加" :image-size="30" />
      </div>
      <!-- 违规处罚 -->
      <el-form-item label="违规处罚措施" style="margin-top:16px">
        <el-input v-model="fireViolationPenalty" type="textarea" :rows="2" placeholder="如：逾期未整改的，每项每日收取违约金200元；累计3次未整改的，甲方有权解除合同。" />
      </el-form-item>
    </el-card>

    <!-- 合同模板选择 -->
    <el-card style="margin-bottom:16px">
      <template #header><span>合同条款模板</span></template>
      <el-form-item label="选择模板">
        <el-select v-model="form.templateId" placeholder="选择合同模板（可选）" clearable @change="onTemplateChange" style="width:100%">
          <el-option v-for="t in templates" :key="t.id" :label="t.name" :value="t.id" />
        </el-select>
      </el-form-item>
    </el-card>

    <!-- 合同条款编辑 -->
    <el-card style="margin-bottom:16px">
      <template #header>
        <span>合同条款</span>
        <el-button size="small" type="primary" style="margin-left:12px" @click="addClause">添加条款</el-button>
      </template>
      <div v-for="(clause, index) in clauses" :key="index" style="margin-bottom:12px;padding:12px;border:1px solid var(--n-200);border-radius:4px">
        <div style="display:flex;gap:8px;margin-bottom:8px">
          <el-input v-model="clause.title" placeholder="条款标题" style="flex:1" size="small" />
          <el-input-number v-model="clause.sortOrder" :min="0" size="small" style="width:80px" placeholder="排序" />
          <el-button size="small" type="danger" @click="clauses.splice(index, 1)">删除</el-button>
        </div>
        <el-input v-model="clause.content" type="textarea" :rows="3" placeholder="条款内容" />
      </div>
      <el-empty v-if="clauses.length === 0" description="暂无条款：可手动添加、选模板或导入条款文档；留空则合同不打印条款章节（系统不会再自动补条款）" :image-size="40" />
    </el-card>

    <!-- 合同附件（保存后可用） -->
    <el-card style="margin-top:16px" v-if="savedContractId">
      <template #header>
        <span>合同附件</span>
        <el-upload
          :action="apiBaseURL + '/contracts/' + savedContractId + '/upload'"
          :headers="uploadHeaders"
          name="files"
          multiple
          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xls,.xlsx"
          :show-file-list="false"
          :on-success="onUploadSuccess"
          :on-error="onUploadError"
          :before-upload="() => { uploading = true }"
          style="display:inline-block;margin-left:16px"
        >
          <el-button size="small" type="primary" :loading="uploading">上传文件</el-button>
        </el-upload>
        <span style="font-size:12px;color:var(--n-600);margin-left:8px">PDF / Word / 图片 / Excel</span>
      </template>
      <DataTable :data="attachments" :columns="COLUMNS" row-key="id" empty-title="暂无数据" empty-description="调整筛选条件或新增记录后，数据会显示在这里">
        <template #c2="{ row }">
          <span v-if="row.title">{{ row.title }}</span>
          <span v-else style="color:var(--n-600);font-size:12px">未设置（打印用文件名）</span>
        </template>
        <template #c3="{ row }">{{ formatFileSize(row.size) }}</template>
        <template #c4="{ row }">{{ row.uploadedAt?.slice(0, 16)?.replace('T', ' ') }}</template>
        <template #c5="{ row }">
          <el-button link type="primary" size="small" @click="editAttachmentTitle(row)">编辑标题</el-button>
        </template>
      </DataTable>
    </el-card>

    <el-button type="primary" style="margin-top:16px" @click="handleSave">保存草稿</el-button>
    <el-button type="success" style="margin-top:16px" @click="handleSubmit">提交审批</el-button>
  </div>
</template>

<script setup lang="ts">
import DataTable from '@/components/base/DataTable.vue';
import type { TableColumn } from '@/components/base/types';

const COLUMNS: TableColumn[] = [
  { prop: 'name', label: '文件名', minWidth: 200, tooltip: true },
  // 附件标题/备注（用户 2026-10-16 要求）：打印「附件清单」时优先显示标题
  { prop: 'title', label: '附件标题/备注', minWidth: 180, tooltip: true, slot: 'c2' },
  { label: '大小', width: 100, slot: 'c3' },
  { prop: 'uploadedAt', label: '上传时间', width: 170, slot: 'c4' },
  { label: '操作', width: 110, slot: 'c5' },
];

import { ref, computed, reactive, watch, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Delete } from '@element-plus/icons-vue';
import request, { apiBaseURL } from '@/api/request';

const route = useRoute(); const router = useRouter();
const isEdit = computed(() => !!route.params.id);
const savedContractId = computed(() => route.params.id ? Number(route.params.id) : null);

const properties = ref<any[]>([]);
const tenants = ref<any[]>([]);
const templates = ref<any[]>([]);
const clauses = ref<{ title: string; content: string; sortOrder: number }[]>([]);

// 附件上传
const uploadHeaders = computed(() => ({ Authorization: 'Bearer ' + localStorage.getItem('accessToken') }));
const attachments = ref<any[]>([]);
const uploading = ref(false);

function formatFileSize(bytes: number) {
  if (!bytes) return '0 B';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

async function fetchAttachments() {
  if (!savedContractId.value) return;
  try {
    const res = await request.get('/contracts/' + savedContractId.value + '/files');
    attachments.value = res.data?.list || [];
  } catch { /* ignore */ }
}

// 附件标题/备注（用户 2026-10-16 要求）：标题会显示在打印合同的「附件清单」里，留空则用文件名
async function editAttachmentTitle(row: any) {
  try {
    const { value } = await ElMessageBox.prompt(
      '标题/备注会打印在合同的「附件清单」里（例如把 scan_2026.pdf 显示成「房屋交接单」）。留空则回退用文件名。',
      '设置附件标题',
      { inputValue: row.title || '', inputPlaceholder: '如：房屋交接单', confirmButtonText: '保存', cancelButtonText: '取消' },
    );
    const res: any = await request.put('/contracts/' + savedContractId.value + '/files/title', { path: row.path, title: String(value || '').trim() });
    ElMessage.success(res.message || '附件标题已保存');
    await fetchAttachments();
  } catch (err: any) {
    if (err === 'cancel' || err === 'close') return;
    if (err?.response?.data?.message) ElMessage.error(err.response.data.message);
  }
}

function onUploadSuccess(res: any) {
  uploading.value = false;
  if (res.code === 200) {
    ElMessage.success(`成功上传 ${res.data?.length ?? ''} 个文件`);
    fetchAttachments();
  }
}
function onUploadError(err: any) {
  uploading.value = false;
  ElMessage.error(err?.message || '上传失败');
}

const form = reactive({
  contractNo: 'HT-' + Date.now(),
  propertyId: null as number | null,
  tenantId: null as number | null,
  templateId: null as number | null,
  rentAmount: 0, depositAmount: 0,
  // 履约违约金：与押金一样完全自定义，不写死（用户 2026-10-10 要求）
  performancePenalty: 0,
  // 首期应交租金：0＝自动按「月租金 × 付款周期」；可自定义填实际一次性收取的租金（几年一起交）
  firstPeriodRent: 0,
  billingMode: '固定', paymentCycle: '月',
  startDate: new Date().toISOString().split('T')[0],
  endDate: new Date(Date.now() + 365*24*60*60*1000).toISOString().split('T')[0],
});

// 押金 / 履约违约金的「按 N 个月租金」快捷换算：月数由用户自定义（用户 2026-10-10 要求），默认 1 个月
const quickMonths = reactive({ deposit: 1, penalty: 1, period: 12 });

// area：计费面积（仅「元/㎡/月」用，默认取所选房源建筑面积，可手动改——用户 2026-10-10 要求不能写死）
interface FeeItem { name: string; amount: number; unit: string; area?: number; }

const feeItems = ref<FeeItem[]>([]);

// 收款方式
const paymentMethod = ref('');
const bankName = ref('');
const bankAccountNumber = ref('');
const bankAccountName = ref('');

// 税务信息
const taxType = ref('含税');
const taxRate = ref(5);
const invoiceType = ref('增值税普通发票');

// 合同细则（原「违约金比例」已移除，改为基本信息里的「履约违约金」金额，用户 2026-10-10 要求）
const depositTerms = ref('');
const maintenanceParty = ref('甲方');
const terminationNotice = ref(30);
const renewalNotice = ref(30);
const subletAllowed = ref(false);

// 乙方证件信息与联系方式是否写入合同（用户 2026-10-10 要求）：
// 新草稿默认关闭（不写入）；老合同 billingConfig 里没存过该键时按老行为处理（写入）
const writeTenantContact = ref(false);

// 消防约定
const fireSafetyClauses = ref<{ title: string; content: string }[]>([]);
const fireSafetyRestrictions = ref<string[]>([]);
const fireSafetyEquipment = ref<string[]>([]);
const fireResponsibilityParty = ref('双方');
const fireInspectionFrequency = ref('每季');
const fireViolationPenalty = ref('');

function addFireClause() { fireSafetyClauses.value.push({ title: '', content: '' }); }
function removeFireClause(i: number) { fireSafetyClauses.value.splice(i, 1); }
function addFireRestriction() { fireSafetyRestrictions.value.push(''); }
function removeFireRestriction(i: number) { fireSafetyRestrictions.value.splice(i, 1); }
function addFireEquipment() { fireSafetyEquipment.value.push(''); }
function removeFireEquipment(i: number) { fireSafetyEquipment.value.splice(i, 1); }

function onPaymentMethodChange(val: string) {
  if (val !== '银行汇款') {
    bankName.value = '';
    bankAccountNumber.value = '';
    bankAccountName.value = '';
  }
}

function addFeeItem() {
  feeItems.value.push({ name: '', amount: 0, unit: '元/月', area: 0 });
}

// 切到「元/㎡/月」时自动带入房源建筑面积作为计费面积（用户可再改）
function onFeeUnitChange(item: FeeItem) {
  if (item.unit === '元/㎡/月' && !Number(item.area || 0)) {
    item.area = Number(selectedProperty.value?.area || 0);
  }
}

// 押金 / 履约违约金：按「N 个月租金」一键换算填充，N 由用户自定义（0.5 / 1 / 1.5 / 2 …）；
// 金额本身始终可以再手动改成任意值——两者都不写死
function fillAmountByRent(target: 'deposit' | 'penalty' | 'period') {
  const rent = Number(form.rentAmount || 0);
  if (!rent) { ElMessage.warning('请先填写月租金'); return; }
  const months = Number(quickMonths[target] || 0);
  if (months <= 0) { ElMessage.warning('请填写月数'); return; }
  const amount = Number((rent * months).toFixed(2));
  if (target === 'deposit') form.depositAmount = amount;
  else if (target === 'penalty') form.performancePenalty = amount;
  else form.firstPeriodRent = amount;
}

// 金额相当于几个月租金（月租金为 0 或金额为 0 时返回空串）：告诉承租人这两笔各是多少
function rentMonthsHint(amount: number | null | undefined) {
  const rent = Number(form.rentAmount || 0);
  const value = Number(amount || 0);
  if (!rent || !value) return '';
  return Number((value / rent).toFixed(2));
}

const selectedProperty = computed(() => properties.value.find(p => p.id === form.propertyId));

// 付款周期 → 月数（与合同打印模板保持一致），用于首期应交租金的自动值
const CYCLE_MONTHS: Record<string, number> = { '月': 1, '季': 3, '半年': 6, '年': 12, '两年': 24, '三年': 36, '五年': 60 };
// 首期应交租金的自动值：留空（0）时按「月租金 × 付款周期月数」计算
const autoPeriodRent = computed(() => Number(form.rentAmount || 0) * (CYCLE_MONTHS[form.paymentCycle] || 1));

// 监听租客切换 → 自动加载待处理条款（来自条款批量导入）
watch(() => form.tenantId, () => {
  loadPendingClausesForCurrentTenant();
});

function onPropertyChange(propId: number | null) {
  if (propId) {
    const p = properties.value.find(p => p.id === propId);
    if (p) {
      // 根据房源费率参考自动填充费用项（仅当费用列表为空时）
      if (feeItems.value.length === 0) {
        if (Number(p.waterFeeRate || 0) > 0) feeItems.value.push({ name: '水费', amount: Number(p.waterFeeRate || 0), unit: '元/吨' });
        if (Number(p.electricFeeRate || 0) > 0) feeItems.value.push({ name: '电费', amount: Number(p.electricFeeRate || 0), unit: '元/度' });
        if (Number(p.propertyFeeRate || 0) > 0) feeItems.value.push({ name: '物业费', amount: Number(p.propertyFeeRate || 0), unit: '元/㎡/月', area: Number(p.area || 0) });
      }
      // 自动匹配模板类型
      if (!form.templateId && p.type) {
        const propType = p.type; const targetName = `常用条款模板-`; const match = templates.value.find((t: any) => (t as any).isDefault && t.type === propType) || templates.value.find((t: any) => t.name === targetName) || templates.value.find((t: any) => t.type === propType);
        if (match) { form.templateId = match.id; onTemplateChange(match.id); }
      }
    }
  }
}

async function fetchTemplates() {
  try {
    const res = await request.get('/contract-templates');
    templates.value = res.data?.list || [];
  } catch { /* ignore */ }
}

async function loadPendingClausesForCurrentTenant() {
  const tenantId = form.tenantId;
  if (!tenantId) return;
  try {
    const res = await request.get('/tenants/' + tenantId);
    let raw = res.data?.pendingClauses || [];
    if (typeof raw === 'string') { try { raw = JSON.parse(raw); } catch { raw = []; } }
    const pending: any[] = Array.isArray(raw) ? raw : [];
    if (pending.length === 0) return;
    const existingKeys = new Set(clauses.value.map(c => `${c.title}|||${c.content}`));
    const newClauses = pending.filter((c: any) => !existingKeys.has(`${c.title||''}|||${c.content||''}`));
    if (newClauses.length > 0) {
      clauses.value.push(...newClauses.map((c: any) => ({
        title: c.title || '', content: c.content || '', sortOrder: c.sortOrder || clauses.value.length,
      })));
      ElMessage.success(`已自动加载 ${newClauses.length} 条待处理条款（来自批量导入）`);
    }
  } catch { /* ignore */ }
}

async function onTemplateChange(templateId: number | null) {
  if (!templateId) { clauses.value = []; return; }
  try {
    const res = await request.get('/contract-templates/' + templateId);
    const template = res.data;
    if (!template) { ElMessage.warning('模板数据为空'); return; }

    // 同步条款
    const templateClauses = (template.clauses || []).map((c: any) => ({
      title: c.title || '',
      content: c.content || '',
      sortOrder: c.sortOrder || 0,
    }));
    clauses.value = templateClauses.length > 0 ? templateClauses : [{ title: '', content: '', sortOrder: 0 }];

    // 同步模板内容到费用配置（如果模板 content 中包含默认费用项）
    if (template.content?.feeItems && Array.isArray(template.content.feeItems) && feeItems.value.length === 0) {
      feeItems.value = template.content.feeItems.map((fi: any) => ({
        name: fi.name || '',
        amount: Number(fi.amount || 0),
        unit: fi.unit || '元/月',
      }));
    }
    // 同步模板中的默认租金/押金（如果表单尚未填写）
    if (template.content?.defaultRent && !form.rentAmount) form.rentAmount = Number(template.content.defaultRent);
    if (template.content?.defaultDeposit && !form.depositAmount) form.depositAmount = Number(template.content.defaultDeposit);
    if (template.content?.defaultPaymentCycle && form.paymentCycle === '月') form.paymentCycle = template.content.defaultPaymentCycle;

    // 同步消防默认值
    if (template.content?.fireSafetyDefaults) {
      const fsd = template.content.fireSafetyDefaults;
      if (fsd.clauses && fireSafetyClauses.value.length === 0) fireSafetyClauses.value = fsd.clauses.map((c: any) => ({ title: c.title || '', content: c.content || '' }));
      if (fsd.restrictions && fireSafetyRestrictions.value.length === 0) fireSafetyRestrictions.value = [...fsd.restrictions];
      if (fsd.equipment && fireSafetyEquipment.value.length === 0) fireSafetyEquipment.value = [...fsd.equipment];
      if (fsd.responsibilityParty && fireResponsibilityParty.value === '双方') fireResponsibilityParty.value = fsd.responsibilityParty;
      if (fsd.inspectionFrequency && fireInspectionFrequency.value === '每季') fireInspectionFrequency.value = fsd.inspectionFrequency;
      if (fsd.violationPenalty && !fireViolationPenalty.value) fireViolationPenalty.value = fsd.violationPenalty;
    }

    // 模板加载后，追加该租客的待处理条款
    await loadPendingClausesForCurrentTenant();

    ElMessage.success(`已加载模板「${template.name}」(${templateClauses.length}条条款)`);
  } catch (e: any) {
    ElMessage.error('加载模板条款失败: ' + (e?.message || '未知错误'));
  }
}

function addClause() {
  clauses.value.push({ title: '', content: '', sortOrder: clauses.value.length });
}

function buildBillingConfig() {
  return {
    feeItems: feeItems.value,
    paymentMethod: paymentMethod.value,
    bankName: bankName.value,
    bankAccountNumber: bankAccountNumber.value,
    bankAccountName: bankAccountName.value,
    taxType: taxType.value,
    taxRate: taxRate.value,
    invoiceType: invoiceType.value,
    depositTerms: depositTerms.value,
    maintenanceParty: maintenanceParty.value,
    terminationNotice: terminationNotice.value,
    renewalNotice: renewalNotice.value,
    subletAllowed: subletAllowed.value,
    // 乙方证件信息/联系方式是否写入合同（用户 2026-10-10 要求）
    partyBContact: writeTenantContact.value,
    fireSafety: {
      clauses: fireSafetyClauses.value,
      restrictions: fireSafetyRestrictions.value.filter(r => r.trim()),
      equipment: fireSafetyEquipment.value.filter(e => e.trim()),
      responsibilityParty: fireResponsibilityParty.value,
      inspectionFrequency: fireInspectionFrequency.value,
      violationPenalty: fireViolationPenalty.value,
    },
  };
}

async function handleSave() {
  try {
    // 条款去重：按 title + content 去重，保留第一条
    const seen = new Set<string>();
    const dedupedClauses = clauses.value.filter(c => {
      const key = `${c.title}|||${c.content}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    const payload = { ...form, billingConfig: buildBillingConfig(), clauses: dedupedClauses };
    if (isEdit.value) {
      await request.put('/contracts/' + route.params.id, payload);
      ElMessage.success('草稿已保存');
    } else {
      const res = await request.post('/contracts', payload);
      ElMessage.success('合同创建成功');
      router.push('/contract/draft/' + res.data.id);
    }
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || '保存失败');
  }
}

async function handleSubmit() {
  try {
    let id = route.params.id;
    if (!id) {
      const seen = new Set<string>();
      const dedupedClauses = clauses.value.filter(c => {
        const key = `${c.title}|||${c.content}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      const payload = { ...form, billingConfig: buildBillingConfig(), clauses: dedupedClauses };
      const res = await request.post('/contracts', payload);
      id = res.data.id;
    }
    await request.post('/contracts/' + id + '/submit');
    ElMessage.success('已提交审批');
    router.push('/contract/list');
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || '提交失败');
  }
}

onMounted(async () => {
  try {
    const [propRes, tenantRes] = await Promise.all([
      request.get('/properties', { params: { pageSize: 200 } }),
      request.get('/tenants', { params: { pageSize: 200 } }),
    ]);
    properties.value = propRes.data.list || [];
    tenants.value = tenantRes.data.list || [];
  } catch {}
  fetchTemplates();

  // 新建合同：自动保存草稿以获得合同ID，使附件上传区立即可用
  if (!isEdit.value) {
    try {
      const res = await request.post('/contracts', {
        contractNo: form.contractNo,
        propertyId: properties.value[0]?.id || 0,
        tenantId: tenants.value[0]?.id || 0,
        // 新草稿显式落 partyBContact:false（默认不写入乙方证件与联系方式）
        billingConfig: { partyBContact: false }, clauses: [],
        rentAmount: 0, depositAmount: 0, performancePenalty: 0, firstPeriodRent: 0,
        paymentCycle: '月', billingMode: '固定',
        startDate: form.startDate, endDate: form.endDate || new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
      });
      router.replace('/contract/draft/' + res.data.id);
      return; // replace 触发组件重新挂载，走 isEdit 分支
    } catch { /* 静默失败，用户可手动保存 */ }
  }

  fetchAttachments();

  if (isEdit.value) {
    try {
      const res = await request.get('/contracts/' + route.params.id);
      const d = res.data;
      Object.assign(form, {
        contractNo: d.contractNo,
        propertyId: d.propertyId,
        tenantId: d.tenantId,
        templateId: d.templateId || null,
        rentAmount: d.rentAmount,
        depositAmount: d.depositAmount,
        performancePenalty: Number(d.performancePenalty ?? 0),
        firstPeriodRent: Number(d.firstPeriodRent ?? 0),
        billingMode: d.billingMode,
        paymentCycle: d.paymentCycle,
        startDate: d.startDate,
        endDate: d.endDate,
      });
      // 快捷月数回显：按已保存金额折算（月租金或金额为 0 时保持 1 个月）
      const rentForQuick = Number(d.rentAmount || 0);
      quickMonths.deposit = rentForQuick > 0 && Number(d.depositAmount) > 0 ? Number((Number(d.depositAmount) / rentForQuick).toFixed(2)) : 1;
      quickMonths.penalty = rentForQuick > 0 && Number(d.performancePenalty) > 0 ? Number((Number(d.performancePenalty) / rentForQuick).toFixed(2)) : 1;
      quickMonths.period = rentForQuick > 0 && Number(d.firstPeriodRent) > 0 ? Number((Number(d.firstPeriodRent) / rentForQuick).toFixed(2)) : (CYCLE_MONTHS[d.paymentCycle] || 1);
      const bc = d.billingConfig || {};
      // 加载费用项（兼容旧格式和新格式）
      if (bc.feeItems && Array.isArray(bc.feeItems)) {
        feeItems.value = bc.feeItems.map((fi: any) => ({
          name: fi.name || '', amount: Number(fi.amount || 0), unit: fi.unit || '元/月',
        }));
      } else {
        // 兼容旧格式：从固定字段迁移
        const items: FeeItem[] = [];
        if (Number(bc.waterFee || 0) > 0) items.push({ name: '水费', amount: Number(bc.waterFee || 0), unit: '元/月' });
        if (Number(bc.electricFee || 0) > 0) items.push({ name: '电费', amount: Number(bc.electricFee || 0), unit: '元/月' });
        if (Number(bc.propertyFee || 0) > 0) items.push({ name: '物业费', amount: Number(bc.propertyFee || 0), unit: '元/月' });
        if (Number(bc.factoryArea || 0) > 0) items.push({ name: '出租面积', amount: Number(bc.factoryArea || 0), unit: '㎡' });
        feeItems.value = items;
      }
      // 加载收款方式
      paymentMethod.value = bc.paymentMethod || '';
      bankName.value = bc.bankName || '';
      bankAccountNumber.value = bc.bankAccountNumber || '';
      bankAccountName.value = bc.bankAccountName || '';
      // 加载税务信息
      taxType.value = bc.taxType || '含税';
      taxRate.value = bc.taxRate ?? 5;
      invoiceType.value = bc.invoiceType || '增值税普通发票';
      // 加载合同细则
      depositTerms.value = bc.depositTerms || '';
      maintenanceParty.value = bc.maintenanceParty || '甲方';
      terminationNotice.value = bc.terminationNotice ?? 30;
      renewalNotice.value = bc.renewalNotice ?? 30;
      subletAllowed.value = bc.subletAllowed ?? false;
      // partyBContact 没存过（老合同）→ 保持原有行为：仍然写入乙方证件与联系方式
      writeTenantContact.value = bc.partyBContact === undefined ? true : bc.partyBContact === true;
      // 加载消防约定
      if (bc.fireSafety) {
        const fs = bc.fireSafety;
        fireSafetyClauses.value = fs.clauses || [];
        fireSafetyRestrictions.value = fs.restrictions || [];
        fireSafetyEquipment.value = fs.equipment || [];
        fireResponsibilityParty.value = fs.responsibilityParty || '双方';
        fireInspectionFrequency.value = fs.inspectionFrequency || '每季';
        fireViolationPenalty.value = fs.violationPenalty || '';
      }
      let rawClauses = d.clauses;
      if (typeof rawClauses === 'string') {
        try { rawClauses = JSON.parse(rawClauses); } catch { rawClauses = []; }
      }
      clauses.value = (Array.isArray(rawClauses) ? rawClauses : []).map((c: any) => ({
        title: c.title || '',
        content: c.content || '',
        sortOrder: c.sortOrder || 0,
      }));
      // 加载合同数据后，追加该租客的待处理条款
      await loadPendingClausesForCurrentTenant();
    } catch (e: any) {
      ElMessage.error(e?.response?.data?.message || '加载合同数据失败');
    }
  }
});
</script>

<style lang="scss" scoped>
.page-title { font-size: 18px; font-weight: 700; color: $n-900; margin-bottom: 16px; }
.amount-row { display: flex; align-items: center; gap: 6px; width: 100%; }
.quick-row { display: flex; align-items: center; gap: 4px; margin-top: 2px; line-height: 1; }
.quick-label { font-size: 12px; color: $n-600; }
.amount-months { font-size: 12px; color: $n-600; line-height: 1.6; margin-top: 2px; }
</style>
