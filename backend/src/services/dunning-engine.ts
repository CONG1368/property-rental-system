import { Op } from 'sequelize';
import Bill from '../models/Bill.js';
import DunningTask from '../models/DunningTask.js';
import dayjs from 'dayjs';

const DUNNING_LEVELS = [
  { level: 1, daysBefore: 3, channel: '站内信' as const, title: '租金到期提醒' },
  { level: 2, daysAfter: 7, channel: '站内信' as const, title: '租金催缴通知' },
  { level: 3, daysAfter: 30, channel: '短信' as const, title: '租金逾期催缴' },
  { level: 4, daysAfter: 60, channel: '书面' as const, title: '最后催缴通知' },
];

export async function runDunningCheck(): Promise<number> {
  const today = dayjs().startOf('day');
  let dispatched = 0;

  // Level 1: bills due in 3 days
  const upcoming = await Bill.findAll({
    where: {
      status: '未缴',
      dueDate: today.add(DUNNING_LEVELS[0].daysBefore, 'day').format('YYYY-MM-DD'),
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
        dueDate: { [Op.lte]: today.subtract(cfg.daysAfter, 'day').format('YYYY-MM-DD') },
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
  await DunningTask.create({
    billId: bill.id,
    level: cfg.level,
    channel: cfg.channel,
    title: cfg.title,
    content: `账单${bill.billNo}，金额${bill.totalAmount}元，请尽快缴纳`,
    status: '待发送',
  });
  return 1;
}
