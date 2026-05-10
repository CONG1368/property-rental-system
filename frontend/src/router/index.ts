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

router.beforeEach((to, _from, next) => {
  const token = localStorage.getItem('accessToken');
  if (to.meta.requiresAuth !== false && !token) {
    next('/login');
  } else if (to.path === '/login' && token) {
    next('/dashboard');
  } else {
    next();
  }
});

export default router;
