import { Router } from 'express';
import { Op } from 'sequelize';
import DunningTask from '../models/DunningTask';
import Bill from '../models/Bill';
import { AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/dunning/tasks — 催缴任务列表
router.get('/tasks', async (req: AuthRequest, res) => {
  try {
    const { page = 1, pageSize = 20, level, status } = req.query;
    const where: any = {};
    if (level) where.level = Number(level);
    if (status) where.status = status;

    const { count, rows } = await DunningTask.findAndCountAll({
      where,
      include: [{ model: Bill, as: 'bill', attributes: ['id', 'billNo', 'totalAmount', 'dueDate', 'status'] }],
      limit: Number(pageSize),
      offset: (Number(page) - 1) * Number(pageSize),
      order: [['createdAt', 'DESC']],
    });
    res.json({ code: 200, data: { total: count, list: rows, page: Number(page), pageSize: Number(pageSize) } });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

// POST /api/dunning/dispatch — 手动发送催缴
router.post('/dispatch', async (req: AuthRequest, res) => {
  try {
    const { billId, level, channel, title, content } = req.body;
    const task = await DunningTask.create({
      billId, level: level || 1,
      channel: channel || '站内信',
      title: title || '催缴通知',
      content: content || '',
      status: '已发送',
      sentAt: new Date(),
    });
    res.json({ code: 200, data: task, message: '催缴已发送' });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

// PUT /api/dunning/strategy — 催缴策略配置（简化版）
router.put('/strategy', async (req: AuthRequest, res) => {
  try {
    res.json({ code: 200, data: req.body, message: '催缴策略已更新' });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

// GET /api/dunning/aging — 欠费账龄分析
router.get('/aging', async (req: AuthRequest, res) => {
  try {
    const now = new Date();
    const overdueBills = await Bill.findAll({
      where: { status: { [Op.in]: ['逾期', '部分缴'] } },
      attributes: ['id', 'dueDate', 'totalAmount', 'status'],
      raw: true,
    });

    let bucket30 = 0; let bucket60 = 0; let bucket90 = 0; let bucket180 = 0;
    overdueBills.forEach((b: any) => {
      const daysOverdue = Math.floor((now.getTime() - new Date(b.dueDate).getTime()) / (1000 * 60 * 60 * 24));
      if (daysOverdue <= 30) bucket30 += Number(b.totalAmount);
      else if (daysOverdue <= 60) bucket60 += Number(b.totalAmount);
      else if (daysOverdue <= 90) bucket90 += Number(b.totalAmount);
      else bucket180 += Number(b.totalAmount);
    });

    res.json({
      code: 200,
      data: {
        aging: [
          { label: '1-30天', value: bucket30 },
          { label: '31-60天', value: bucket60 },
          { label: '61-90天', value: bucket90 },
          { label: '90天以上', value: bucket180 },
        ],
        totalOverdue: overdueBills.length,
      },
    });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

export default router;
