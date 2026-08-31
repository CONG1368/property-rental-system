import { Router } from 'express';
import authRoutes from './auth.js';
import dashboardRoutes from './dashboard.js';
import propertyRoutes from './properties.js';
import tenantRoutes from './tenants.js';
import billRoutes from './bills.js';
import paymentRecordRoutes from './paymentRecords.js';
import dunningRoutes from './dunning.js';
import voucherRoutes from './vouchers.js';
import accountBookRoutes from './accountBooks.js';
import accountRoutes from './accounts.js';
import expenseRoutes from './expenses.js';
import taxRoutes from './tax.js';
import budgetRoutes from './budgets.js';
import fixedAssetRoutes from './fixedAssets.js';
import reportRoutes from './reports.js';
import contractRoutes from './contracts.js';
import contractTemplateRoutes from './contractTemplates.js';
import approvalRoutes from './approvals.js';
import complianceRoutes from './compliance.js';
import userRoutes from './users.js';
import dictRoutes from './dicts.js';
import auditLogRoutes from './auditLogs.js';
import notificationRoutes from './notifications.js';
import paymentCallbackRoutes from './paymentCallbacks.js';
import doorLockRoutes from './doorLocks.js';
import depositRoutes from './deposits.js';
import checkoutRoutes from './checkouts.js';
import parkingRoutes from './parking.js';
import complaintRoutes from './complaints.js';
import residentRoutes from './residents.js';
import facilityRoutes from './facilities.js';
import workOrderRoutes from './workOrders.js';
import vendorRoutes from './vendors.js';
import meterRoutes from './meters.js';
import bankReconciliationRoutes from './bankReconciliation.js';
import costAllocationRoutes from './costAllocation.js';
import invoiceRoutes from './invoices.js';
import propertyAnalyticsRoutes from './propertyAnalytics.js';
import propertyAutomationRoutes from './propertyAutomation.js';
import projectRoutes from './projects.js';
import tenantAuthRoutes from './tenantAuth.js';
import tenantPortalRoutes from './tenantPortal.js';
import briefingReportRoutes from './briefingReports.js';
import ocrRoutes from './ocr.js';
import leadRoutes from './leads.js';
import moveInRoutes from './moveIns.js';
import analyticsRoutes from './analytics.js';
import pricingRoutes from './pricing.js';
import decorationRoutes from './decoration.js';
import maintenancePlanRoutes from './maintenancePlans.js';
import approvalFlowRoutes from './approvalFlows.js';
import approvalRequestRoutes from './approvalRequests.js';
import propertyTaskRoutes from './propertyTasks.js';
import patrolRoutes from './patrols.js';
import visitorRoutes from './visitors.js';
import equipmentCertRoutes from './equipmentCertifications.js';
import searchRoutes from './search.js';
import exportRoutes from './export.js';
import permissionConfigRoutes from './permissionConfig.js';
import announcementRoutes from './announcements.js';
import commonRevenueRoutes from './commonRevenues.js';
import inventoryRoutes from './inventory.js';
import systemConfigRoutes from './systemConfigs.js';
import systemOpsRoutes from './systemOps.js';
import idCardReaderRoutes from './idCardReaders.js';
import fireSafetyRoutes from './fireSafety.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireAdmin, requireRole } from '../middleware/requireRole.js';
import { requireTenant } from '../middleware/tenantAuth.js';

const router = Router();

// 认证接口（无需登录）
router.use('/auth', authRoutes);

// 支付回调（无需登录，供外部系统调用）
router.use('/callbacks', paymentCallbackRoutes);

// 租户自助端登录（无需管理端登录）
router.use('/tenant-auth', tenantAuthRoutes);
router.use('/tenant-portal', requireTenant, tenantPortalRoutes);

