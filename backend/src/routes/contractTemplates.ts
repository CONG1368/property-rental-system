import { Router } from 'express';
import ContractTemplate from '../models/ContractTemplate';
import ContractClause from '../models/ContractClause';
import { AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/', async (req: AuthRequest, res) => {
  try {
    const templates = await ContractTemplate.findAll({ order: [['createdAt', 'DESC']] });
    res.json({ code: 200, data: { list: templates } });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

router.post('/', async (req: AuthRequest, res) => {
  try {
    const template = await ContractTemplate.create(req.body);
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
    await template.update(req.body);
    res.json({ code: 200, data: template, message: '模板更新成功' });
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
