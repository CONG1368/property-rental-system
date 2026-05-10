<template>
  <div class="home-dashboard">
    <h2 class="page-title">首页概览</h2>
    <el-row :gutter="16" class="kpi-row">
      <el-col :span="6" v-for="kpi in kpis" :key="kpi.label">
        <el-card shadow="hover" class="kpi-card">
          <div class="kpi-label">{{ kpi.label }}</div>
          <div class="kpi-value" :style="{ color: kpi.color }">{{ kpi.value }}</div>
        </el-card>
      </el-col>
    </el-row>
    <el-row :gutter="16" style="margin-top:16px">
      <el-col :span="12">
        <el-card shadow="hover">
          <template #header>快捷入口</template>
          <el-row :gutter="12">
            <el-col :span="8" v-for="link in quickLinks" :key="link.path">
              <el-button class="quick-btn" @click="$router.push(link.path)">
                <el-icon><component :is="link.icon" /></el-icon>
                <span>{{ link.label }}</span>
              </el-button>
            </el-col>
          </el-row>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card shadow="hover">
          <template #header>系统信息</template>
          <el-descriptions :column="1" size="small">
            <el-descriptions-item label="系统版本">v1.0.0</el-descriptions-item>
            <el-descriptions-item label="技术栈">Electron + Vue3 + Node.js + MySQL</el-descriptions-item>
            <el-descriptions-item label="数据库">MySQL 8.0 + Redis 7.x</el-descriptions-item>
          </el-descriptions>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { OfficeBuilding, User, Money, Bell } from '@element-plus/icons-vue';

const kpis = [
  { label: '房源总数', value: '--', color: '#0A3D62' },
  { label: '在租户数', value: '--', color: '#00B894' },
  { label: '当月应收', value: '--', color: '#F6B93B' },
  { label: '收缴率', value: '--', color: '#FF6B35' },
];

const quickLinks = [
  { label: '房源管理', path: '/rent/properties', icon: OfficeBuilding },
  { label: '租客管理', path: '/rent/tenants', icon: User },
  { label: '收租管理', path: '/rent/bills', icon: Money },
  { label: '智能催缴', path: '/rent/dunning', icon: Bell },
  { label: '合同管理', path: '/contract/list', icon: Money },
  { label: '报表中心', path: '/finance/reports', icon: Money },
];
</script>

<style lang="scss" scoped>
.page-title {
  font-size: 18px;
  font-weight: 700;
  color: #0A3D62;
  margin-bottom: 16px;
}
.kpi-card {
  text-align: center;
  cursor: pointer;
}
.kpi-label {
  font-size: 12px;
  color: #7F8C8D;
  margin-bottom: 8px;
}
.kpi-value {
  font-size: 28px;
  font-weight: 700;
}
.quick-btn {
  width: 100%;
  height: 64px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  font-size: 11px;
}
</style>
