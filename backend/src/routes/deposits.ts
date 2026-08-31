import { Router } from 'express';
import Deposit from '../models/Deposit.js';
import Contract from '../models/Contract.js';
import Tenant from '../models/Tenant.js';
import Property from '../models/Property.js';
import { AuthRequest } from '../middleware/auth.js';
import { Op } from 'sequelize';
import { requirePermission } from '../middleware/rbac.js';

const router = Router();

// 计算可退余额
function balanceOf(d: any): number {
  return Math.max(0, Number(d.amount) - Number(d.refundedAmount) - Number(d.deductionAmount));
}
function resolvedStatus(d: any, amount: number, refundedAmount: number): string {
  if (amount - refundedAmount - Number(d.deductionAmount || 0) <= 0) return '已退还';
  return refundedAmount > 0 ? '部分退还' : '在管';
}

// GET /api/deposits — 押金列表
router.get('/', async (req: AuthRequest, res) => {
  try {
    const { page = 1, pageSize = 20, keyword, status } = req.query;
    const where: any = {};
    if (status) where.status = status;
    if (keyword) {
      const tenants = await Tenant.findAll({ where: { name: { [Op.like]: `%${keyword}%` } }, attributes: ['id'], raw: true });
      const tenantIds = tenants.map(t => (t as any).id);
      const contracts = await Contract.findAll({ where: { contractNo: { [Op.like]: `%${keyword}%` } }, attributes: ['id'], raw: true });
      const contractIds = contracts.map(c => (c as any).id);
      where[Op.or] = [{ tenantId: { [Op.in]: tenantIds } }, { contractId: { [Op.in]: contractIds } }];
    }
    const { count, rows } = await Deposit.findAndCountAll({
      where, limit: Number(pageSize), offset: (Number(page) - 1) * Number(pageSize),
      order: [['createdAt', 'DESC']],
      include: [
        { model: Contract, as: 'contract', attributes: ['id', 'contractNo'] },
        { model: Tenant, as: 'tenant', attributes: ['id', 'name'] },
        { model: Property, as: 'property', attributes: ['id', 'name'] },
      ],
      raw: false,
    });
    const list = rows.map((d: any) => {
      const j = d.toJSON();
      j.balance = balanceOf(d);
      return j;
    });
    res.json({ code: 200, data: { total: count, list, page: Number(page), pageSize: Number(pageSize) } });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// GET /api/deposits/stats — 押金统计
router.get('/stats', async (_req: AuthRequest, res) => {
  try {
    const [total, inCustody, refunded, deducted] = await Promise.all([
      Deposit.count(),
      Deposit.count({ where: { status: '在管' } }),
      Deposit.sum('refundedAmount'),
      Deposit.sum('deductionAmount'),
    ]);
    res.json({ code: 200, data: { total, inCustody, refunded: refunded || 0, deducted: deducted || 0 } });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const d = await Deposit.findByPk(req.params.id, {
      include: [
        { model: Contract, as: 'contract', attributes: ['id', 'contractNo'] },
        { model: Tenant, as: 'tenant', attributes: ['id', 'name'] },
        { model: Property, as: 'property', attributes: ['id', 'name'] },
      ],
    });
    if (!d) return res.status(404).json({ code: 404, message: '押金记录不存在' });
    res.json({ code: 200, data: d });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

router.post('/', requirePermission('rent', 'create'), async (req: AuthRequest, res) => {
  try {
    const d = await Deposit.create({ ...req.body, createdBy: req.userId } as any);
    res.json({ code: 200, data: d, message: '押金登记成功' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// POST /api/deposits/:id/refund — 退还押金（可部分）
router.post('/:id/refund', requirePermission('rent', 'approve'), async (req: AuthRequest, res) => {
  try {
    const d = await Deposit.findByPk(req.params.id);
    if (!d) return res.status(404).json({ code: 404, message: '押金记录不存在' });
    const amount = Number(req.body.amount);
    if (amount <= 0) return res.status(400).json({ code: 400, message: '退还金额必须大于 0' });
    if (amount > balanceOf(d)) return res.status(400).json({ code: 400, message: '退还金额超过可退余额' });
    const newRefunded = Number(d.refundedAmount) + amount;
    await d.update({
      refundedAmount: newRefunded,
      refundDate: req.body.refundDate || new Date().toISOString().slice(0, 10),
      refundReason: req.body.reason || '',
      status: resolvedStatus(d, Number(d.amount), newRefunded),
    } as any);
    res.json({ code: 200, data: d, message: '押金退还成功' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// POST /api/deposits/:id/deduct — 扣除/抵扣押金（违约金、水电欠费等）
router.post('/:id/deduct', requirePermission('rent', 'approve'), async (req: AuthRequest, res) => {
  try {
    const d = await Deposit.findByPk(req.params.id);
    if (!d) return res.status(404).json({ code: 404, message: '押金记录不存在' });
    const amount = Number(req.body.amount);
    if (amount <= 0) return res.status(400).json({ code: 400, message: '扣除金额必须大于 0' });
    if (amount > balanceOf(d)) return res.status(400).json({ code: 400, message: '扣除金额超过可扣余额' });
    await d.update({
      deductionAmount: Number(d.deductionAmount) + amount,
      refundDate: req.body.refundDate || new Date().toISOString().slice(0, 10),
      refundReason: req.body.reason || '',
      status: '已抵扣',
    } as any);
    res.json({ code: 200, data: d, message: '押金扣除成功' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

router.delete('/:id', requirePermission('rent', 'delete'), async (req: AuthRequest, res) => {
  try {
    const d = await Deposit.findByPk(req.params.id);
    if (!d) return res.status(404).json({ code: 404, message: '押金记录不存在' });
    await d.destroy();
    res.json({ code: 200, message: '押金记录已删除' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

export default router;
