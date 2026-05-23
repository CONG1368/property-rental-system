<template>
  <div class="room-stats-panel">
    <div class="kpi-cards">
      <div class="kpi-card">
        <div class="kpi-value">{{ stats.total || 0 }}</div>
        <div class="kpi-label">总房源</div>
      </div>
      <div class="kpi-card kpi-occupied">
        <div class="kpi-value">{{ stats['已出租'] || 0 }}</div>
        <div class="kpi-label">已出租</div>
      </div>
      <div class="kpi-card kpi-vacant">
        <div class="kpi-value">{{ stats['空置'] || 0 }}</div>
        <div class="kpi-label">空置</div>
      </div>
      <div class="kpi-card kpi-rate">
        <div class="kpi-value">{{ stats.occupancyRate ?? 0 }}%</div>
        <div class="kpi-label">入住率</div>
      </div>
      <div class="kpi-card kpi-maintenance">
        <div class="kpi-value">{{ (stats['维修中'] || 0) + (stats['待保洁'] || 0) + (stats['待验收'] || 0) }}</div>
        <div class="kpi-label">维护中</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ stats: Record<string, number> }>();
</script>

<style scoped>
.room-stats-panel { margin-bottom: 16px; }
.kpi-cards { display: flex; gap: 16px; flex-wrap: wrap; }
.kpi-card {
  background: #fff; border-radius: 8px; padding: 14px 24px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06); min-width: 110px; text-align: center;
  border-top: 3px solid #409EFF;
}
.kpi-occupied { border-top-color: #67C23A; }
.kpi-vacant { border-top-color: #909399; }
.kpi-rate { border-top-color: #E6A23C; }
.kpi-maintenance { border-top-color: #F56C6C; }
.kpi-value { font-size: 24px; font-weight: 700; color: #303133; }
.kpi-label { font-size: 12px; color: #909399; margin-top: 4px; }
</style>
