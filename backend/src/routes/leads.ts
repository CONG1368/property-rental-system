import { Router } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { Op, fn, col } from 'sequelize';
import Lead from '../models/Lead.js';
import Viewing from '../models/Viewing.js';
import Property from '../models/Property.js';

const router = Router();

// ====== 线索列表 ======
router.get('/', async (req: AuthRequest, res) => {
  try {
    const { page = '1', pageSize = '20', source, status, keyword, includeProperty } = req.query;
    const where: any = {};
    if (source) where.source = source;
    if (status) where.status = status;
    if (keyword) {
      const like = '%' + keyword + '%';
      where[Op.or] = [
        { name: { [Op.like]: like } },
        { phone: { [Op.like]: like } },
      ];
    }
    const include: any[] = [];
    if (includeProperty) include.push({ model: Property, as: 'property', attributes: ['id', 'name'] });
    const { count, rows } = await Lead.findAndCountAll({
      where,
      limit: Number(pageSize),
      offset: (Number(page) - 1) * Number(pageSize),
      order: [['createdAt', 'DESC']],
      include,
      raw: false,
    });
    res.json({ code: 200, data: { total: count, list: rows, page: Number(page), pageSize: Number(pageSize) } });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// ====== 漏斗统计 ======
router.get('/stats', async (_req: AuthRequest, res) => {
  try {
    const statuses = ['新线索', '已联系', '已看房', '已成交', '已流失'];
    const counts = await Promise.all(statuses.map(s => Lead.count({ where: { status: s } })));
    const bySource = await Lead.findAll({
      attributes: ['source', [fn('COUNT', col('id')), 'count']],
      group: ['source'],
      raw: true,
    });
    const funnel: Record<string, number> = {};
    statuses.forEach((s, i) => { funnel[s] = counts[i]; });
    res.json({
      code: 200,
      data: {
        funnel,
        bySource: bySource.map((s: any) => ({ source: s.source, count: Number(s.count) })),
      },
    });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// ====== 详情 ======
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const lead = await Lead.findByPk(req.params.id, {
      include: [
        { model: Property, as: 'property', attributes: ['id', 'name'] },
        { model: Viewing, as: 'viewings' },
      ],
    });
    if (!lead) return res.status(404).json({ code: 404, message: '线索不存在' });
    res.json({ code: 200, data: lead });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// ====== 创建（自动 status='新线索'） ======
router.post('/', async (req: AuthRequest, res) => {
  try {
    const lead = await Lead.create({ ...req.body, status: '新线索', createdBy: req.userId || null } as any);
    res.json({ code: 200, data: lead, message: '线索已创建' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// ====== 跟进（推进状态） ======
router.put('/:id/advance', async (req: AuthRequest, res) => {
  try {
    const lead = await Lead.findByPk(req.params.id);
    if (!lead) return res.status(404).json({ code: 404, message: '线索不存在' });
    const update: any = {};
    if (req.body.status !== undefined) update.status = req.body.status;
    if (req.body.nextFollowDate !== undefined) update.nextFollowDate = req.body.nextFollowDate;
    if (req.body.remark !== undefined) update.remark = req.body.remark;
    await lead.update(update);
    res.json({ code: 200, data: lead, message: '跟进已更新' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// ====== 更新 ======
router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const lead = await Lead.findByPk(req.params.id);
    if (!lead) return res.status(404).json({ code: 404, message: '线索不存在' });
    await lead.update(req.body);
    res.json({ code: 200, data: lead, message: '线索已更新' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// ====== 删除 ======
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const lead = await Lead.findByPk(req.params.id);
    if (!lead) return res.status(404).json({ code: 404, message: '线索不存在' });
    await lead.destroy();
    res.json({ code: 200, message: '线索已删除' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// ====== 创建看房记录 ======
router.post('/:id/viewings', async (req: AuthRequest, res) => {
  try {
    const lead = await Lead.findByPk(req.params.id);
    if (!lead) return res.status(404).json({ code: 404, message: '线索不存在' });
    const viewing = await Viewing.create({ ...req.body, leadId: Number(req.params.id) } as any);
    // 看房后自动推进线索状态（新线索/已联系 → 已看房）
    if ((lead as any).status === '新线索' || (lead as any).status === '已联系') {
      await lead.update({ status: '已看房' } as any);
    }
    res.json({ code: 200, data: viewing, message: '看房记录已创建' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

export default router;
