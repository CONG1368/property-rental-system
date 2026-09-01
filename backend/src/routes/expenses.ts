import { Router } from 'express';
import Expense from '../models/Expense.js';
import { AuthRequest } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { requireConfirmPassword } from '../middleware/confirm-password.js';
import { auditLog } from '../middleware/audit-log.js';
import { submitApproval } from '../services/approval-bridge.js';

const router = Router();

router.get('/', async (req: AuthRequest, res) => {
  try {
    const { page = 1, pageSize = 20, bookId, category, status } = req.query;
    const where: any = {};
    if (bookId) where.bookId = Number(bookId);
    if (category) where.category = category;
    if (status) where.status = status;
    const { count, rows } = await Expense.findAndCountAll({
      where, limit: Number(pageSize), offset: (Number(page) - 1) * Number(pageSize),
      order: [['createdAt', 'DESC']],
    });
    res.json({ code: 200, data: { total: count, list: rows, page: Number(page), pageSize: Number(pageSize) } });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// 大额费用阈值：超过则自动走通用审批引擎（bizType=费用）；未配置流程则静默跳过
const LARGE_AMOUNT_THRESHOLD = Number(process.env.LARGE_EXPENSE_THRESHOLD || 5000);
router.post('/', requirePermission('finance', 'create'), auditLog('expense', '费用新增'), async (req: AuthRequest, res) => {
  try {
    const expense = await Expense.create({ ...req.body, createdBy: req.userId });
    const amount = Number(expense.get('amount') || 0);
    if (amount >= LARGE_AMOUNT_THRESHOLD) {
      try { await submitApproval({ bizType: '费用', bizId: (expense as any).id, bizNo: '费用-' + (expense as any).id, title: '大额费用审批：' + amount + '元', applicantName: (req as any).username || '', amount }, req.userId); } catch { /* 忽略 */ }
    }
    res.json({ code: 200, data: expense, message: '费用记录创建成功' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

router.put('/:id/approve', requirePermission('finance', 'approve'), requireConfirmPassword('费用审批'), auditLog('expense', '费用审批'), async (req: AuthRequest, res) => {
  try {
    const expense = await Expense.findByPk(req.params.id);
    if (!expense) return res.status(404).json({ code: 404, message: '费用记录不存在' });
    await expense.update({ status: '已批准' });
    res.json({ code: 200, data: expense, message: '费用已批准' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

router.delete('/:id', requirePermission('finance', 'delete'), auditLog('expense', '费用删除'), async (req: AuthRequest, res) => {
  try {
    const expense = await Expense.findByPk(req.params.id);
    if (!expense) return res.status(404).json({ code: 404, message: '费用记录不存在' });
    await expense.destroy();
    res.json({ code: 200, message: '费用记录已删除' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

export default router;
