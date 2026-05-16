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
import { authMiddleware } from '../middleware/auth.js';
import { requireAdmin, requireRole } from '../middleware/requireRole.js';

const router = Router();

// 认证接口（无需登录）
router.use('/auth', authRoutes);

// 支付回调（无需登录，供外部系统调用）
router.use('/callbacks', paymentCallbackRoutes);

// 以下接口需要登录
router.use('/dashboard', authMiddleware, dashboardRoutes);

// 租赁管理 — 收租主管/收租员/管理员/总经理可访问
router.use('/properties', authMiddleware, requireRole('管理员', '收租主管', '收租员', '总经理'), propertyRoutes);
router.use('/tenants', authMiddleware, requireRole('管理员', '收租主管', '收租员', '总经理'), tenantRoutes);
router.use('/bills', authMiddleware, requireRole('管理员', '收租主管', '收租员', '总经理'), billRoutes);
router.use('/payment-records', authMiddleware, requireRole('管理员', '收租主管', '收租员', '总经理'), paymentRecordRoutes);
router.use('/dunning', authMiddleware, requireRole('管理员', '收租主管', '收租员', '总经理'), dunningRoutes);

// 财务管理 — 财务主管/会计/出纳/管理员/总经理可访问
router.use('/vouchers', authMiddleware, requireRole('管理员', '财务主管', '会计', '出纳', '总经理'), voucherRoutes);
router.use('/account-books', authMiddleware, requireRole('管理员', '财务主管', '会计', '总经理'), accountBookRoutes);
router.use('/accounts', authMiddleware, requireRole('管理员', '财务主管', '会计', '总经理'), accountRoutes);
router.use('/expenses', authMiddleware, requireRole('管理员', '财务主管', '会计', '出纳', '总经理'), expenseRoutes);
router.use('/tax', authMiddleware, requireRole('管理员', '财务主管', '会计', '总经理'), taxRoutes);
router.use('/budgets', authMiddleware, requireRole('管理员', '财务主管', '会计', '总经理'), budgetRoutes);
router.use('/reports', authMiddleware, requireRole('管理员', '财务主管', '会计', '总经理', '收租主管'), reportRoutes);

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

// 404 统一 JSON 响应
router.use((_req, res) => {
  res.status(404).json({ code: 404, message: '接口不存在' });
});

export default router;
