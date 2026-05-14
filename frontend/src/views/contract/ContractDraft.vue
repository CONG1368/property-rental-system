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
          <el-col :span="8"><el-form-item label="月租金"><el-input-number v-model="form.rentAmount" :min="0" :precision="2" style="width:100%" /></el-form-item></el-col>
          <el-col :span="8"><el-form-item label="押金"><el-input-number v-model="form.depositAmount" :min="0" :precision="2" style="width:100%" /></el-form-item></el-col>
          <el-col :span="8">
            <el-form-item label="计费模式">
              <el-select v-model="form.billingMode" style="width:100%"><el-option label="固定" value="固定" /><el-option label="阶梯" value="阶梯" /><el-option label="抽成" value="抽成" /></el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="8"><el-form-item label="开始日期"><el-date-picker v-model="form.startDate" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item></el-col>
          <el-col :span="8"><el-form-item label="结束日期"><el-date-picker v-model="form.endDate" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item></el-col>
          <el-col :span="8">
            <el-form-item label="付款周期">
              <el-select v-model="form.paymentCycle" style="width:100%"><el-option label="月" value="月" /><el-option label="季" value="季" /><el-option label="年" value="年" /></el-select>
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
    </el-card>

    <!-- 费用配置 -->
    <el-card style="margin-bottom:16px">
      <template #header><span>费用配置（水费 / 电费 / 物业费）</span></template>
      <el-form :model="form" label-width="110px">
        <el-row :gutter="16">
          <el-col :span="8">
            <el-form-item label="水费(元/月)">
              <el-input-number v-model="feeConfig.waterFee" :min="0" :precision="2" style="width:100%" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="电费(元/月)">
              <el-input-number v-model="feeConfig.electricFee" :min="0" :precision="2" style="width:100%" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="物业费(元/月)">
              <el-input-number v-model="feeConfig.propertyFee" :min="0" :precision="2" style="width:100%" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16" v-if="selectedProperty?.type === '厂房'">
          <el-col :span="8">
            <el-form-item label="出租面积(㎡)">
              <el-input-number v-model="feeConfig.factoryArea" :min="0" :precision="2" style="width:100%" />
              <span style="font-size:11px;color:#909399">厂房总面积 {{ selectedProperty?.area }}㎡</span>
            </el-form-item>
          </el-col>
        </el-row>
        <div style="font-size:12px;color:#909399;margin-top:4px">
          <template v-if="selectedProperty">
            参考：水费 {{ selectedProperty.waterFeeRate }}元/吨 | 电费 {{ selectedProperty.electricFeeRate }}元/度 | 物业费 {{ selectedProperty.propertyFeeRate }}元/㎡/月
          </template>
        </div>
      </el-form>
    </el-card>

    <el-button type="primary" style="margin-top:16px" @click="handleSave">保存草稿</el-button>
    <el-button type="success" style="margin-top:16px" @click="handleSubmit">提交审批</el-button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import request from '@/api/request';

const route = useRoute(); const router = useRouter();
const isEdit = computed(() => !!route.params.id);

const properties = ref<any[]>([]);
const tenants = ref<any[]>([]);

const form = reactive({
  contractNo: 'HT-' + Date.now(),
  propertyId: null as number | null,
  tenantId: null as number | null,
  rentAmount: 0, depositAmount: 0,
  billingMode: '固定', paymentCycle: '月',
  startDate: new Date().toISOString().split('T')[0],
  endDate: new Date(Date.now() + 365*24*60*60*1000).toISOString().split('T')[0],
});

const feeConfig = reactive({
  waterFee: 0,
  electricFee: 0,
  propertyFee: 0,
  factoryArea: 0,
});

const selectedProperty = computed(() => properties.value.find(p => p.id === form.propertyId));

function onPropertyChange(propId: number | null) {
  if (propId) {
    const p = properties.value.find(p => p.id === propId);
    if (p) {
      feeConfig.waterFee = Number(p.waterFeeRate || 0);
      feeConfig.electricFee = Number(p.electricFeeRate || 0);
      feeConfig.propertyFee = Number(p.propertyFeeRate || 0);
    }
  }
}

function buildBillingConfig() {
  return {
    waterFee: feeConfig.waterFee,
    electricFee: feeConfig.electricFee,
    propertyFee: feeConfig.propertyFee,
    factoryArea: feeConfig.factoryArea,
  };
}

async function handleSave() {
  try {
    const payload = { ...form, billingConfig: buildBillingConfig() };
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
      const payload = { ...form, billingConfig: buildBillingConfig() };
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

  if (isEdit.value) {
    try {
      const res = await request.get('/contracts/' + route.params.id);
      const d = res.data;
      Object.assign(form, {
        contractNo: d.contractNo,
        propertyId: d.propertyId,
        tenantId: d.tenantId,
        rentAmount: d.rentAmount,
        depositAmount: d.depositAmount,
        billingMode: d.billingMode,
        paymentCycle: d.paymentCycle,
        startDate: d.startDate,
        endDate: d.endDate,
      });
      const bc = d.billingConfig || {};
      feeConfig.waterFee = Number(bc.waterFee || 0);
      feeConfig.electricFee = Number(bc.electricFee || 0);
      feeConfig.propertyFee = Number(bc.propertyFee || 0);
      feeConfig.factoryArea = Number(bc.factoryArea || 0);
    } catch (e: any) {
      ElMessage.error(e?.response?.data?.message || '加载合同数据失败');
    }
  }
});
</script>

<style lang="scss" scoped>
.page-title { font-size: 18px; font-weight: 700; color: #0A3D62; margin-bottom: 16px; }
</style>
