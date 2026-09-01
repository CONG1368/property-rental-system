import { Router } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import Contract from '../models/Contract.js';
import Property from '../models/Property.js';
import { Op } from 'sequelize';
import { quoteRent, batchAdjustContracts } from '../services/pricing-service.js';

const router = Router();

// GET /api/pricing/quote —— 定价推荐（面积×单价）
router.get('/quote', async (req: AuthRequest, res) => {
  try {
    const area = Number(req.query.area || 0);
    const unitPrice = Number(req.query.unitPrice || 0);
    const recommended = quoteRent(area, unitPrice);
    res.json({ code: 200, data: { area, unitPrice, recommended } });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// GET /api/pricing/contracts —— 执行中合同（含业态/面积/当前租金）
router.get('/contracts', async (req: AuthRequest, res) => {
  try {
    const { type } = req.query;
    const where: any = { status: '执行中' };
    if (type) {
      const props = await Property.findAll({ where: { type: type as any }, attributes: ['id'], raw: true });
      where.propertyId = { [Op.in]: props.map((p: any) => p.id) };
    }
    const contracts = await Contract.findAll({ where, include: [{ model: Property, as: 'property', attributes: ['id', 'name', 'area', 'type'] }], order: [['createdAt', 'DESC']] });
    const list = contracts.map((c: any) => { const j = c.toJSON(); j.area = j.property?.area || 0; j.type = j.property?.type || '其他'; return j; });
    res.json({ code: 200, data: { list } });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// POST /api/pricing/batch-adjust —— 批量调价
router.post('/batch-adjust', async (req: AuthRequest, res) => {
  try {
    const { contractIds, rate } = req.body;
    if (!Array.isArray(contractIds) || !contractIds.length) return res.status(400).json({ code: 400, message: '请选择合同' });
    if (rate === undefined || rate === null) return res.status(400).json({ code: 400, message: '请填写调价比例' });
    const n = await batchAdjustContracts(contractIds.map(Number), Number(rate));
    res.json({ code: 200, data: { adjusted: n }, message: `已调整 ${n} 份合同月租金` });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

export default router;
