import { Router } from 'express';
import ContractTemplate from '../models/ContractTemplate.js';
import ContractClause from '../models/ContractClause.js';
import { AuthRequest } from '../middleware/auth.js';

const router = Router();

router.get('/', async (req: AuthRequest, res) => {
  try {
    const templates = await ContractTemplate.findAll({ order: [['createdAt', 'DESC']] });
    res.json({ code: 200, data: { list: templates } });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

router.post('/', async (req: AuthRequest, res) => {
  try {
    const body = { ...req.body };
    if (typeof body.content === 'string') body.content = { text: body.content };
    const template = await ContractTemplate.create(body);
    res.json({ code: 200, data: template, message: '模板创建成功' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const template = await ContractTemplate.findByPk(req.params.id, {
      include: [{ model: ContractClause, as: 'clauses' }],
    });
    if (!template) return res.status(404).json({ code: 404, message: '模板不存在' });
    res.json({ code: 200, data: template });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const template = await ContractTemplate.findByPk(req.params.id);
    if (!template) return res.status(404).json({ code: 404, message: '模板不存在' });
    const body = { ...req.body };
    if (typeof body.content === 'string') body.content = { text: body.content };
    await template.update(body);
    res.json({ code: 200, data: template, message: '模板更新成功' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

router.put('/:id/clauses', async (req: AuthRequest, res) => {
  try {
    const template = await ContractTemplate.findByPk(req.params.id);
    if (!template) return res.status(404).json({ code: 404, message: '模板不存在' });

    const { clauses } = req.body;
    if (!Array.isArray(clauses)) {
      return res.status(400).json({ code: 400, message: '条款数据格式不正确' });
    }

    // 先删后建
    await ContractClause.destroy({ where: { templateId: Number(req.params.id) } });
    for (const clause of clauses) {
      await ContractClause.create({ ...clause, templateId: Number(req.params.id) });
    }

    const updated = await ContractTemplate.findByPk(req.params.id, {
      include: [{ model: ContractClause, as: 'clauses' }],
    });
    res.json({ code: 200, data: updated, message: '条款已更新' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const template = await ContractTemplate.findByPk(req.params.id);
    if (!template) return res.status(404).json({ code: 404, message: '模板不存在' });
    await template.destroy();
    res.json({ code: 200, message: '模板已删除' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

export default router;
