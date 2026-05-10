<template>
  <el-menu
    :default-active="activeMenu"
    :collapse="false"
    router
    class="sidebar-menu"
    background-color="#fff"
    text-color="#34495E"
    active-text-color="#0A3D62"
  >
    <el-menu-item index="/dashboard">
      <el-icon><HomeFilled /></el-icon>
      <span>首页概览</span>
    </el-menu-item>

    <el-sub-menu index="rent">
      <template #title>
        <el-icon><Money /></el-icon>
        <span>收租管理</span>
      </template>
      <el-menu-item index="/rent/properties">房源管理</el-menu-item>
      <el-menu-item index="/rent/tenants">租客管理</el-menu-item>
      <el-menu-item index="/rent/bills">收租管理</el-menu-item>
      <el-menu-item index="/rent/bills/calendar">收租日历</el-menu-item>
      <el-menu-item index="/rent/dunning">智能催缴</el-menu-item>
      <el-menu-item index="/rent/dashboard">收租看板</el-menu-item>
    </el-sub-menu>

    <el-sub-menu index="finance">
      <template #title>
        <el-icon><Notebook /></el-icon>
        <span>财务报表</span>
      </template>
      <el-menu-item index="/finance/books">账套管理</el-menu-item>
      <el-menu-item index="/finance/accounts">科目管理</el-menu-item>
      <el-menu-item index="/finance/vouchers">凭证管理</el-menu-item>
      <el-menu-item index="/finance/expenses">费用核算</el-menu-item>
      <el-menu-item index="/finance/tax">税务管理</el-menu-item>
      <el-menu-item index="/finance/budgets">预算管理</el-menu-item>
      <el-menu-item index="/finance/reports">报表中心</el-menu-item>
      <el-menu-item index="/finance/dashboard">财务看板</el-menu-item>
    </el-sub-menu>

    <el-sub-menu index="contract">
      <template #title>
        <el-icon><DocumentChecked /></el-icon>
        <span>合同管理</span>
      </template>
      <el-menu-item index="/contract/list">合同管理</el-menu-item>
      <el-menu-item index="/contract/approval">合同审批</el-menu-item>
      <el-menu-item index="/contract/kanban">合同看板</el-menu-item>
      <el-menu-item index="/contract/expiry">到期管理</el-menu-item>
      <el-menu-item index="/contract/renewals">续约管理</el-menu-item>
      <el-menu-item index="/contract/templates">模板管理</el-menu-item>
      <el-menu-item index="/contract/compliance">合规管理</el-menu-item>
    </el-sub-menu>

    <el-sub-menu index="system">
      <template #title>
        <el-icon><Setting /></el-icon>
        <span>系统设置</span>
      </template>
      <el-menu-item index="/system/users">用户管理</el-menu-item>
      <el-menu-item index="/system/dicts">数据字典</el-menu-item>
      <el-menu-item index="/system/audit-logs">审计日志</el-menu-item>
    </el-sub-menu>
  </el-menu>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { HomeFilled, Money, Notebook, DocumentChecked, Setting } from '@element-plus/icons-vue';

const route = useRoute();
const activeMenu = computed(() => route.path);
</script>

<style lang="scss" scoped>
.sidebar-menu {
  border-right: none;
  height: 100%;
}
</style>
