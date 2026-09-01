import { Router } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { Op } from 'sequelize';
import Announcement from '../models/Announcement.js';

const router = Router();

// 列表（status/category/keyword 过滤，分页，按 publishDate DESC）
router.get('/', async (req: AuthRequest, res) => {
  try {
    const { page = '1', pageSize = '20', status, category, keyword } = req.query;
    const where: any = {};
    if (status) where.status = status;
    if (category) where.category = category;
    if (keyword) {
      where[Op.or] = [
        { title: { [Op.like]: `%${keyword}%` } },
        { content: { [Op.like]: `%${keyword}%` } },
      ];
    }
    const { count, rows } = await Announcement.findAndCountAll({
      where,
      limit: Number(pageSize),
      offset: (Number(page) - 1) * Number(pageSize),
      order: [['publishDate', 'DESC'], ['id', 'DESC']],
    });
    res.json({ code: 200, data: { total: count, list: rows, page: Number(page), pageSize: Number(pageSize) } });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// 创建（默认草稿）
router.post('/', async (req: AuthRequest, res) => {
  try {
    const a = await Announcement.create({
      ...req.body,
      status: '草稿',
      publisher: req.body.publisher || req.username || '',
    } as any);
    res.json({ code: 200, data: a, message: '公告已创建' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// 发布（设 status='已发布'、publishDate=今天）
router.post('/:id/publish', async (req: AuthRequest, res) => {
  try {
    const a = await Announcement.findByPk(req.params.id);
    if (!a) return res.status(404).json({ code: 404, message: '公告不存在' });
    await a.update({ status: '已发布', publishDate: new Date().toISOString().slice(0, 10) } as any);
    res.json({ code: 200, data: a, message: '公告已发布' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// 撤回（设 status='已撤回'）
router.post('/:id/revoke', async (req: AuthRequest, res) => {
  try {
    const a = await Announcement.findByPk(req.params.id);
    if (!a) return res.status(404).json({ code: 404, message: '公告不存在' });
    await a.update({ status: '已撤回' } as any);
    res.json({ code: 200, data: a, message: '公告已撤回' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// 更新
router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const a = await Announcement.findByPk(req.params.id);
    if (!a) return res.status(404).json({ code: 404, message: '公告不存在' });
    await a.update(req.body);
    res.json({ code: 200, data: a, message: '公告已更新' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// 删除
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const a = await Announcement.findByPk(req.params.id);
    if (!a) return res.status(404).json({ code: 404, message: '公告不存在' });
    await a.destroy();
    res.json({ code: 200, message: '公告已删除' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// 详情
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const a = await Announcement.findByPk(req.params.id);
    if (!a) return res.status(404).json({ code: 404, message: '公告不存在' });
    res.json({ code: 200, data: a });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

export default router;
