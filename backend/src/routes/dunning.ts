import { Router } from 'express';
import { Op } from 'sequelize';
import DunningTask from '../models/DunningTask.js';
import Bill from '../models/Bill.js';
import Contract from '../models/Contract.js';
import Tenant from '../models/Tenant.js';
import Property from '../models/Property.js';
import { AuthRequest } from '../middleware/auth.js';
import { broadcastNotification } from '../services/notification.js';
import { broadcast } from '../websocket/index.js';
import { auditLog } from '../middleware/audit-log.js';
import { requireConfirmPassword } from '../middleware/confirm-password.js';
import SystemConfig from '../models/SystemConfig.js';
import {
  getDunningStrategy, ensureDunningConfig, validateDunningStrategy,
  DUNNING_DEFAULTS, DUNNING_CHANNELS, DUNNING_STRATEGY_KEY,
} from '../services/dunning-config.js';

const router = Router();

// 催缴任务列表的公共 include（Bill → Contract → Tenant + Property）
const taskInclude = [
  { model: Bill, as: 'bill', attributes: ['id', 'billNo', 'period', 'rentAmount', 'waterFee', 'electricFee', 'propertyFee', 'otherAmount', 'totalAmount', 'dueDate', 'status'],
    include: [
      { model: Contract, as: 'contract', attributes: ['id', 'contractNo'],
        include: [
          { model: Tenant, as: 'tenant', attributes: ['id', 'name', 'phone'] },
          { model: Property, as: 'property', attributes: ['id', 'name'] },
        ] },
    ] },
];

// GET /api/dunning — 催缴任务列表（简化路由）
router.get('/', async (req: AuthRequest, res) => {
  try {
    const { page = 1, pageSize = 20, level, status } = req.query;
    const where: any = {};
    if (level) where.level = Number(level);
    if (status) where.status = status;
    const { count, rows } = await DunningTask.findAndCountAll({
      where,
      include: taskInclude,
      limit: Number(pageSize),
      offset: (Number(page) - 1) * Number(pageSize),
      order: [['createdAt', 'DESC']],
    });
    res.json({ code: 200, data: { total: count, list: rows, page: Number(page), pageSize: Number(pageSize) } });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// GET /api/dunning/tasks — 催缴任务列表
router.get('/tasks', async (req: AuthRequest, res) => {
  try {
    const { page = 1, pageSize = 20, level, status } = req.query;
    const where: any = {};
    if (level) where.level = Number(level);
    if (status) where.status = status;

    const { count, rows } = await DunningTask.findAndCountAll({
      where,
      include: taskInclude,
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
    if (!billId || !Number(billId)) {
      return res.status(400).json({ code: 400, message: '账单ID不能为空' });
    }
    const task = await DunningTask.create({
      billId, level: level || 1,
      channel: channel || '站内信',
      title: title || '催缴通知',
      content: content || '',
      status: '已发送',
      sentAt: new Date(),
      response: '',
    } as any);

    // 查询关联的租户信息并发送通知
    const bill = await Bill.findByPk(billId);
    const contract = bill ? await Contract.findByPk((bill as any).contractId, { include: [{ model: Tenant, as: 'tenant' }] }) : null;
    const tenant = (contract as any)?.tenant;
    const tenantId = tenant?.id || null;
    const tenantName = tenant?.name || '未知租户';

    // 发送系统广播通知（所有用户可见，点击可跳转租户详情）
    await broadcastNotification(
      title || '催缴通知',
      content || '',
      'tenant',
      tenantId || null,
    );

    // WebSocket 广播
    broadcast('dunning:new', {
      taskId: (task as any).id,
      billId,
      level: level || 1,
      title: title || '催缴通知',
      tenantId,
      tenantName,
      content: content || '',
    });

    broadcast('notification:new', {
      title: title || '催缴通知',
      content: content || '',
      linkType: 'tenant',
      linkId: tenantId,
      tenantId,
    });

    res.json({ code: 200, data: task, message: '催缴已发送' });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

// ===== 催缴策略（用户 2026-10-11：原实现是空壳——只回显 body、不落库也不生效，现改为真实配置）=====

// GET /api/dunning/strategy — 读取当前策略（含默认值与可选渠道，供界面渲染）
router.get('/strategy', async (_req: AuthRequest, res) => {
  try {
    await ensureDunningConfig();
    const strategy = await getDunningStrategy();
    res.json({ code: 200, data: { strategy, defaults: DUNNING_DEFAULTS, channels: DUNNING_CHANNELS } });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message || '读取催缴策略失败' });
  }
});

// PUT /api/dunning/strategy — 保存策略（校验 + 落库 system_configs + 审计 + 管理员密码二次确认）
router.put('/strategy', auditLog('催缴', '修改催缴策略'), requireConfirmPassword('修改催缴策略'), async (req: AuthRequest, res) => {
  try {
    const { ok, errors, strategy } = validateDunningStrategy(req.body || {});
    if (!ok) return res.status(400).json({ code: 400, message: errors.join('；') });

    const [row] = await SystemConfig.findOrCreate({
      where: { configKey: DUNNING_STRATEGY_KEY },
      defaults: { configValue: JSON.stringify(strategy), description: '催缴策略：到期前提醒天数、逾期催缴阶梯（天数+渠道）、每日发送上限', configGroup: '催缴', valueType: 'json', builtIn: 1 } as any,
    });
    (row as any).configValue = JSON.stringify(strategy);
    await row.save();

    res.json({ code: 200, data: { strategy }, message: '催缴策略已保存，下一次催缴任务按新策略执行' });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message || '保存催缴策略失败' });
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
