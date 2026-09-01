import { Router } from 'express';
import FlowDefinition from '../models/FlowDefinition.js';
import { AuthRequest } from '../middleware/auth.js';
import { Op } from 'sequelize';

const router = Router();

router.get('/', async (req: AuthRequest, res) => {
  try {
    const { status, keyword } = req.query;
    const where: any = {};
    if (status) where.status = status;
    if (keyword) where[Op.or] = [{ name: { [Op.like]: `%${keyword}%` } }, { bizType: { [Op.like]: `%${keyword}%` } }];
    const rows = await FlowDefinition.findAll({ where, order: [['id', 'ASC']] });
    res.json({ code: 200, data: { list: rows } });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

router.post('/', async (req: AuthRequest, res) => {
  try { const f = await FlowDefinition.create({ ...req.body, createdBy: req.userId } as any); res.json({ code: 200, data: f, message: '流程已创建' }); }
  catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

router.put('/:id', async (req: AuthRequest, res) => {
  try { const f = await FlowDefinition.findByPk(req.params.id); if (!f) return res.status(404).json({ code: 404, message: '流程不存在' }); await f.update(req.body); res.json({ code: 200, data: f, message: '流程已更新' }); }
  catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

router.delete('/:id', async (req: AuthRequest, res) => {
  try { const f = await FlowDefinition.findByPk(req.params.id); if (!f) return res.status(404).json({ code: 404, message: '流程不存在' }); await f.destroy(); res.json({ code: 200, message: '流程已删除' }); }
  catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

export default router;
