import { Router } from 'express';
import { Op } from 'sequelize';
import Tenant from '../models/Tenant.js';
import Contract from '../models/Contract.js';
import Property from '../models/Property.js';
import Bill from '../models/Bill.js';
import WorkOrder from '../models/WorkOrder.js';
import Announcement from '../models/Announcement.js';
import Notification from '../models/Notification.js';
import { TenantAuthRequest } from '../middleware/tenantAuth.js';

const router = Router();

// GET /api/tenant-portal/profile — 我的资料 + 合同
router.get('/profile', async (req: TenantAuthRequest, res) => {
  try {
    const tenant = await Tenant.findByPk(req.tenantId);
    if (!tenant) return res.status(404).json({ code: 404, message: '租户不存在' });
    const contracts = await Contract.findAll({ where: { tenantId: req.tenantId }, include: [{ model: Property, as: 'property', attributes: ['id', 'name'] }], order: [['endDate', 'DESC']] });
    const j = (tenant as any).toJSON(); delete j.loginPin;
    res.json({ code: 200, data: { tenant: j, contracts } });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// GET /api/tenant-portal/bills — 我的账单
router.get('/bills', async (req: TenantAuthRequest, res) => {
  try {
    const { page = 1, pageSize = 20, status } = req.query;
    const contracts = await Contract.findAll({ where: { tenantId: req.tenantId }, attributes: ['id'], raw: true });
    const cids = contracts.map(c => (c as any).id);
    const where: any = { contractId: { [Op.in]: cids } };
    if (status) where.status = status;
    const { count, rows } = await Bill.findAndCountAll({ where, limit: Number(pageSize), offset: (Number(page) - 1) * Number(pageSize), order: [['dueDate', 'DESC']] });
    res.json({ code: 200, data: { total: count, list: rows, page: Number(page), pageSize: Number(pageSize) } });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// GET /api/tenant-portal/repairs — 我的报修
router.get('/repairs', async (req: TenantAuthRequest, res) => {
  try {
    const rows = await WorkOrder.findAll({ where: { tenantId: req.tenantId }, order: [['createdAt', 'DESC']], include: [{ model: Property, as: 'property', attributes: ['id', 'name'] }] });
    res.json({ code: 200, data: { list: rows } });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// POST /api/tenant-portal/repairs — 提交报修
router.post('/repairs', async (req: TenantAuthRequest, res) => {
  try {
    const { contractId, title, description, priority } = req.body;
    const contract = await Contract.findOne({ where: { id: contractId, tenantId: req.tenantId } });
    if (!contract) return res.status(400).json({ code: 400, message: '合同无效' });
    const wo = await WorkOrder.create({ propertyId: (contract as any).propertyId, tenantId: req.tenantId, title, type: '报修', priority: priority || '中', description: description || '', reporter: req.tenantName, phone: (contract as any).tenantId ? undefined : undefined } as any);
    res.json({ code: 200, data: wo, message: '报修已提交' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// GET /api/tenant-portal/announcements — 公告
router.get('/announcements', async (_req: TenantAuthRequest, res) => {
  try {
    const rows = await Announcement.findAll({ where: { status: '已发布' }, order: [['publishDate', 'DESC']], limit: 50 });
    res.json({ code: 200, data: { list: rows } });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// GET /api/tenant-portal/notifications — 我的消息
router.get('/notifications', async (req: TenantAuthRequest, res) => {
  try {
    const { page = 1, pageSize = 20 } = req.query;
    const { count, rows } = await Notification.findAndCountAll({
      where: { [Op.or]: [{ recipientId: req.tenantId, recipientType: 'tenant' }, { recipientId: 0, recipientType: 'tenant' }] },
      order: [['createdAt', 'DESC']], limit: Number(pageSize), offset: (Number(page) - 1) * Number(pageSize),
    });
    res.json({ code: 200, data: { total: count, list: rows, page: Number(page), pageSize: Number(pageSize) } });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// PUT /api/tenant-portal/notifications/:id/read
router.put('/notifications/:id/read', async (req: TenantAuthRequest, res) => {
  try {
    await Notification.update({ isRead: true, readAt: new Date() } as any, { where: { id: req.params.id, recipientId: req.tenantId } });
    res.json({ code: 200, message: '已读' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

export default router;
