import { Router } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { Op } from 'sequelize';
import Material from '../models/Material.js';
import InventoryRecord from '../models/InventoryRecord.js';

const router = Router();

// ====== 物料列表（关键字/类别/状态过滤 + 分页） ======
router.get('/materials', async (req: AuthRequest, res) => {
  try {
    const { page = '1', pageSize = '20', keyword, category, status } = req.query;
    const where: any = {};
    if (category) where.category = category;
    if (status) where.status = status;
    if (keyword) {
      where[Op.or] = [
        { name: { [Op.like]: `%${keyword}%` } },
        { spec: { [Op.like]: `%${keyword}%` } },
        { supplier: { [Op.like]: `%${keyword}%` } },
        { location: { [Op.like]: `%${keyword}%` } },
      ];
    }
    const { count, rows } = await Material.findAndCountAll({
      where, limit: Number(pageSize), offset: (Number(page) - 1) * Number(pageSize),
      order: [['createdAt', 'DESC']],
      raw: false,
    });
    res.json({ code: 200, data: { total: count, list: rows, page: Number(page), pageSize: Number(pageSize) } });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// ====== 统计（总数/正常/低库存/耗尽）——固定路径，需放在 /:id 之前 ======
router.get('/materials/stats', async (_req: AuthRequest, res) => {
  try {
    const [total, normal, low, out] = await Promise.all([
      Material.count(),
      Material.count({ where: { status: '正常' } }),
      Material.count({ where: { status: '低库存' } }),
      Material.count({ where: { status: '耗尽' } }),
    ]);
    res.json({ code: 200, data: { total, normal, low, out } });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// ====== 创建物料 ======
router.post('/materials', async (req: AuthRequest, res) => {
  try {
    const m = await Material.create(req.body as any);
    res.json({ code: 200, data: m, message: '物料已创建' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// ====== 出入库记录（按日期倒序） ======
router.get('/materials/:id/records', async (req: AuthRequest, res) => {
  try {
    const records = await InventoryRecord.findAll({
      where: { materialId: Number(req.params.id) },
      order: [['date', 'DESC'], ['createdAt', 'DESC']],
      raw: true,
    });
    res.json({ code: 200, data: { list: records, total: records.length } });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// ====== 出入库操作：创建记录并更新/校验库存 ======
router.post('/materials/:id/in-out', async (req: AuthRequest, res) => {
  try {
    const m = await Material.findByPk(req.params.id);
    if (!m) return res.status(404).json({ code: 404, message: '物料不存在' });

    const { type, quantity, operator, date, reason, notes } = req.body;
    if (!['入库', '出库', '领用', '盘点'].includes(type)) {
      return res.status(400).json({ code: 400, message: '无效的出入库类型' });
    }
    const qty = Number(quantity);
    if (!qty || qty <= 0) return res.status(400).json({ code: 400, message: '数量必须大于0' });

    const currentQty = Number((m as any).quantity || 0);
    const minQty = Number((m as any).minQuantity || 0);
    let newQty = currentQty;

    if (type === '入库') {
      newQty = currentQty + qty;
    } else if (type === '出库' || type === '领用') {
      if (qty > currentQty) return res.status(400).json({ code: 400, message: '出库/领用数量超过当前库存' });
      newQty = currentQty - qty;
    } else if (type === '盘点') {
      // 盘点：以盘点数量作为实际库存
      newQty = qty;
    }

    let status = '正常';
    if (newQty <= 0) status = '耗尽';
    else if (minQty > 0 && newQty <= minQty) status = '低库存';

    await m.update({ quantity: newQty, status } as any);

    const record = await InventoryRecord.create({
      materialId: Number(req.params.id),
      type,
      quantity: qty,
      operator: operator || '',
      date: date || new Date().toISOString().slice(0, 10),
      reason: reason || '',
      notes: notes || '',
    } as any);

    res.json({ code: 200, data: { material: m, record }, message: '操作成功' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// ====== 更新物料 ======
router.put('/materials/:id', async (req: AuthRequest, res) => {
  try {
    const m = await Material.findByPk(req.params.id);
    if (!m) return res.status(404).json({ code: 404, message: '物料不存在' });
    await m.update(req.body);
    res.json({ code: 200, data: m, message: '物料已更新' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// ====== 删除物料（同时清理其出入库记录） ======
router.delete('/materials/:id', async (req: AuthRequest, res) => {
  try {
    const m = await Material.findByPk(req.params.id);
    if (!m) return res.status(404).json({ code: 404, message: '物料不存在' });
    await InventoryRecord.destroy({ where: { materialId: Number(req.params.id) } });
    await m.destroy();
    res.json({ code: 200, message: '物料已删除' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

export default router;
