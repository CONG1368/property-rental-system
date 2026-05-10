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
import { authMiddleware } from '../middleware/auth';

const router = Router();

// 认证接口（无需登录）
router.use('/auth', authRoutes);

// 以下接口需要登录
router.use('/dashboard', authMiddleware, dashboardRoutes);
router.use('/properties', authMiddleware, propertyRoutes);
router.use('/tenants', authMiddleware, tenantRoutes);
router.use('/bills', authMiddleware, billRoutes);
router.use('/payment-records', authMiddleware, paymentRecordRoutes);
router.use('/dunning', authMiddleware, dunningRoutes);
router.use('/vouchers', authMiddleware, voucherRoutes);
router.use('/account-books', authMiddleware, accountBookRoutes);
router.use('/accounts', authMiddleware, accountRoutes);
router.use('/expenses', authMiddleware, expenseRoutes);
router.use('/tax', authMiddleware, taxRoutes);
router.use('/budgets', authMiddleware, budgetRoutes);
router.use('/reports', authMiddleware, reportRoutes);
router.use('/contracts', authMiddleware, contractRoutes);
router.use('/contract-templates', authMiddleware, contractTemplateRoutes);
router.use('/approvals', authMiddleware, approvalRoutes);
router.use('/compliance', authMiddleware, complianceRoutes);
router.use('/users', authMiddleware, userRoutes);
router.use('/dicts', authMiddleware, dictRoutes);
router.use('/audit-logs', authMiddleware, auditLogRoutes);

export default router;
