import { Op } from 'sequelize';
import Bill from '../models/Bill.js';
import DunningTask from '../models/DunningTask.js';
import Tenant from '../models/Tenant.js';
import Contract from '../models/Contract.js';
import dayjs from 'dayjs';
import { broadcastNotification } from './notification.js';
import { broadcast } from '../websocket/index.js';

const DUNNING_LEVELS = [
  { level: 1, daysBefore: 3, channel: '站内信' as const, title: '租金到期提醒' as const },
  { level: 2, daysAfter: 7, channel: '站内信' as const, title: '租金催缴通知' as const },
  { level: 3, daysAfter: 30, channel: '短信' as const, title: '租金逾期催缴' as const },
  { level: 4, daysAfter: 60, channel: '书面' as const, title: '最后催缴通知' as const },
];

export async function runDunningCheck(): Promise<number> {
  const today = dayjs().startOf('day');
  let dispatched = 0;

  // Level 1: bills due in 3 days
  const upcoming = await Bill.findAll({
    where: {
      status: '未缴',
      dueDate: today.add(DUNNING_LEVELS[0].daysBefore!, 'day').format('YYYY-MM-DD'),
    },
  });
  for (const bill of upcoming) {
    dispatched += await createDunningTask(bill, DUNNING_LEVELS[0]);
  }

  // Levels 2-4: overdue bills
  for (let i = 1; i < DUNNING_LEVELS.length; i++) {
    const cfg = DUNNING_LEVELS[i];
    const overdueBills = await Bill.findAll({
      where: {
        status: { [Op.in]: ['未缴', '部分缴'] },
        dueDate: { [Op.lte]: today.subtract(cfg.daysAfter!, 'day').format('YYYY-MM-DD') },
      },
    });
    for (const bill of overdueBills) {
      // Check if we already sent this level
      const existing = await DunningTask.findOne({
        where: { billId: bill.id, level: cfg.level },
      });
      if (existing) continue;
      dispatched += await createDunningTask(bill, cfg);
      // Mark bill as overdue
      if (bill.status === '未缴') {
        await bill.update({ status: '逾期' });
      }
    }
  }

  if (dispatched > 0) {
    console.log(`[Dunning] Dispatched ${dispatched} dunning tasks`);
  }
  return dispatched;
}

async function createDunningTask(
  bill: any,
  cfg: { level: number; channel: string; title: string }
): Promise<number> {
  const task = await DunningTask.create({
    billId: bill.id,
    level: cfg.level,
    channel: cfg.channel,
    title: cfg.title,
    content: `账单${bill.billNo}，金额${bill.totalAmount}元，请尽快缴纳`,
    status: '已发送',
    sentAt: new Date(),
    response: '',
  } as any);

  // 查询关联的租户信息
  const contract = await Contract.findByPk(bill.contractId, { include: [{ model: Tenant, as: 'tenant' }] });
  const tenant = (contract as any)?.tenant;
  const tenantId = tenant?.id || null;
  const tenantName = tenant?.name || '未知租户';

  // 发送系统广播通知（所有用户可见，点击可跳转租户详情）
  await broadcastNotification(
    cfg.title,
    `账单${bill.billNo}（金额¥${Number(bill.totalAmount || 0).toFixed(2)}）${cfg.title}，请尽快缴纳`,
    'tenant',
    tenantId,
  );

  // WebSocket 广播：新催缴任务
  broadcast('dunning:new', {
    taskId: (task as any).id,
    billId: bill.id,
    level: cfg.level,
    title: cfg.title,
    tenantId,
    tenantName,
    content: `账单${bill.billNo}，金额¥${Number(bill.totalAmount || 0).toFixed(2)}`,
  });

  // WebSocket 广播：新通知（消息中心实时更新）
  broadcast('notification:new', {
    title: cfg.title,
    content: `账单${bill.billNo}（金额¥${Number(bill.totalAmount || 0).toFixed(2)}）${cfg.title}，请尽快缴纳`,
    linkType: 'tenant',
    linkId: tenantId,
    tenantId,
  });

  return 1;
}
