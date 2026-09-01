import { Router } from 'express';
import Checkout from '../models/Checkout.js';
import Contract from '../models/Contract.js';
import Tenant from '../models/Tenant.js';
import Property from '../models/Property.js';
import Deposit from '../models/Deposit.js';
import { AuthRequest } from '../middleware/auth.js';
import { transitionRoomStatus } from '../services/room-status-workflow.js';
import { requirePermission } from '../middleware/rbac.js';

const router = Router();

// GET /api/checkouts — 退租列表
router.get('/', async (req: AuthRequest, res) => {
  try {
    const { page = 1, pageSize = 20, status } = req.query;
    const where: any = {};
    if (status) where.status = status;
    const { count, rows } = await Checkout.findAndCountAll({
      where, limit: Number(pageSize), offset: (Number(page) - 1) * Number(pageSize),
      order: [['createdAt', 'DESC']],
      include: [
        { model: Contract, as: 'contract', attributes: ['id', 'contractNo'] },
        { model: Tenant, as: 'tenant', attributes: ['id', 'name'] },
        { model: Property, as: 'property', attributes: ['id', 'name'] },
      ],
      raw: false,
    });
    res.json({ code: 200, data: { total: count, list: rows, page: Number(page), pageSize: Number(pageSize) } });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// PUT /api/checkouts/:id/status — 流转状态
router.put('/:id/status', requirePermission('rent', 'update'), async (req: AuthRequest, res) => {
  try {
    const co = await Checkout.findByPk(req.params.id);
    if (!co) return res.status(404).json({ code: 404, message: '退租单不存在' });
    const newStatus = req.body.status;
    const patch: any = { status: newStatus };
    if (req.body.handoverDate) patch.handoverDate = req.body.handoverDate;
    // JSON 字段：SQLite 下 instance.update() 无法检测 JSON 变更，需用 .changed() 模式
    if (req.body.checklist !== undefined) { (co as any).checklist = req.body.checklist; (co as any).changed('checklist', true); }
    if (req.body.costs !== undefined) { (co as any).costs = req.body.costs; (co as any).changed('costs', true); }
    await co.update(patch as any);
    await co.save();
    res.json({ code: 200, data: co, message: '退租单状态已更新' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// POST /api/checkouts — 提交退租申请
router.post('/', requirePermission('rent', 'create'), async (req: AuthRequest, res) => {
  try {
    const co = await Checkout.create({ ...req.body, createdBy: req.userId } as any);
    // 若房源处于已出租，自动流转为退租中
    try { await transitionRoomStatus(Number(co.propertyId), '退租中', req.userId ?? 0, { notes: '租客提交退租申请' }); } catch { /* 状态机校验失败则忽略 */ }
    res.json({ code: 200, data: co, message: '退租申请已提交' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// POST /api/checkouts/:id/complete — 完成退租（结算+交接）
router.post('/:id/complete', requirePermission('rent', 'approve'), async (req: AuthRequest, res) => {
  try {
    const co = await Checkout.findByPk(req.params.id);
    if (!co) return res.status(404).json({ code: 404, message: '退租单不存在' });
    if (req.body.settlement !== undefined) { (co as any).settlement = req.body.settlement; (co as any).changed('settlement', true); }
    if (req.body.costs !== undefined) { (co as any).costs = req.body.costs; (co as any).changed('costs', true); }
    await co.update({
      status: '已完成',
      handoverDate: req.body.handoverDate || new Date().toISOString().slice(0, 10),
      depositRefundAmount: req.body.depositRefundAmount || co.depositRefundAmount,
      notes: req.body.notes || (co as any).notes,
    } as any);
    await co.save();
    // 关联租客设为已退租、合同终止、房源流转为待保洁
    await Tenant.update({ status: '已退租' }, { where: { id: co.tenantId } } as any);
    await Contract.update({ status: '已终止' }, { where: { id: co.contractId } } as any);
    // 退租押金联动结算：按结算项自动核销该合同押金
    try {
      const deposit = await Deposit.findOne({ where: { contractId: co.contractId } });
      if (deposit) {
        const costs = Array.isArray(req.body.costs) ? req.body.costs : ((co as any).costs || []);
        const deduction = costs.filter((c: any) => c.type === '扣除').reduce((s: number, c: any) => s + Number(c.amount || 0), 0);
        const refund = Number(req.body.depositRefundAmount || 0);
        const refunded = Number((deposit as any).refundedAmount || 0) + refund;
        const deducted = Number((deposit as any).deductionAmount || 0) + deduction;
        await (deposit as any).update({
          refundedAmount: refunded, deductionAmount: deducted,
          refundReason: '退租结算', refundDate: new Date().toISOString().slice(0, 10),
          status: (Number((deposit as any).amount) - refunded - deducted) <= 0 ? '已退还' : (refunded > 0 || deducted > 0 ? '部分退还' : '在管'),
        } as any);
      }
    } catch (e) { /* 忽略押金联动失败 */ }
    try { await transitionRoomStatus(Number(co.propertyId), '待保洁', req.userId ?? 0, { notes: '退租交接完成' }); } catch { /* 忽略状态机限制 */ }
    res.json({ code: 200, data: co, message: '退租流程已完成' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// GET /api/checkouts/:id — 退租详情
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const co = await Checkout.findByPk(req.params.id, {
      include: [
        { model: Contract, as: 'contract', attributes: ['id', 'contractNo'] },
        { model: Tenant, as: 'tenant', attributes: ['id', 'name'] },
        { model: Property, as: 'property', attributes: ['id', 'name'] },
      ],
    });
    if (!co) return res.status(404).json({ code: 404, message: '退租单不存在' });
    res.json({ code: 200, data: co });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

router.delete('/:id', requirePermission('rent', 'delete'), async (req: AuthRequest, res) => {
  try {
    const co = await Checkout.findByPk(req.params.id);
    if (!co) return res.status(404).json({ code: 404, message: '退租单不存在' });
    await co.destroy();
    res.json({ code: 200, message: '退租单已删除' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

export default router;