// 经营简报月度报告
router.use('/briefing-reports', authMiddleware, requireRole('管理员', '总经理', '物业经理', '财务主管'), briefingReportRoutes);
router.use('/ocr', authMiddleware, requireRole('管理员', '收租主管', '收租员', '物业经理', '总经理', '财务主管'), ocrRoutes);
router.use('/leads', authMiddleware, requireRole('管理员', '收租主管', '收租员', '总经理'), leadRoutes);
router.use('/move-ins', authMiddleware, requireRole('管理员', '收租主管', '收租员', '总经理'), moveInRoutes);
router.use('/analytics', authMiddleware, requireRole('管理员', '总经理', '收租主管', '收租员', '物业经理', '财务主管'), analyticsRoutes);
router.use('/pricing', authMiddleware, requireRole('管理员', '收租主管', '总经理'), pricingRoutes);
router.use('/decorations', authMiddleware, requireRole('管理员', '物业经理', '总经理'), decorationRoutes);
router.use('/maintenance-plans', authMiddleware, requireRole('管理员', '物业经理', '维修工'), maintenancePlanRoutes);
router.use('/approval-flows', authMiddleware, requireAdmin, approvalFlowRoutes);
router.use('/approval-requests', authMiddleware, approvalRequestRoutes);
router.use('/property-tasks', authMiddleware, requireRole('管理员', '物业经理', '维修工'), propertyTaskRoutes);
router.use('/patrols', authMiddleware, requireRole('管理员', '物业经理', '维修工'), patrolRoutes);
router.use('/visitors', authMiddleware, requireRole('管理员', '物业经理', '维修工'), visitorRoutes);
router.use('/equipment-certifications', authMiddleware, requireRole('管理员', '物业经理', '维修工'), equipmentCertRoutes);
router.use('/search', authMiddleware, searchRoutes);
router.use('/export', authMiddleware, requireRole('管理员', '财务主管', '收租主管', '物业经理', '总经理'), exportRoutes);
router.use('/permissions', authMiddleware, requireAdmin, permissionConfigRoutes);

// 以下接口需要登录
router.use('/dashboard', authMiddleware, dashboardRoutes);

// 租赁管理 — 收租主管/收租员/管理员/总经理可访问
router.use('/properties', authMiddleware, requireRole('管理员', '收租主管', '收租员', '总经理'), propertyRoutes);
router.use('/tenants', authMiddleware, requireRole('管理员', '收租主管', '收租员', '总经理'), tenantRoutes);
router.use('/bills', authMiddleware, requireRole('管理员', '收租主管', '收租员', '总经理'), billRoutes);
router.use('/payment-records', authMiddleware, requireRole('管理员', '收租主管', '收租员', '总经理'), paymentRecordRoutes);
router.use('/dunning', authMiddleware, requireRole('管理员', '收租主管', '收租员', '总经理'), dunningRoutes);
router.use('/door-locks', authMiddleware, requireRole('管理员', '收租主管', '收租员', '总经理'), doorLockRoutes);
router.use('/deposits', authMiddleware, requireRole('管理员', '收租主管', '收租员', '总经理'), depositRoutes);
router.use('/checkouts', authMiddleware, requireRole('管理员', '收租主管', '收租员', '总经理'), checkoutRoutes);

// 物业管理 — 停车/投诉
router.use('/parking', authMiddleware, requireRole('管理员', '收租主管', '收租员', '物业经理', '总经理'), parkingRoutes);
router.use('/complaints', authMiddleware, requireRole('管理员', '收租主管', '收租员', '物业经理', '总经理'), complaintRoutes);
router.use('/residents', authMiddleware, requireRole('管理员', '收租主管', '收租员', '物业经理', '总经理'), residentRoutes);
router.use('/facilities', authMiddleware, requireRole('管理员', '收租主管', '收租员', '物业经理', '维修工', '总经理'), facilityRoutes);
router.use('/work-orders', authMiddleware, requireRole('管理员', '收租主管', '收租员', '物业经理', '维修工', '总经理'), workOrderRoutes);
router.use('/vendors', authMiddleware, requireRole('管理员', '收租主管', '收租员', '物业经理', '总经理'), vendorRoutes);
router.use('/meters', authMiddleware, requireRole('管理员', '收租主管', '收租员', '物业经理', '维修工', '总经理'), meterRoutes);

