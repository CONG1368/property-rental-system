<template>
  <div class="contract-draft">
    <h2 class="page-title">{{ isEdit ? '编辑合同' : '起草合同' }}</h2>
    <el-card>
      <el-form :model="form" ref="formRef" label-width="110px">
        <el-row :gutter="16">
          <el-col :span="8"><el-form-item label="合同编号"><el-input v-model="form.contractNo" /></el-form-item></el-col>
          <el-col :span="8"><el-form-item label="房源ID"><el-input-number v-model="form.propertyId" :min="1" style="width:100%" /></el-form-item></el-col>
          <el-col :span="8"><el-form-item label="租客ID"><el-input-number v-model="form.tenantId" :min="1" style="width:100%" /></el-form-item></el-col>
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
          <el-col :span="8"><el-form-item label="开始日期"><el-date-picker v-model="form.startDate" type="date" style="width:100%" /></el-form-item></el-col>
          <el-col :span="8"><el-form-item label="结束日期"><el-date-picker v-model="form.endDate" type="date" style="width:100%" /></el-form-item></el-col>
          <el-col :span="8">
            <el-form-item label="付款周期">
              <el-select v-model="form.paymentCycle" style="width:100%"><el-option label="月" value="月" /><el-option label="季" value="季" /><el-option label="年" value="年" /></el-select>
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
    </el-card>
    <el-button type="primary" style="margin-top:16px" @click="handleSave">保存草稿</el-button>
    <el-button type="success" style="margin-top:16px" @click="handleSubmit">提交审批</el-button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import request from '@/api/request';

const route = useRoute(); const router = useRouter();
const isEdit = computed(() => !!route.params.id);

const form = ref({
  contractNo: 'HT-' + Date.now(),
  propertyId: 1, tenantId: 1,
  rentAmount: 0, depositAmount: 0,
  billingMode: '固定', paymentCycle: '月',
  startDate: new Date().toISOString().split('T')[0],
  endDate: new Date(Date.now() + 365*24*60*60*1000).toISOString().split('T')[0],
});

async function handleSave() {
  try {
    if (isEdit.value) { await request.put('/contracts/' + route.params.id, form.value); ElMessage.success('草稿已保存'); }
    else { const res = await request.post('/contracts', form.value); ElMessage.success('合同创建成功'); router.push('/contract/draft/' + res.data.id); }
  } catch {}
}

async function handleSubmit() {
  try {
    let id = route.params.id;
    if (!id) { const res = await request.post('/contracts', form.value); id = res.data.id; }
    await request.post('/contracts/' + id + '/submit');
    ElMessage.success('已提交审批');
    router.push('/contract/list');
  } catch {}
}

onMounted(async () => {
  if (isEdit.value) {
    try { const res = await request.get('/contracts/' + route.params.id); form.value = res.data; } catch {}
  }
});
</script>

<style lang="scss" scoped>
.page-title { font-size: 18px; font-weight: 700; color: #0A3D62; margin-bottom: 16px; }
</style>
