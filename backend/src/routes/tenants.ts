import { Router } from 'express';
import Tenant from '../models/Tenant';
import Contract from '../models/Contract';
import { AuthRequest } from '../middleware/auth';
import { Op } from 'sequelize';

const router = Router();

// GET /api/tenants — 租客列表
router.get('/', async (req: AuthRequest, res) => {
  try {
    const { page = 1, pageSize = 20, keyword, creditGrade, status } = req.query;
    const where: any = {};
    if (keyword) {
      where[Op.or] = [
        { name: { [Op.like]: `%${keyword}%` } },
        { phone: { [Op.like]: `%${keyword}%` } },
      ];
    }
    if (creditGrade) where.creditGrade = creditGrade;
    if (status) where.status = status;
    const { count, rows } = await Tenant.findAndCountAll({
      where,
      limit: Number(pageSize),
      offset: (Number(page) - 1) * Number(pageSize),
      order: [['createdAt', 'DESC']],
    });
    res.json({ code: 200, data: { total: count, list: rows, page: Number(page), pageSize: Number(pageSize) } });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

// POST /api/tenants — 创建租客
router.post('/', async (req: AuthRequest, res) => {
  try {
    const tenant = await Tenant.create(req.body);
    res.json({ code: 200, data: tenant, message: '租客创建成功' });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

// GET /api/tenants/:id — 租客详情（含关联合同）
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const tenant = await Tenant.findByPk(req.params.id, {
      include: [{ model: Contract, as: 'contracts' }],
    });
    if (!tenant) return res.status(404).json({ code: 404, message: '租客不存在' });
    res.json({ code: 200, data: tenant });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

// PUT /api/tenants/:id — 更新租客
router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const tenant = await Tenant.findByPk(req.params.id);
    if (!tenant) return res.status(404).json({ code: 404, message: '租客不存在' });
    await tenant.update(req.body);
    res.json({ code: 200, data: tenant, message: '租客更新成功' });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

// POST /api/tenants/:id/check-in — 入住办理
router.post('/:id/check-in', async (req: AuthRequest, res) => {
  try {
    const tenant = await Tenant.findByPk(req.params.id);
    if (!tenant) return res.status(404).json({ code: 404, message: '租客不存在' });
    await tenant.update({ status: '在租中' });
    res.json({ code: 200, data: tenant, message: '入住办理成功' });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

// POST /api/tenants/:id/check-out — 退租办理
router.post('/:id/check-out', async (req: AuthRequest, res) => {
  try {
    const tenant = await Tenant.findByPk(req.params.id);
    if (!tenant) return res.status(404).json({ code: 404, message: '租客不存在' });
    await tenant.update({ status: '已退租' });
    res.json({ code: 200, data: tenant, message: '退租办理成功' });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

export default router;
