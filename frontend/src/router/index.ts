import { createRouter, createWebHashHistory } from 'vue-router';
import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue'),
    meta: { requiresAuth: false },
  },
  {
    path: '/',
    component: () => import('@/components/layout/AppLayout.vue'),
    meta: { requiresAuth: true },
    redirect: '/dashboard',
    children: [
      // ====== 首页概览 ======
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/views/dashboard/HomeDashboard.vue'),
        meta: { title: '首页概览', icon: 'HomeFilled' },
      },
      // ====== 收租管理 ======
      {
        path: 'rent/properties',
        name: 'PropertyList',
        component: () => import('@/views/rent/PropertyList.vue'),
        meta: { title: '房源管理', icon: 'OfficeBuilding' },
      },
      {
        path: 'rent/properties/import',
        name: 'PropertyImport',
        component: () => import('@/views/rent/PropertyImport.vue'),
        meta: { title: '批量导入', hidden: true },
      },
      {
        path: 'rent/properties/:id',
        name: 'PropertyDetail',
        component: () => import('@/views/rent/PropertyDetail.vue'),
        meta: { title: '房源详情', hidden: true },
      },
      {
        path: 'rent/tenants',
        name: 'TenantList',
        component: () => import('@/views/rent/TenantList.vue'),
        meta: { title: '租客管理', icon: 'User' },
      },
      {
        path: 'rent/tenants/:id',
        name: 'TenantDetail',
        component: () => import('@/views/rent/TenantDetail.vue'),
        meta: { title: '租客详情', hidden: true },
      },
      {
        path: 'rent/bills',
        name: 'BillList',
        component: () => import('@/views/rent/BillList.vue'),
        meta: { title: '收租管理', icon: 'Money' },
      },
      {
        path: 'rent/bills/calendar',
        name: 'BillCalendar',
        component: () => import('@/views/rent/BillCalendar.vue'),
        meta: { title: '收租日历', hidden: true },
      },
      {
        path: 'rent/dunning',
        name: 'DunningCenter',
        component: () => import('@/views/rent/DunningCenter.vue'),
        meta: { title: '智能催缴', icon: 'Bell' },
      },
      {
        path: 'rent/dashboard',
        name: 'RentDashboard',
        component: () => import('@/views/rent/RentDashboard.vue'),
        meta: { title: '收租看板', icon: 'DataAnalysis' },
      },
      // ====== 财务报表 ======
      {
        path: 'finance/books',
        name: 'AccountBookList',
        component: () => import('@/views/finance/AccountBookList.vue'),
        meta: { title: '账套管理', icon: 'Notebook' },
      },
      {
        path: 'finance/accounts',
        name: 'AccountList',
        component: () => import('@/views/finance/AccountList.vue'),
        meta: { title: '科目管理', icon: 'List' },
      },
      {
        path: 'finance/vouchers',
        name: 'VoucherList',
        component: () => import('@/views/finance/VoucherList.vue'),
        meta: { title: '凭证管理', icon: 'Document' },
      },
      {
        path: 'finance/vouchers/edit/:id?',
        name: 'VoucherEdit',
        component: () => import('@/views/finance/VoucherEdit.vue'),
        meta: { title: '凭证编辑', hidden: true },
      },
      {
        path: 'finance/expenses',
        name: 'ExpenseList',
        component: () => import('@/views/finance/ExpenseList.vue'),
        meta: { title: '费用核算', icon: 'CreditCard' },
      },
      {
        path: 'finance/tax',
        name: 'TaxManagement',
        component: () => import('@/views/finance/TaxManagement.vue'),
        meta: { title: '税务管理', icon: 'Stamp' },
      },
      {
        path: 'finance/budgets',
        name: 'BudgetList',
        component: () => import('@/views/finance/BudgetList.vue'),
        meta: { title: '预算管理', icon: 'TrendCharts' },
      },
      {
        path: 'finance/budgets/edit/:id?',
        name: 'BudgetEdit',
        component: () => import('@/views/finance/BudgetEdit.vue'),
        meta: { title: '预算编辑', hidden: true },
      },
      {
        path: 'finance/reports',
        name: 'ReportCenter',
        component: () => import('@/views/finance/ReportCenter.vue'),
        meta: { title: '报表中心', icon: 'Files' },
      },
      {
        path: 'finance/dashboard',
        name: 'FinanceDashboard',
        component: () => import('@/views/finance/FinanceDashboard.vue'),
        meta: { title: '财务看板', icon: 'DataBoard' },
      },
      // ====== 合同管理 ======
      {
        path: 'contract/list',
        name: 'ContractList',
        component: () => import('@/views/contract/ContractList.vue'),
        meta: { title: '合同管理', icon: 'DocumentChecked' },
      },
      {
        path: 'contract/draft/:id?',
        name: 'ContractDraft',
        component: () => import('@/views/contract/ContractDraft.vue'),
        meta: { title: '合同起草', hidden: true },
      },
      {
        path: 'contract/detail/:id',
        name: 'ContractDetail',
        component: () => import('@/views/contract/ContractDetail.vue'),
        meta: { title: '合同详情', hidden: true },
      },
      {
        path: 'contract/approval',
        name: 'ContractApproval',
        component: () => import('@/views/contract/ContractApproval.vue'),
        meta: { title: '合同审批', icon: 'Checked' },
      },
      {
        path: 'contract/kanban',
        name: 'ContractKanban',
        component: () => import('@/views/contract/ContractKanban.vue'),
        meta: { title: '合同看板', icon: 'Grid' },
      },
      {
        path: 'contract/expiry',
        name: 'ExpiryCalendar',
        component: () => import('@/views/contract/ExpiryCalendar.vue'),
        meta: { title: '到期管理', icon: 'Calendar' },
      },
      {
        path: 'contract/renewals',
        name: 'RenewalList',
        component: () => import('@/views/contract/RenewalList.vue'),
        meta: { title: '续约管理', icon: 'Refresh' },
      },
      {
        path: 'contract/templates',
        name: 'TemplateList',
        component: () => import('@/views/contract/TemplateList.vue'),
        meta: { title: '模板管理', icon: 'Tickets' },
      },
      {
        path: 'contract/compliance',
        name: 'ComplianceReport',
        component: () => import('@/views/contract/ComplianceReport.vue'),
        meta: { title: '合规管理', icon: 'Warning' },
      },
      // ====== 系统设置 ======
      {
        path: 'system/users',
        name: 'UserList',
        component: () => import('@/views/system/UserList.vue'),
        meta: { title: '用户管理', icon: 'UserFilled' },
      },
      {
        path: 'system/dicts',
        name: 'DictList',
        component: () => import('@/views/system/DictList.vue'),
        meta: { title: '数据字典', icon: 'Collection' },
      },
      {
        path: 'system/audit-logs',
        name: 'AuditLog',
        component: () => import('@/views/system/AuditLog.vue'),
        meta: { title: '审计日志', icon: 'Monitor' },
      },
    ],
  },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

