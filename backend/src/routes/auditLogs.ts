import { Router } from 'express';
import { Op } from 'sequelize';
import AuditLog from '../models/AuditLog.js';
import { AuthRequest } from '../middleware/auth.js';

const router = Router();

function buildWhere(req: AuthRequest) {
  const { module, userId, action, keyword, status, startDate, endDate } = req.query;
  const where: any = {};
  if (module) where.module = module;
  if (userId) where.userId = userId;
  if (action) where.action = action;
  if (status === 'fail') where.action = { [Op.like]: '%(失败)%' };
  else if (status === 'success') where.action = { [Op.notLike]: '%(失败)%' };
  if (keyword) {
    where[Op.or] = [
      { action: { [Op.like]: '%' + keyword + '%' } },
      { module: { [Op.like]: '%' + keyword + '%' } },
      { targetType: { [Op.like]: '%' + keyword + '%' } },
      { ip: { [Op.like]: '%' + keyword + '%' } },
    ];
  }
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt[Op.gte] = new Date(String(startDate));
    if (endDate) where.createdAt[Op.lte] = new Date(String(endDate) + 'T23:59:59');
  }
  return where;
}

router.get('/', async (req: AuthRequest, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(200, Math.max(1, Number(req.query.pageSize) || 50));
    const where = buildWhere(req);
    const { count, rows } = await AuditLog.findAndCountAll({
      where,
      limit: pageSize, offset: (page - 1) * pageSize,
      order: [['createdAt', 'DESC']],
    });
    res.json({ code: 200, data: { total: count, list: rows, page, pageSize } });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// GET /audit-logs/export?format=csv — 导出筛选结果
router.get('/export', async (req: AuthRequest, res) => {
  try {
    const where = buildWhere(req);
    const limit = Math.min(5000, Number(req.query.limit) || 5000);
    const rows = await AuditLog.findAll({ where, order: [['createdAt', 'DESC']], limit });
    const header = ['id', 'userId', 'action', 'module', 'targetType', 'targetId', 'ip', 'detail', 'createdAt'];
    const esc = (v: any) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
    const lines = [header.join(',')];
    rows.forEach((r: any) => lines.push(header.map(h => esc(r[h])).join(',')));
    const csv = '\ufeff' + lines.join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=audit_logs_' + Date.now() + '.csv');
    res.send(csv);
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

export default router;
