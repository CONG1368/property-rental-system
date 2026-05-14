import { Router } from 'express';
import authRoutes from './auth';
import dashboardRoutes from './dashboard';
import propertyRoutes from './properties';
import tenantRoutes from './tenants';
import billRoutes from './bills';
import paymentRecordRoutes from './paymentRecords';
import dunningRoutes from './dunning';
import voucherRoutes from './vouchers';
import accountBookRoutes from './accountBooks';
import accountRoutes from './accounts';
import expenseRoutes from './expenses';
import taxRoutes from './tax';
import budgetRoutes from './budgets';
import reportRoutes from './reports';
import contractRoutes from './contracts';
import contractTemplateRoutes from './contractTemplates';
import approvalRoutes from './approvals';
import complianceRoutes from './compliance';
import userRoutes from './users';
import dictRoutes from './dicts';
import auditLogRoutes from './auditLogs';
import notificationRoutes from './notifications';
import paymentCallbackRoutes from './paymentCallbacks';
import { authMiddleware } from '../middleware/auth';
import { requireAdmin, requireRole } from '../middleware/requireRole';

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
