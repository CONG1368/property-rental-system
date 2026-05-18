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

    <el-sub-menu index="rent" v-if="canAccessRent">
      <template #title>
        <el-icon><Money /></el-icon>
        <span>收租管理</span>
      </template>
      <el-menu-item index="/rent/properties">房源管理</el-menu-item>
      <el-menu-item index="/rent/room-kanban">房态看板</el-menu-item>
      <el-menu-item index="/rent/tenants">租客管理</el-menu-item>
      <el-menu-item index="/rent/bills">收租管理</el-menu-item>
      <el-menu-item index="/rent/bills/calendar">收租日历</el-menu-item>
      <el-menu-item index="/rent/dunning">智能催缴</el-menu-item>
      <el-menu-item index="/rent/locks">门锁管理</el-menu-item>
      <el-menu-item index="/rent/dashboard">收租看板</el-menu-item>
    </el-sub-menu>

    <el-sub-menu index="finance" v-if="canAccessFinance">
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

    <el-sub-menu index="contract" v-if="canAccessContract">
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

    <el-sub-menu index="system" v-if="canAccessSystem">
      <template #title>
        <el-icon><Setting /></el-icon>
        <span>系统设置</span>
      </template>
      <el-menu-item index="/system/users">用户管理</el-menu-item>
      <el-menu-item index="/system/dicts">数据字典</el-menu-item>
      <el-menu-item index="/system/audit-logs">审计日志</el-menu-item>
      <el-menu-item index="/system/print-settings">打印设置</el-menu-item>
    </el-sub-menu>
  </el-menu>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { HomeFilled, Money, Notebook, DocumentChecked, Setting } from '@element-plus/icons-vue';
import { useAuthStore } from '@/stores/auth';

const route = useRoute();
const activeMenu = computed(() => route.path);
const auth = useAuthStore();

const token = localStorage.getItem('accessToken') || '';
const lsRole = localStorage.getItem('userRole') || '';

// base64url → UTF-8 字符串
function base64urlDecode(str: string): string {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder('utf-8').decode(bytes);
}

// 三层 fallback 获取角色：auth.user → localStorage(userRole) → JWT payload
function resolveRole(): string {
  if (auth.user?.role) return auth.user.role;
  if (lsRole) return lsRole;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return '';
    const payload = JSON.parse(base64urlDecode(parts[1]));
    return payload.role || '';
  } catch { return ''; }
}
const role = computed(() => resolveRole());

const canAccessRent = computed(() =>
  ['管理员', '总经理', '收租主管', '收租员'].includes(role.value)
);
const canAccessFinance = computed(() =>
  ['管理员', '总经理', '财务主管', '会计', '出纳'].includes(role.value)
);
const canAccessContract = computed(() =>
  ['管理员', '总经理', '合同主管', '法务'].includes(role.value)
);
const canAccessSystem = computed(() => role.value === '管理员');
</script>

<style lang="scss" scoped>
.sidebar-menu {
  border-right: none;
  height: 100%;
}
</style>