// 路由路径 → 允许访问的角色
const routeRoleMap: Record<string, string[]> = {
  'rent': ['管理员', '总经理', '收租主管', '收租员'],
  'finance': ['管理员', '总经理', '财务主管', '会计', '出纳'],
  'contract': ['管理员', '总经理', '合同主管', '法务'],
  'system': ['管理员'],
};

// 检查 JWT 是否过期（仅解析 exp 字段，不做完整验证）
function isTokenExpired(token: string): boolean {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const payload = JSON.parse(new TextDecoder('utf-8').decode(bytes));
    if (!payload.exp) return true; // 无 exp 字段视为已过期
    return payload.exp * 1000 < Date.now();
  } catch {
    return true; // 解析失败视为过期
  }
}

router.beforeEach((to, _from, next) => {
  const rawToken = localStorage.getItem('accessToken');
  const token = rawToken && !isTokenExpired(rawToken) ? rawToken : null;

  // 过期 token 清理
  if (!token && rawToken) {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('userRole');
  }

  if (to.meta.requiresAuth !== false && !token) {
    next('/login');
    return;
  }
  if (to.path === '/login' && token) {
    next('/dashboard');
    return;
  }
  // 角色权限检查：始终从 JWT 解析（localStorage 可能有编码问题）
  if (token && to.path !== '/login' && to.path !== '/dashboard' && to.path !== '/') {
    const moduleKey = to.path.startsWith('/rent') ? 'rent' :
      to.path.startsWith('/finance') ? 'finance' :
      to.path.startsWith('/contract') ? 'contract' :
      to.path.startsWith('/system') ? 'system' : '';
    if (moduleKey && routeRoleMap[moduleKey]) {
      // 从 JWT 解析角色（正确处理 UTF-8）
      let userRole = '';
      try {
        const parts = token.split('.');
        if (parts.length === 3) {
          const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
          const binary = atob(base64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          const payload = JSON.parse(new TextDecoder('utf-8').decode(bytes));
          userRole = payload.role || '';
        }
      } catch { /* ignore */ }
      if (userRole && !routeRoleMap[moduleKey].includes(userRole)) {
        next('/dashboard');
        return;
      }
    }
  }
  next();
});

export default router;
