import { Router } from 'express';
import Resident from '../models/Resident.js';
import Property from '../models/Property.js';
import { AuthRequest } from '../middleware/auth.js';
import { Op } from 'sequelize';

const router = Router();

router.get('/', async (req: AuthRequest, res) => {
  try {
    const { page = 1, pageSize = 20, keyword, type, status, isOwner } = req.query;
    const where: any = {};
    if (type) where.type = type;
    if (status) where.status = status;
    if (isOwner === 'true') where.isOwner = true;
    if (keyword) where[Op.or] = [{ name: { [Op.like]: `%${keyword}%` } }, { phone: { [Op.like]: `%${keyword}%` } }, { idNumber: { [Op.like]: `%${keyword}%` } }];
    const { count, rows } = await Resident.findAndCountAll({
      where, limit: Number(pageSize), offset: (Number(page) - 1) * Number(pageSize),
      order: [['createdAt', 'DESC']],
      include: [{ model: Property, as: 'property', attributes: ['id', 'name'] }],
      raw: false,
    });
    res.json({ code: 200, data: { total: count, list: rows, page: Number(page), pageSize: Number(pageSize) } });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

router.get('/stats', async (_req: AuthRequest, res) => {
  try {
    const [total, owners, residents, moved] = await Promise.all([
      Resident.count(),
      Resident.count({ where: { isOwner: true } }),
      Resident.count({ where: { status: '在住' } }),
      Resident.count({ where: { status: '已搬离' } }),
    ]);
    res.json({ code: 200, data: { total, owners, residents, moved } });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

router.post('/', async (req: AuthRequest, res) => {
  try { const r = await Resident.create(req.body as any); res.json({ code: 200, data: r, message: '住户档案已创建' }); }
  catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

router.put('/:id', async (req: AuthRequest, res) => {
  try { const r = await Resident.findByPk(req.params.id); if (!r) return res.status(404).json({ code: 404, message: '住户不存在' }); await r.update(req.body); res.json({ code: 200, data: r, message: '已更新' }); }
  catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

router.delete('/:id', async (req: AuthRequest, res) => {
  try { const r = await Resident.findByPk(req.params.id); if (!r) return res.status(404).json({ code: 404, message: '住户不存在' }); await r.destroy(); res.json({ code: 200, message: '已删除' }); }
  catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

export default router;
