<template>
  <div class="report-center">
    <h2 class="page-title">报表中心</h2>
    <el-row :gutter="16">
      <el-col :span="8" v-for="r in reports" :key="r.title">
        <el-card shadow="hover" class="report-card" @click="openReport(r)">
          <div class="report-icon"><el-icon :size="32" color="#0A3D62"><Document /></el-icon></div>
          <div class="report-title">{{ r.title }}</div>
          <div class="report-desc">{{ r.desc }}</div>
        </el-card>
      </el-col>
    </el-row>
    <el-dialog :title="currentReport?.title" v-model="reportVisible" width="800px">
      <el-table :data="reportData" stripe><el-table-column prop="name" label="项目" /><el-table-column prop="value" label="金额" /></el-table>
      <template #footer><el-button @click="reportVisible = false">关闭</el-button><el-button type="primary">导出Excel</el-button></template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { Document } from '@element-plus/icons-vue';
import request from '@/api/request';

const reports = [
  { title: '资产负债表', desc: '资产/负债/权益汇总', endpoint: '/reports/balance-sheet' },
  { title: '利润表', desc: '收入/成本/利润明细', endpoint: '/reports/income-statement' },
  { title: '现金流量表', desc: '经营/投资/筹资现金流', endpoint: '/reports/cash-flow' },
  { title: '收租汇总表', desc: '按期间/业态汇总', endpoint: '/reports/custom' },
  { title: '欠费明细表', desc: '欠费租客明细', endpoint: '/reports/custom' },
  { title: '成本分析表', desc: '费用结构分析', endpoint: '/reports/custom' },
];

const currentReport = ref<any>(null); const reportVisible = ref(false); const reportData = ref<any[]>([]);

async function openReport(r: any) {
  currentReport.value = r;
  try { const res = await request.get(r.endpoint); reportData.value = res.data.rows || res.data.assets || res.data.revenue || []; } catch {}
  reportVisible.value = true;
}
</script>

<style lang="scss" scoped>
.page-title { font-size: 18px; font-weight: 700; color: #0A3D62; margin-bottom: 16px; }
.report-card { text-align: center; cursor: pointer; padding: 16px; }
.report-icon { margin-bottom: 12px; }
.report-title { font-size: 15px; font-weight: 600; color: #0A3D62; margin-bottom: 4px; }
.report-desc { font-size: 11px; color: #7F8C8D; }
</style>
