<template>
  <div class="finance-dashboard">
    <h2 class="page-title">财务看板</h2>
    <el-row :gutter="16">
      <el-col :span="6" v-for="kpi in kpis" :key="kpi.label">
        <el-card shadow="hover" class="kpi-card"><div class="kpi-label">{{ kpi.label }}</div><div class="kpi-value" :style="{color:kpi.color}">{{ kpi.value }}</div></el-card>
      </el-col>
    </el-row>
    <el-row :gutter="16" style="margin-top:16px">
      <el-col :span="12"><el-card><template #header>收支趋势</template><div class="chart-placeholder">月度收入/费用/净利润走势图</div></el-card></el-col>
      <el-col :span="12"><el-card><template #header>现金流分析</template><div class="chart-placeholder">经营/投资/筹资活动现金流图</div></el-card></el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
const kpis = ref([
  { label: '年度总收入', value: '--', color: '#00B894' },
  { label: '年度总支出', value: '--', color: '#FF6B35' },
  { label: '年度净利润', value: '--', color: '#0A3D62' },
  { label: '利润率', value: '--', color: '#F6B93B' },
]);
</script>

<style lang="scss" scoped>
.page-title { font-size: 18px; font-weight: 700; color: #0A3D62; margin-bottom: 16px; }
.kpi-card { text-align: center; }
.kpi-label { font-size: 12px; color: #7F8C8D; margin-bottom: 8px; }
.kpi-value { font-size: 28px; font-weight: 700; }
.chart-placeholder { height: 250px; display: flex; align-items: center; justify-content: center; background: #f5f7fa; border-radius: 8px; color: #7F8C8D; font-size: 13px; }
</style>
