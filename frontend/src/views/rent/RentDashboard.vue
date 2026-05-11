<template>
  <div class="rent-dashboard">
    <h2 class="page-title">收租看板</h2>
    <el-row :gutter="16" class="kpi-row">
      <el-col :span="4" v-for="kpi in kpis" :key="kpi.label">
        <el-card shadow="hover" class="kpi-card">
          <div class="kpi-label">{{ kpi.label }}</div>
          <div class="kpi-value" :style="{ color: kpi.color }">{{ kpi.value }}</div>
        </el-card>
      </el-col>
    </el-row>
    <el-row :gutter="16" style="margin-top:16px">
      <el-col :span="12">
        <el-card><template #header>收租趋势</template><div class="chart-placeholder">月度应收/实收/欠费趋势图</div></el-card>
      </el-col>
      <el-col :span="12">
        <el-card><template #header>逾期率趋势</template><div class="chart-placeholder">按业态/按月度逾期率变化图</div></el-card>
      </el-col>
    </el-row>
    <el-row :gutter="16" style="margin-top:16px">
      <el-col :span="12">
        <el-card><template #header>收款渠道分布</template><div class="chart-placeholder">银行转账/微信/支付宝/现金占比饼图</div></el-card>
      </el-col>
      <el-col :span="12">
        <el-card><template #header>催缴概览</template><div class="chart-placeholder">各级催缴任务数量统计</div></el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import request from '@/api/request';

const kpis = ref([
  { label: '当月收缴率', value: '--', color: '#00B894' },
  { label: '逾期率', value: '--', color: '#FF6B35' },
  { label: '当月应收(万)', value: '--', color: '#0A3D62' },
  { label: '当月实收(万)', value: '--', color: '#F6B93B' },
  { label: '欠费户数', value: '--', color: '#FF6B35' },
]);

onMounted(async () => {
  try {
    const res = await request.get('/dashboard/rent');
    const d = res.data;
    kpis.value = [
      { label: '当月收缴率', value: d.collectionRate + '%', color: '#00B894' },
      { label: '逾期率', value: d.overdueRate + '%', color: '#FF6B35' },
      { label: '当月应收(万)', value: d.monthlyDue.toLocaleString(), color: '#0A3D62' },
      { label: '当月实收(万)', value: d.monthlyCollected.toLocaleString(), color: '#F6B93B' },
      { label: '欠费户数', value: String(d.arrearsCount), color: '#FF6B35' },
    ];
  } catch {}
});
</script>

<style lang="scss" scoped>
.page-title { font-size: 18px; font-weight: 700; color: #0A3D62; margin-bottom: 16px; }
.kpi-card { text-align: center; cursor: pointer; }
.kpi-label { font-size: 12px; color: #7F8C8D; margin-bottom: 8px; }
.kpi-value { font-size: 28px; font-weight: 700; }
.chart-placeholder { height: 250px; display: flex; align-items: center; justify-content: center; background: #f5f7fa; border-radius: 8px; color: #7F8C8D; font-size: 13px; }
</style>
