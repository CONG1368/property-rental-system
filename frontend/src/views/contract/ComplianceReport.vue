<template>
  <div class="compliance-report">
    <h2 class="page-title">合规管理</h2>
    <el-row :gutter="16" style="margin-bottom:16px">
      <el-col :span="6"><el-card><el-statistic title="总合同数" :value="complianceData.totalContracts" /></el-card></el-col>
      <el-col :span="6"><el-card><el-statistic title="异常合同" :value="complianceData.abnormalCount" /></el-card></el-col>
      <el-col :span="6"><el-card><el-statistic title="合规率" :value="complianceData.complianceRate" suffix="%" /></el-card></el-col>
    </el-row>

    <el-card>
      <template #header><span>合规检查结果</span><el-button type="primary" style="float:right" @click="runCheck" :loading="checking">执行合规检查</el-button></template>
      <el-table :data="issues" stripe v-loading="loading">
        <el-table-column prop="contractNo" label="合同编号" width="150" />
        <el-table-column prop="checkItem" label="检查项" width="180" />
        <el-table-column label="检查结果" width="100"><template #default="{ row }"><el-tag :type="row.result === '通过' ? 'success' : 'danger'" size="small">{{ row.result }}</el-tag></template></el-table-column>
        <el-table-column prop="detail" label="详情" min-width="300" show-overflow-tooltip />
        <el-table-column prop="checkedAt" label="检查时间" width="170"><template #default="{ row }">{{ row.checkedAt?.slice(0, 16)?.replace('T', ' ') }}</template></el-table-column>
      </el-table>
      <el-pagination v-model:current-page="page" :total="total" :page-size="pageSize" @current-change="fetchData" layout="total, prev, pager, next" style="margin-top:16px; justify-content:flex-end" />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import request from '@/api/request';

const issues = ref<any[]>([]); const loading = ref(false); const checking = ref(false);
const page = ref(1); const pageSize = ref(20); const total = ref(0);

const complianceData = reactive({ totalContracts: 0, abnormalCount: 0, complianceRate: 0 });

async function fetchData() {
  loading.value = true;
  try {
    const res = await request.get('/compliance', { params: { page: page.value, pageSize: pageSize.value } });
    issues.value = res.data?.list || [];
    total.value = res.data?.total || 0;
    complianceData.totalContracts = res.data?.totalContracts || 0;
    complianceData.abnormalCount = res.data?.abnormalCount || 0;
    complianceData.complianceRate = res.data?.complianceRate || 0;
  } catch { /* ignore */ } finally { loading.value = false; }
}

async function runCheck() {
  checking.value = true;
  try {
    const res = await request.post('/compliance/check');
    ElMessage.success(res.data?.message || `合规检查完成，发现 ${res.data?.abnormalCount || 0} 个问题`);
    fetchData();
  } catch (err: any) { ElMessage.error(err?.response?.data?.message || '检查失败'); }
  finally { checking.value = false; }
}

onMounted(() => { fetchData(); });
</script>

<style lang="scss" scoped>
.page-title { font-size: 18px; font-weight: 700; color: #0A3D62; margin-bottom: 16px; }
</style>
