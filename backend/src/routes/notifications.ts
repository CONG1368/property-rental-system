import { Router } from 'express';
import Notification from '../models/Notification.js';
import { AuthRequest } from '../middleware/auth.js';
import { getUnreadCount, markAsRead, sendNotification } from '../services/notification.js';
import { Op } from 'sequelize';

const router = Router();

// GET /notifications — 通知列表（包含个人通知 + 系统广播）
router.get('/', async (req: AuthRequest, res) => {
  try {
    const { page = 1, pageSize = 20 } = req.query;
    const { count, rows } = await Notification.findAndCountAll({
      where: {
        [Op.or]: [
          { recipientId: req.userId, recipientType: 'user' },
          { recipientId: 0, recipientType: 'user' },
        ],
      },
      order: [['createdAt', 'DESC']],
      limit: Number(pageSize),
      offset: (Number(page) - 1) * Number(pageSize),
    });
    res.json({ code: 200, data: { total: count, list: rows, page: Number(page), pageSize: Number(pageSize) } });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// GET /notifications/unread-count — 未读数量（个人+广播）
router.get('/unread-count', async (req: AuthRequest, res) => {
  try {
    const count = await Notification.count({
      where: {
        isRead: false,
        [Op.or]: [
          { recipientId: req.userId || 0, recipientType: 'user' },
          { recipientId: 0, recipientType: 'user' },
        ],
      },
    });
    res.json({ code: 200, data: { count } });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// POST /notifications/send-to-tenant — 向租户发送通知（站内信/短信）
router.post('/send-to-tenant', async (req: AuthRequest, res) => {
  try {
    const { tenantId, channel, title, content, phone } = req.body;
    if (!tenantId || !title) return res.status(400).json({ code: 400, message: '租户与标题必填' });
    await sendNotification({
      recipientId: Number(tenantId), recipientType: 'tenant',
      channel: channel || '站内信', title, content: content || '',
      phone: phone || undefined,
    });
    res.json({ code: 200, message: '通知已发送' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// GET /notifications/tenant/:tenantId — 某租户的通知记录 + 系统广播
router.get('/tenant/:tenantId', async (req: AuthRequest, res) => {
  try {
    const { page = 1, pageSize = 20 } = req.query;
    const { count, rows } = await Notification.findAndCountAll({
      where: { [Op.or]: [{ recipientId: Number(req.params.tenantId), recipientType: 'tenant' }, { recipientId: 0, recipientType: 'tenant' }] },
      order: [['createdAt', 'DESC']], limit: Number(pageSize), offset: (Number(page) - 1) * Number(pageSize),
    });
    res.json({ code: 200, data: { total: count, list: rows, page: Number(page), pageSize: Number(pageSize) } });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// PUT /notifications/:id/read — 标记已读
router.put('/:id/read', async (req: AuthRequest, res) => {
  try {
    await markAsRead(Number(req.params.id));
    res.json({ code: 200, message: '已标记为已读' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// PUT /notifications/read-all — 全部已读（个人+广播）
router.put('/read-all', async (req: AuthRequest, res) => {
  try {
    await Notification.update(
      { isRead: true, readAt: new Date() } as any,
      { where: { isRead: false, [Op.or]: [{ recipientId: req.userId, recipientType: 'user' }, { recipientId: 0, recipientType: 'user' }] } }
    );
    res.json({ code: 200, message: '全部已标记为已读' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

export default router;
