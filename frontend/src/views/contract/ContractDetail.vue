<template>
  <div class="contract-detail">
    <el-page-header @back="$router.back()" :title="'合同详情 - ' + contract?.contractNo" />
    <el-card style="margin-top:16px" v-if="contract">
      <template #header><span>合同信息</span><el-tag style="margin-left:12px">{{ contract.status }}</el-tag></template>
      <el-descriptions :column="3">
        <el-descriptions-item label="合同编号">{{ contract.contractNo }}</el-descriptions-item>
        <el-descriptions-item label="月租金">{{ contract.rentAmount }}</el-descriptions-item>
        <el-descriptions-item label="押金">{{ contract.depositAmount }}</el-descriptions-item>
        <el-descriptions-item label="开始日期">{{ contract.startDate }}</el-descriptions-item>
        <el-descriptions-item label="结束日期">{{ contract.endDate }}</el-descriptions-item>
        <el-descriptions-item label="付款周期">{{ contract.paymentCycle }}</el-descriptions-item>
        <el-descriptions-item label="计费模式">{{ contract.billingMode }}</el-descriptions-item>
        <el-descriptions-item label="签署日期">{{ contract.signedAt || '--' }}</el-descriptions-item>
      </el-descriptions>
      <div style="margin-top:16px">
        <el-button type="success" @click="handleApprove" v-if="contract.status === '审批中'">审批通过</el-button>
        <el-button type="danger" @click="handleReject" v-if="contract.status === '审批中'">驳回</el-button>
        <el-button type="primary" @click="handleSign" v-if="contract.status === '已签订'">签署生效</el-button>
        <el-button type="warning" @click="handleTerminate" v-if="contract.status === '执行中'">终止合同</el-button>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import request from '@/api/request';

const route = useRoute();
const contract = ref<any>(null);

async function fetchContract() {
  try { const res = await request.get('/contracts/' + route.params.id); contract.value = res.data; } catch {}
}

async function handleApprove() { try { await request.post('/contracts/' + contract.value!.id + '/approve'); ElMessage.success('已通过'); fetchContract(); } catch {} }
async function handleReject() { try { await request.post('/contracts/' + contract.value!.id + '/reject'); ElMessage.success('已驳回'); fetchContract(); } catch {} }
async function handleSign() { try { await request.post('/contracts/' + contract.value!.id + '/sign'); ElMessage.success('已签署'); fetchContract(); } catch {} }
async function handleTerminate() { try { await request.post('/contracts/' + contract.value!.id + '/terminate'); ElMessage.success('已终止'); fetchContract(); } catch {} }

onMounted(() => fetchContract());
</script>
