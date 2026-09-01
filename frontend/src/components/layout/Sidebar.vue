<template>
  <el-menu
    :default-active="activeMenu"
    :collapse="false"
    router
    class="sidebar-menu"
    background-color="#fff"
    text-color="#34495E"
    active-text-color="#2b57c9"
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
      <el-menu-item index="/rent/leads">招租线索</el-menu-item>
      <el-menu-item index="/rent/move-ins">入住交接</el-menu-item>
      <el-menu-item index="/rent/room-kanban">房态看板</el-menu-item>
      <el-menu-item index="/property/ops-dashboard">运营看板</el-menu-item>
      <el-menu-item index="/rent/tenants">租客管理</el-menu-item>
      <el-menu-item index="/rent/tenant-credit">租客风控</el-menu-item>
      <el-menu-item index="/rent/pricing">租金定价</el-menu-item>
      <el-menu-item index="/rent/deposits">押金台账</el-menu-item>
      <el-menu-item index="/rent/checkouts">退租管理</el-menu-item>
      <el-menu-item index="/rent/bills">收租管理</el-menu-item>
      <el-menu-item index="/rent/bills/calendar">收租日历</el-menu-item>
      <el-menu-item index="/rent/dunning">智能催缴</el-menu-item>
      <el-menu-item index="/rent/locks">门锁管理</el-menu-item>
      <el-menu-item index="/rent/dashboard">收租看板</el-menu-item>
    </el-sub-menu>

    <el-sub-menu index="property" v-if="canAccessProperty">
      <template #title>
        <el-icon><OfficeBuilding /></el-icon>
        <span>物业管理</span>
      </template>
      <el-menu-item index="/property/ops-dashboard">运营看板</el-menu-item>
      <el-menu-item index="/property/tenant-portal">租户服务</el-menu-item>
      <el-menu-item index="/property/decorations">装修管理</el-menu-item>
      <el-menu-item index="/property/maintenance-plans">维保计划</el-menu-item>
      <el-menu-item index="/property/property-tasks">排班与质检</el-menu-item>
      <el-menu-item index="/property/patrols">巡更管理</el-menu-item>
      <el-menu-item index="/property/visitors">访客管理</el-menu-item>
      <el-menu-item index="/property/equipment-certifications">特种设备</el-menu-item>
      <el-menu-item index="/property/projects">项目管理</el-menu-item>
      <el-menu-item index="/property/business-briefing">经营简报</el-menu-item>
      <el-menu-item index="/property/briefing-archive">月度简报</el-menu-item>
      <el-menu-item index="/property/work-orders">报修工单</el-menu-item>
      <el-menu-item index="/property/facilities">设施设备</el-menu-item>
      <el-menu-item index="/property/meters">抄表计费</el-menu-item>
      <el-menu-item index="/property/parking">停车管理</el-menu-item>
      <el-menu-item index="/property/complaints">投诉建议</el-menu-item>
      <el-menu-item index="/property/residents">住户档案</el-menu-item>
      <el-menu-item index="/property/announcements">公告发布</el-menu-item>
      <el-menu-item index="/property/common-revenues">公共收益</el-menu-item>
      <el-menu-item index="/property/vendors">外包供应商</el-menu-item>
      <el-menu-item index="/property/inventory">仓库物料</el-menu-item>
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
      <el-menu-item index="/finance/fixed-assets">固定资产</el-menu-item>
      <el-menu-item index="/finance/bank-reconciliation">银行对账</el-menu-item>
      <el-menu-item index="/finance/cost-allocation">成本分摊</el-menu-item>
      <el-menu-item index="/finance/invoices">发票管理</el-menu-item>
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
      <el-menu-item index="/contract/clause-import">条款导入</el-menu-item>
      <el-menu-item index="/contract/compliance">合规管理</el-menu-item>
    </el-sub-menu>

    <el-sub-menu index="fire" v-if="canAccessFire">
      <template #title>
        <el-icon><Aim /></el-icon>
        <span>消防管理</span>
      </template>
      <el-menu-item index="/fire/dashboard">消防看板</el-menu-item>
      <el-menu-item index="/fire/inspections">检查记录</el-menu-item>
      <el-menu-item index="/fire/equipment">器材台账</el-menu-item>
      <el-menu-item index="/fire/violations">违规记录</el-menu-item>
      <el-menu-item index="/fire/drills">演练记录</el-menu-item>
    </el-sub-menu>

    <el-sub-menu index="system" v-if="canAccessSystem">
      <template #title>
        <el-icon><Setting /></el-icon>
        <span>系统设置</span>
      </template>
      <el-menu-item index="/system/users">用户管理</el-menu-item>
      <el-menu-item index="/system/audit-logs">审计日志</el-menu-item>
      <el-menu-item index="/system/dicts">数据字典</el-menu-item>
      <el-menu-item index="/system/print-settings">打印设置</el-menu-item>
      <el-menu-item index="/system/id-card-readers">身份证读卡器</el-menu-item>
      <el-menu-item index="/system/approval-flows">审批流程</el-menu-item>
      <el-menu-item index="/system/permissions">权限矩阵</el-menu-item>
      <el-menu-item index="/system/params">系统参数</el-menu-item>
      <el-menu-item index="/system/ops">系统运维</el-menu-item>
    </el-sub-menu>

    <el-menu-item index="/search" class="approval-link">
      <el-icon><Search /></el-icon>
      <span>全局检索</span>
    </el-menu-item>

    <el-menu-item index="/approval-center" class="approval-link">
      <el-icon><Stamp /></el-icon>
      <span>审批中心</span>
    </el-menu-item>
  </el-menu>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { HomeFilled, Money, Notebook, DocumentChecked, Setting, Aim, OfficeBuilding, Stamp, Search } from '@element-plus/icons-vue';
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
const canAccessFire = computed(() =>
  ['管理员', '总经理', '安全主管'].includes(role.value)
);
const canAccessProperty = computed(() =>
  ['管理员', '总经理', '物业经理', '维修工'].includes(role.value)
);
const canAccessSystem = computed(() => role.value === '管理员');
</script>

<style lang="scss" scoped>
.sidebar-menu {
  border-right: none;
  height: 100%;

  :deep(.el-sub-menu__title) {
    font-size: 14px;
  }

  :deep(.el-menu-item) {
    font-size: 13px;
  }
}
</style>