// 业财一体化 — 银行对账/成本分摊（财务角色组）
router.use('/bank-reconciliation', authMiddleware, requireRole('管理员', '财务主管', '会计', '出纳', '总经理'), bankReconciliationRoutes);
router.use('/cost-allocation', authMiddleware, requireRole('管理员', '财务主管', '会计', '出纳', '总经理'), costAllocationRoutes);
router.use('/invoices', authMiddleware, requireRole('管理员', '财务主管', '会计', '出纳', '总经理'), invoiceRoutes);

// 物业运营分析 — 经营看板
router.use('/property-analytics', authMiddleware, requireRole('管理员', '总经理', '物业经理', '维修工'), propertyAnalyticsRoutes);
router.use('/property-automation', authMiddleware, requireRole('管理员', '总经理', '物业经理', '维修工'), propertyAutomationRoutes);

// 项目/多业态管理
router.use('/projects', authMiddleware, requireRole('管理员', '总经理', '收租主管', '物业经理'), projectRoutes);
router.use('/announcements', authMiddleware, requireRole('管理员', '收租主管', '收租员', '物业经理', '总经理'), announcementRoutes);
router.use('/common-revenues', authMiddleware, requireRole('管理员', '收租主管', '收租员', '物业经理', '总经理'), commonRevenueRoutes);
router.use('/inventory', authMiddleware, requireRole('管理员', '收租主管', '收租员', '物业经理', '总经理'), inventoryRoutes);

// 财务管理 — 财务主管/会计/出纳/管理员/总经理可访问
router.use('/vouchers', authMiddleware, requireRole('管理员', '财务主管', '会计', '出纳', '总经理'), voucherRoutes);
router.use('/account-books', authMiddleware, requireRole('管理员', '财务主管', '会计', '总经理'), accountBookRoutes);
router.use('/accounts', authMiddleware, requireRole('管理员', '财务主管', '会计', '总经理'), accountRoutes);
router.use('/expenses', authMiddleware, requireRole('管理员', '财务主管', '会计', '出纳', '总经理'), expenseRoutes);
router.use('/tax', authMiddleware, requireRole('管理员', '财务主管', '会计', '总经理'), taxRoutes);
router.use('/budgets', authMiddleware, requireRole('管理员', '财务主管', '会计', '总经理'), budgetRoutes);
router.use('/fixed-assets', authMiddleware, requireRole('管理员', '财务主管', '会计', '总经理'), fixedAssetRoutes);
router.use('/reports', authMiddleware, requireRole('管理员', '总经理', '财务主管', '会计', '出纳', '收租主管', '收租员', '物业经理', '维修工'), reportRoutes);

// 合同管理 — 合同主管/法务/管理员/总经理可访问
router.use('/contracts', authMiddleware, requireRole('管理员', '合同主管', '法务', '总经理'), contractRoutes);
router.use('/contract-templates', authMiddleware, requireRole('管理员', '合同主管', '法务', '总经理'), contractTemplateRoutes);
router.use('/approvals', authMiddleware, requireRole('管理员', '合同主管', '法务', '总经理'), approvalRoutes);
router.use('/compliance', authMiddleware, requireRole('管理员', '法务', '总经理'), complianceRoutes);

// 通知中心 — 所有登录用户可访问
router.use('/notifications', authMiddleware, notificationRoutes);

// 系统设置 — 仅管理员可访问
router.use('/users', authMiddleware, requireAdmin, userRoutes);
router.use('/dicts', authMiddleware, requireAdmin, dictRoutes);
router.use('/audit-logs', authMiddleware, requireAdmin, auditLogRoutes);
// 系统配置 GET /keys 为只读（供打印/展示在非管理员场景使用），写操作在路由内部 requireAdmin+二次确认
router.use('/system-configs', authMiddleware, systemConfigRoutes);
router.use('/system-ops', authMiddleware, systemOpsRoutes);
router.use('/id-card-readers', authMiddleware, requireRole('管理员'), idCardReaderRoutes);

// 消防管理 — 管理员/收租主管/收租员/合同主管/总经理可访问
router.use('/fire-safety', authMiddleware, requireRole('管理员', '安全主管', '总经理'), fireSafetyRoutes);

// 404 统一 JSON 响应
router.use((_req, res) => {
  res.status(404).json({ code: 404, message: '接口不存在' });
});

export default router;
