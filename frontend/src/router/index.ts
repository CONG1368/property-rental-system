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
    path: '/portal',
    name: 'TenantPortal',
    component: () => import('@/views/rent/TenantPortal.vue'),
    meta: { requiresAuth: false, title: '租户自助服务' },
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
        path: 'rent/leads',
        name: 'LeadList',
        component: () => import('@/views/rent/LeadList.vue'),
        meta: { title: '招租线索', icon: 'Compass' },
      },
      {
        path: 'rent/move-ins',
        name: 'MoveInList',
        component: () => import('@/views/rent/MoveInList.vue'),
        meta: { title: '入住交接', icon: 'CirclePlus' },
      },
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
      {
        path: 'rent/room-kanban',
        name: 'RoomStatusKanban',
        component: () => import('@/views/rent/RoomStatusKanban.vue'),
        meta: { title: '房态看板', icon: 'Grid' },
      },
      {
        path: 'rent/room-kanban/dashboard',
        name: 'RoomDashboard',
        component: () => import('@/views/rent/RoomDashboard.vue'),
        meta: { title: '数据大屏', hidden: true },
      },
      {
        path: 'rent/room-kanban/batch-gen',
        name: 'RoomBatchGenerate',
        component: () => import('@/views/rent/RoomBatchGenerate.vue'),
        meta: { title: '批量生成房间', hidden: true },
      },
      {
        path: 'rent/locks',
        name: 'DoorLockList',
        component: () => import('@/views/rent/DoorLockList.vue'),
        meta: { title: '门锁管理', icon: 'Lock' },
      },
      {
        path: 'rent/locks/:id',
        name: 'DoorLockDetail',
        component: () => import('@/views/rent/DoorLockDetail.vue'),
        meta: { title: '门锁详情', hidden: true },
      },
      {
        path: 'rent/tenant-credit',
        name: 'TenantCredit',
        component: () => import('@/views/rent/TenantCredit.vue'),
        meta: { title: '租客风控', icon: 'Aim' },
      },
      {
        path: 'rent/pricing',
        name: 'PricingCenter',
        component: () => import('@/views/rent/PricingCenter.vue'),
        meta: { title: '租金定价', icon: 'PriceTag' },
      },
      {
        path: 'rent/deposits',
        name: 'DepositList',
        component: () => import('@/views/rent/DepositList.vue'),
        meta: { title: '押金台账', icon: 'Coin' },
      },
      {
        path: 'rent/checkouts',
        name: 'CheckoutList',
        component: () => import('@/views/rent/CheckoutList.vue'),
        meta: { title: '退租管理', icon: 'RefreshRight' },
      },
      {
        path: 'property/parking',
        name: 'ParkingList',
        component: () => import('@/views/rent/ParkingList.vue'),
        meta: { title: '停车管理', icon: 'Van' },
      },
      {
        path: 'property/complaints',
        name: 'ComplaintList',
        component: () => import('@/views/rent/ComplaintList.vue'),
        meta: { title: '投诉建议', icon: 'ChatDotRound' },
      },
      {
        path: 'property/residents',
        name: 'ResidentList',
        component: () => import('@/views/rent/ResidentList.vue'),
        meta: { title: '住户档案', icon: 'User' },
      },
      {
        path: 'property/facilities',
        name: 'FacilityList',
        component: () => import('@/views/rent/FacilityList.vue'),
        meta: { title: '设施设备', icon: 'Monitor' },
      },
      {
        path: 'property/work-orders',
        name: 'WorkOrderList',
        component: () => import('@/views/rent/WorkOrderList.vue'),
        meta: { title: '报修工单', icon: 'Tools' },
      },
      {
        path: 'property/ops-dashboard',
        name: 'PropertyOpsDashboard',
        component: () => import('@/views/rent/PropertyOpsDashboard.vue'),
        meta: { title: '物业运营看板', icon: 'DataAnalysis' },
      },
      {
        path: 'property/vendors',
        name: 'VendorList',
        component: () => import('@/views/rent/VendorList.vue'),
        meta: { title: '外包供应商', icon: 'Suitcase' },
      },
      {
        path: 'property/meters',
        name: 'MeterReading',
        component: () => import('@/views/rent/MeterReading.vue'),
        meta: { title: '抄表计费', icon: 'Odometer' },
      },
      {
        path: 'property/smart-meter',
        name: 'SmartMeter',
        component: () => import('@/views/property/SmartMeter.vue'),
        meta: { title: '智能水电表', icon: 'Odometer' },
      },
      {
        path: 'property/announcements',
        name: 'AnnouncementList',
        component: () => import('@/views/rent/AnnouncementList.vue'),
        meta: { title: '公告发布', icon: 'BellFilled' },
      },
      {
        path: 'property/common-revenues',
        name: 'CommonRevenueList',
        component: () => import('@/views/rent/CommonRevenueList.vue'),
        meta: { title: '公共收益', icon: 'Money' },
      },
      {
        path: 'property/inventory',
        name: 'InventoryList',
        component: () => import('@/views/rent/InventoryList.vue'),
        meta: { title: '仓库物料', icon: 'Box' },
      },
      {
        path: 'property/tenant-portal',
        name: 'TenantServicePortal',
        component: () => import('@/views/rent/TenantServicePortal.vue'),
        meta: { title: '租户服务', icon: 'Service' },
      },
      {
        path: 'property/decorations',
        name: 'DecorationList',
        component: () => import('@/views/property/DecorationList.vue'),
        meta: { title: '装修管理', icon: 'Tools' },
      },
      {
        path: 'property/maintenance-plans',
        name: 'MaintenancePlanList',
        component: () => import('@/views/property/MaintenancePlanList.vue'),
        meta: { title: '维保计划', icon: 'Calendar' },
      },
      {
        path: 'property/property-tasks',
        name: 'PropertyTaskList',
        component: () => import('@/views/property/PropertyTaskList.vue'),
        meta: { title: '排班与质检', icon: 'Calendar' },
      },
      {
        path: 'property/projects',
        name: 'ProjectList',
        component: () => import('@/views/rent/ProjectList.vue'),
        meta: { title: '项目管理', icon: 'OfficeBuilding' },
      },
      {
        path: 'property/business-briefing',
        name: 'BusinessBriefing',
        component: () => import('@/views/rent/BusinessBriefing.vue'),
        meta: { title: '经营简报', icon: 'Document' },
      },
      {
        path: 'property/briefing-archive',
        name: 'BriefingArchive',
        component: () => import('@/views/rent/BriefingArchive.vue'),
        meta: { title: '月度简报', icon: 'Files' },
      },
      {
        path: 'property/patrols',
        name: 'PatrolList',
        component: () => import('@/views/property/PatrolList.vue'),
        meta: { title: '巡更管理', icon: 'Location' },
      },
      {
        path: 'property/visitors',
        name: 'VisitorList',
        component: () => import('@/views/property/VisitorList.vue'),
        meta: { title: '访客管理', icon: 'Postcard' },
      },
      {
        path: 'property/equipment-certifications',
        name: 'EquipmentCertList',
        component: () => import('@/views/property/EquipmentCertList.vue'),
        meta: { title: '特种设备', icon: 'Aim' },
      },
      // ====== 消防管理 ======
      {
        path: 'fire/dashboard',
        name: 'FireDashboard',
        component: () => import('@/views/fire/FireDashboard.vue'),
        meta: { title: '消防看板', icon: 'Aim' },
      },
      {
        path: 'fire/inspections',
        name: 'FireInspectionList',
        component: () => import('@/views/fire/FireInspectionList.vue'),
        meta: { title: '检查记录', icon: 'Checked' },
      },
      {
        path: 'fire/inspections/:id',
        name: 'FireInspectionDetail',
        component: () => import('@/views/fire/FireInspectionDetail.vue'),
        meta: { title: '检查详情', hidden: true },
      },
      {
        path: 'fire/equipment',
        name: 'FireEquipmentList',
        component: () => import('@/views/fire/FireEquipmentList.vue'),
        meta: { title: '器材台账', icon: 'TakeawayBox' },
      },
      {
        path: 'fire/violations',
        name: 'FireViolationList',
        component: () => import('@/views/fire/FireViolationList.vue'),
        meta: { title: '违规记录', icon: 'WarningFilled' },
      },
      {
        path: 'fire/drills',
        name: 'FireDrillList',
        component: () => import('@/views/fire/FireDrillList.vue'),
        meta: { title: '演练记录', icon: 'Bell' },
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
      {
        path: 'finance/fixed-assets',
        name: 'FixedAssetList',
        component: () => import('@/views/finance/FixedAssetList.vue'),
        meta: { title: '固定资产', icon: 'Box' },
      },
      {
        path: 'finance/bank-reconciliation',
        name: 'BankReconciliation',
        component: () => import('@/views/finance/BankReconciliation.vue'),
        meta: { title: '银行对账', icon: 'CreditCard' },
      },
      {
        path: 'finance/cost-allocation',
        name: 'CostAllocation',
        component: () => import('@/views/finance/CostAllocation.vue'),
        meta: { title: '成本分摊', icon: 'Share' },
      },
      {
        path: 'finance/invoices',
        name: 'InvoiceList',
        component: () => import('@/views/finance/InvoiceList.vue'),
        meta: { title: '发票管理', icon: 'Tickets' },
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
      {
        path: 'contract/clause-import',
        name: 'ClauseImport',
        component: () => import('@/views/contract/ClauseImport.vue'),
        meta: { title: '条款批量导入', icon: 'Upload' },
      },
      // ====== 系统设置 ======
      {
        path: 'system/users',
        name: 'UserList',
        component: () => import('@/views/system/UserList.vue'),
        meta: { title: '用户管理', icon: 'UserFilled' },
      },
      {
        path: 'system/audit-logs',
        name: 'AuditLog',
        component: () => import('@/views/system/AuditLog.vue'),
        meta: { title: '审计日志', icon: 'Monitor' },
      },
      {
        path: 'system/print-settings',
        name: 'PrintSettings',
        component: () => import('@/views/system/PrintSettings.vue'),
        meta: { title: '打印设置', icon: 'Printer' },
      },
      {
        path: 'system/id-card-readers',
        name: 'IdCardReaders',
        component: () => import('@/views/system/IdCardReaderSettings.vue'),
        meta: { title: '身份证读卡器', icon: 'Reading' },
      },
      {
        path: 'system/approval-flows',
        name: 'ApprovalFlowConfig',
        component: () => import('@/views/system/ApprovalFlowConfig.vue'),
        meta: { title: '审批流程', icon: 'SetUp' },
      },
      {
        path: 'system/permissions',
        name: 'PermissionMatrix',
        component: () => import('@/views/system/PermissionMatrix.vue'),
        meta: { title: '权限矩阵', icon: 'Lock' },
      },
      {
        path: 'system/dicts',
        name: 'DictList',
        component: () => import('@/views/system/DictList.vue'),
        meta: { title: '数据字典', icon: 'Collection' },
      },
      {
        path: 'system/params',
        name: 'SystemParams',
        component: () => import('@/views/system/SystemParams.vue'),
        meta: { title: '系统参数', icon: 'Setting' },
      },
      {
        path: 'system/ops',
        name: 'SystemOps',
        component: () => import('@/views/system/SystemOps.vue'),
        meta: { title: '系统运维', icon: 'Monitor' },
      },
      {
        path: 'search',
        name: 'GlobalSearch',
        component: () => import('@/views/system/GlobalSearch.vue'),
        meta: { title: '全局检索', icon: 'Search' },
      },
      {
        path: 'approval-center',
        name: 'ApprovalCenter',
        component: () => import('@/views/system/ApprovalCenter.vue'),
        meta: { title: '审批中心', icon: 'Stamp' },
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
  'property': ['管理员', '总经理', '物业经理', '维修工'],
  'finance': ['管理员', '总经理', '财务主管', '会计', '出纳'],
  'contract': ['管理员', '总经理', '合同主管', '法务'],
  'fire': ['管理员', '总经理', '安全主管'],
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
      to.path.startsWith('/property') ? 'property' :
      to.path.startsWith('/finance') ? 'finance' :
      to.path.startsWith('/contract') ? 'contract' :
      to.path.startsWith('/fire') ? 'fire' :
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
