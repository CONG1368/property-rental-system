import { Router } from 'express';
import Project from '../models/Project.js';
import Property from '../models/Property.js';
import { AuthRequest } from '../middleware/auth.js';
import { Op, fn, col } from 'sequelize';

const router = Router();

// GET /api/projects — 项目列表
router.get('/', async (req: AuthRequest, res) => {
  try {
    const { page = 1, pageSize = 20, status, type, keyword } = req.query;
    const where: any = {};
    if (status) where.status = status;
    if (type) where.type = type;
    if (keyword) where[Op.or] = [{ name: { [Op.like]: `%${keyword}%` } }, { code: { [Op.like]: `%${keyword}%` } }];
    const { count, rows } = await Project.findAndCountAll({
      where, limit: Number(pageSize), offset: (Number(page) - 1) * Number(pageSize), order: [['createdAt', 'DESC']],
      include: [{ model: Property, as: 'properties', attributes: ['id', 'status'], separate: true }],
    });
    const list = rows.map((p: any) => { const j = p.toJSON(); j.propertyCount = j.properties?.length || 0; j.rentedCount = (j.properties || []).filter((x: any) => x.status === '已出租').length; delete j.properties; return j; });
    res.json({ code: 200, data: { total: count, list, page: Number(page), pageSize: Number(pageSize) } });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// GET /api/projects/overview — 各项目运营概览
router.get('/overview', async (_req: AuthRequest, res) => {
  try {
    const projects = await Project.findAll({ include: [{ model: Property, as: 'properties', attributes: ['id', 'status'], separate: true }] });
    const data = projects.map((p: any) => {
      const props = (p as any).properties || [];
      const total = props.length;
      const rented = props.filter((x: any) => x.status === '已出租').length;
      const vacant = props.filter((x: any) => x.status === '空置').length;
      return { id: p.id, name: p.name, type: p.type, status: p.status, total, rented, vacant, occupancyRate: total > 0 ? Math.round(rented / total * 100) : 0 };
    });
    res.json({ code: 200, data: data });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const p = await Project.findByPk(req.params.id, { include: [{ model: Property, as: 'properties', attributes: ['id', 'name', 'area', 'status'] }] });
    if (!p) return res.status(404).json({ code: 404, message: '项目不存在' });
    res.json({ code: 200, data: p });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

router.post('/', async (req: AuthRequest, res) => {
  try { const p = await Project.create(req.body as any); res.json({ code: 200, data: p, message: '项目已创建' }); }
  catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

router.put('/:id', async (req: AuthRequest, res) => {
  try { const p = await Project.findByPk(req.params.id); if (!p) return res.status(404).json({ code: 404, message: '项目不存在' }); await p.update(req.body); res.json({ code: 200, data: p, message: '项目已更新' }); }
  catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

router.delete('/:id', async (req: AuthRequest, res) => {
  try { const p = await Project.findByPk(req.params.id); if (!p) return res.status(404).json({ code: 404, message: '项目不存在' }); await p.destroy(); res.json({ code: 200, message: '项目已删除' }); }
  catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

export default router;
