import { Router } from 'express';
import FixedAsset from '../models/FixedAsset.js';
import AccountBook from '../models/AccountBook.js';
import { AuthRequest } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { requireConfirmPassword } from '../middleware/confirm-password.js';
import { auditLog } from '../middleware/audit-log.js';
import { Op } from 'sequelize';
import { runMonthlyDepreciation } from '../services/depreciation.js';

const router = Router();

// POST /api/fixed-assets/depreciate — 执行本月折旧（需财务主管/管理员）
router.post('/depreciate', requirePermission('finance', 'approve'), auditLog('固定资产', '折旧计提'), async (_req: AuthRequest, res) => {
  try {
    const processed = await runMonthlyDepreciation();
    res.json({ code: 200, data: { processed }, message: '已完成 ' + processed + ' 项固定资产折旧计提' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// GET /api/fixed-assets — 固定资产列表
router.get('/', requirePermission('finance', 'read'), async (req: AuthRequest, res) => {
  try {
    const { page = 1, pageSize = 20, keyword, category, status } = req.query;
    const p = Math.max(1, Number(page) || 1);
    const ps = Math.min(200, Math.max(1, Number(pageSize) || 20));
    const where: any = {};
    if (keyword) where[Op.or] = [{ name: { [Op.like]: '%' + keyword + '%' } }, { category: { [Op.like]: '%' + keyword + '%' } }];
    if (category) where.category = category;
    if (status) where.status = status;
    const { count, rows } = await FixedAsset.findAndCountAll({
      where, limit: ps, offset: (p - 1) * ps,
      order: [['createdAt', 'DESC']],
      include: [{ model: AccountBook, as: 'book', attributes: ['id', 'name'] }],
      raw: false,
    });
    res.json({ code: 200, data: { total: count, list: rows, page: p, pageSize: ps } });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// GET /api/fixed-assets/stats — 折旧统计
router.get('/stats', requirePermission('finance', 'read'), async (_req: AuthRequest, res) => {
  try {
    const [total, inUse, done, totalValue] = await Promise.all([
      FixedAsset.count(),
      FixedAsset.count({ where: { status: '使用中' } }),
      FixedAsset.count({ where: { status: '已折旧完毕' } }),
      FixedAsset.sum('originalValue'),
    ]);
    res.json({ code: 200, data: { total, inUse, done, totalValue: totalValue || 0 } });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

router.get('/:id', requirePermission('finance', 'read'), async (req: AuthRequest, res) => {
  try {
    const asset = await FixedAsset.findByPk(req.params.id, {
      include: [{ model: AccountBook, as: 'book', attributes: ['id', 'name'] }],
    });
    if (!asset) return res.status(404).json({ code: 404, message: '固定资产不存在' });
    res.json({ code: 200, data: asset });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

router.post('/', requirePermission('finance', 'create'), auditLog('固定资产', '新增'), async (req: AuthRequest, res) => {
  try {
    const asset = await FixedAsset.create({ ...req.body, createdBy: req.userId } as any);
    res.json({ code: 200, data: asset, message: '固定资产已创建' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// 可更新字段白名单：status/折旧类字段由折旧服务或状态端点维护，禁止在此直接写入
const ASSET_UPDATABLE = ['name', 'category', 'originalValue', 'status', 'purchaseDate', 'location', 'department', 'custodian', 'remark', 'bookId'];
router.put('/:id', requirePermission('finance', 'update'), auditLog('固定资产', '修改'), async (req: AuthRequest, res) => {
  try {
    const asset = await FixedAsset.findByPk(req.params.id);
    if (!asset) return res.status(404).json({ code: 404, message: '固定资产不存在' });
    const upd: any = {};
    ASSET_UPDATABLE.forEach((k) => { if (req.body[k] !== undefined) upd[k] = req.body[k]; });
    await asset.update(upd);
    res.json({ code: 200, data: asset, message: '固定资产已更新' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

router.delete('/:id', requirePermission('finance', 'delete'), requireConfirmPassword('删除固定资产'), auditLog('固定资产', '删除'), async (req: AuthRequest, res) => {
  try {
    const asset = await FixedAsset.findByPk(req.params.id);
    if (!asset) return res.status(404).json({ code: 404, message: '固定资产不存在' });
    await asset.destroy();
    res.json({ code: 200, message: '固定资产已删除' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

export default router;
