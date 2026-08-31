import { Router } from 'express';
import MoveIn from '../models/MoveIn.js';
import Contract from '../models/Contract.js';
import Tenant from '../models/Tenant.js';
import Property from '../models/Property.js';
import { AuthRequest } from '../middleware/auth.js';
import { Op } from 'sequelize';

const router = Router();

// GET /api/move-ins — 入住交接列表（status/keyword 过滤，分页，按 createdAt DESC）
router.get('/', async (req: AuthRequest, res) => {
  try {
    const { page = 1, pageSize = 20, status, keyword } = req.query;
    const where: any = {};
    if (status) where.status = status;
    if (keyword) {
      const kw = `%${keyword}%`;
      const tenants = await Tenant.findAll({ where: { name: { [Op.like]: kw } }, attributes: ['id'], raw: true });
      const tenantIds = tenants.map((t: any) => t.id);
      const contracts = await Contract.findAll({ where: { contractNo: { [Op.like]: kw } }, attributes: ['id'], raw: true });
      const contractIds = contracts.map((c: any) => c.id);
      const properties = await Property.findAll({ where: { name: { [Op.like]: kw } }, attributes: ['id'], raw: true });
      const propertyIds = properties.map((p: any) => p.id);
      where[Op.or] = [
        { tenantId: { [Op.in]: tenantIds } },
        { contractId: { [Op.in]: contractIds } },
        { propertyId: { [Op.in]: propertyIds } },
      ];
    }
    const { count, rows } = await MoveIn.findAndCountAll({
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

// POST /api/move-ins — 创建（通过 contractId 自动带 tenantId/propertyId，可传 checkItems）
router.post('/', async (req: AuthRequest, res) => {
  try {
    const { contractId } = req.body;
    if (!contractId) return res.status(400).json({ code: 400, message: '请选择合同' });
    const contract = await Contract.findByPk(Number(contractId));
    if (!contract) return res.status(404).json({ code: 404, message: '合同不存在' });
    const mi = await MoveIn.create({
      contractId: Number(contractId),
      tenantId: (contract as any).tenantId,
      propertyId: (contract as any).propertyId,
      moveInDate: req.body.moveInDate || null,
      depositAmount: req.body.depositAmount !== undefined ? req.body.depositAmount : ((contract as any).depositAmount ?? 0),
      checkItems: req.body.checkItems || [],
      status: req.body.status || '待交接',
      notes: req.body.notes || '',
      createdBy: req.userId ?? null,
    } as any);
    res.json({ code: 200, data: mi, message: '入住交接已创建' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// GET /api/move-ins/:id — 详情
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const mi = await MoveIn.findByPk(req.params.id, {
      include: [
        { model: Contract, as: 'contract', attributes: ['id', 'contractNo'] },
        { model: Tenant, as: 'tenant', attributes: ['id', 'name'] },
        { model: Property, as: 'property', attributes: ['id', 'name'] },
      ],
    });
    if (!mi) return res.status(404).json({ code: 404, message: '入住交接记录不存在' });
    res.json({ code: 200, data: mi });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// PUT /api/move-ins/:id/update — 更新（含 checkItems）
router.put('/:id/update', async (req: AuthRequest, res) => {
  try {
    const mi = await MoveIn.findByPk(req.params.id);
    if (!mi) return res.status(404).json({ code: 404, message: '入住交接记录不存在' });
    const patch: any = {};
    if (req.body.moveInDate !== undefined) patch.moveInDate = req.body.moveInDate;
    if (req.body.depositAmount !== undefined) patch.depositAmount = req.body.depositAmount;
    if (req.body.status !== undefined) patch.status = req.body.status;
    if (req.body.notes !== undefined) patch.notes = req.body.notes;
    // 变更合同时自动重带租客/房源
    if (req.body.contractId !== undefined) {
      const contract = await Contract.findByPk(Number(req.body.contractId));
      if (!contract) return res.status(404).json({ code: 404, message: '合同不存在' });
      patch.contractId = Number(req.body.contractId);
      patch.tenantId = (contract as any).tenantId;
      patch.propertyId = (contract as any).propertyId;
    }
    // JSON 字段：SQLite 下 instance.update() 无法检测 JSON 变更，需用 .changed() 模式
    if (req.body.checkItems !== undefined) {
      (mi as any).checkItems = req.body.checkItems;
      (mi as any).changed('checkItems', true);
    }
    if (Object.keys(patch).length) await mi.update(patch as any);
    await mi.save();
    res.json({ code: 200, data: mi, message: '入住交接已更新' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// POST /api/move-ins/:id/complete — 完成交接（设 status='已完成'）
router.post('/:id/complete', async (req: AuthRequest, res) => {
  try {
    const mi = await MoveIn.findByPk(req.params.id);
    if (!mi) return res.status(404).json({ code: 404, message: '入住交接记录不存在' });
    if (req.body.checkItems !== undefined) {
      (mi as any).checkItems = req.body.checkItems;
      (mi as any).changed('checkItems', true);
    }
    await mi.update({
      status: '已完成',
      moveInDate: req.body.moveInDate || (mi as any).moveInDate || new Date().toISOString().slice(0, 10),
      notes: req.body.notes || (mi as any).notes,
    } as any);
    await mi.save();
    res.json({ code: 200, data: mi, message: '交接已完成' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// DELETE /api/move-ins/:id — 删除
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const mi = await MoveIn.findByPk(req.params.id);
    if (!mi) return res.status(404).json({ code: 404, message: '入住交接记录不存在' });
    await mi.destroy();
    res.json({ code: 200, message: '入住交接记录已删除' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

export default router;
