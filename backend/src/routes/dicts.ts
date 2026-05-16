import { Router } from 'express';
import DictType from '../models/DictType.js';
import DictItem from '../models/DictItem.js';
import { AuthRequest } from '../middleware/auth.js';

const router = Router();

// ===== 字典类型 =====

router.get('/types', async (_req: AuthRequest, res) => {
  try {
    const types = await DictType.findAll({ order: [['code', 'ASC']] });
    res.json({ code: 200, data: { list: types } });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

router.post('/types', async (req: AuthRequest, res) => {
  try {
    const { code, name } = req.body;
    if (!code || !name) return res.status(400).json({ code: 400, message: '编码和名称不能为空' });
    const existing = await DictType.findOne({ where: { code } });
    if (existing) return res.status(400).json({ code: 400, message: '字典编码已存在' });
    const type = await DictType.create({ code, name } as any);
    res.json({ code: 200, data: type, message: '字典类型创建成功' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

router.put('/types/:code', async (req: AuthRequest, res) => {
  try {
    const type = await DictType.findOne({ where: { code: req.params.code } });
    if (!type) return res.status(404).json({ code: 404, message: '字典类型不存在' });
    await type.update(req.body as any);
    res.json({ code: 200, data: type, message: '字典类型更新成功' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

router.delete('/types/:code', async (req: AuthRequest, res) => {
  try {
    const type = await DictType.findOne({ where: { code: req.params.code } });
    if (!type) return res.status(404).json({ code: 404, message: '字典类型不存在' });
    // 同时删除该类型下的所有字典项
    await DictItem.destroy({ where: { typeCode: req.params.code } } as any);
    await type.destroy();
    res.json({ code: 200, message: '字典类型已删除' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// ===== 字典项 =====

router.get('/items', async (req: AuthRequest, res) => {
  try {
    const { typeCode } = req.query;
    const where: any = {};
    if (typeCode) where.typeCode = typeCode;
    const items = await DictItem.findAll({ where, order: [['sortOrder', 'ASC']] });
    res.json({ code: 200, data: { list: items } });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

router.post('/items', async (req: AuthRequest, res) => {
  try {
    const { typeCode, code, name, sortOrder, isEnabled } = req.body;
    if (!typeCode || !code || !name) return res.status(400).json({ code: 400, message: '类型编码、编码和名称不能为空' });
    const item = await DictItem.create({ typeCode, code, name, sortOrder: sortOrder || 0, isEnabled: isEnabled !== false } as any);
    res.json({ code: 200, data: item, message: '字典项创建成功' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

router.put('/items/:id', async (req: AuthRequest, res) => {
  try {
    const item = await DictItem.findByPk(req.params.id);
    if (!item) return res.status(404).json({ code: 404, message: '字典项不存在' });
    await item.update(req.body as any);
    res.json({ code: 200, data: item, message: '字典项更新成功' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

router.delete('/items/:id', async (req: AuthRequest, res) => {
  try {
    const item = await DictItem.findByPk(req.params.id);
    if (!item) return res.status(404).json({ code: 404, message: '字典项不存在' });
    await item.destroy();
    res.json({ code: 200, message: '字典项已删除' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

export default router;
