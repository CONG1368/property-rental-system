import { Op } from 'sequelize';
import Bill from '../models/Bill.js';
import DunningTask from '../models/DunningTask.js';
import Tenant from '../models/Tenant.js';
import Contract from '../models/Contract.js';
import dayjs from 'dayjs';
import { broadcastNotification } from './notification.js';
import { broadcast } from '../websocket/index.js';
import { getDunningStrategy, buildDunningLevels, EffectiveDunningLevel } from './dunning-config.js';
import { sendDunningSms, isSmsConfigured } from './sms-service.js';
import { sendMail, isMailerConfigured } from './mailer.js';

/**
 * 催缴引擎（用户 2026-10-11：催缴阶梯/渠道/上限不再写死，按 system_configs.dunning_strategy 执行）。
 * 默认策略与改造前写死的节奏一致（到期前 3 天提醒；逾期 7 天站内信、30 天短信、60 天书面），老库行为不变。
 */
export async function runDunningCheck(): Promise<number> {
  const strategy = await getDunningStrategy();
  if (!strategy.autoDunning) {
    console.log('[Dunning] autoDunning=false，跳过本次催缴');
    return 0;
  }

  const levels = buildDunningLevels(strategy);
  const cap = strategy.maxDailySends > 0 ? strategy.maxDailySends : Number.MAX_SAFE_INTEGER;
  const today = dayjs().startOf('day');
  let dispatched = 0;

  for (const level of levels) {
    if (dispatched >= cap) break;

    const bills = level.daysBefore
      ? await Bill.findAll({ where: { status: '未缴', dueDate: today.add(level.daysBefore, 'day').format('YYYY-MM-DD') } })
      : await Bill.findAll({
          where: {
            status: { [Op.in]: ['未缴', '部分缴'] },
            dueDate: { [Op.lte]: today.subtract(level.daysAfter!, 'day').format('YYYY-MM-DD') },
          },
        });

    for (const bill of bills) {
      if (dispatched >= cap) break;
      // 同一账单同一级别只发一次（原实现的「到期前提醒」没有去重、会每天重复推送，这里一并修正）
      const existing = await DunningTask.findOne({ where: { billId: bill.id, level: level.level } });
      if (existing) continue;

      dispatched += await createDunningTask(bill, level);
      if (!level.daysBefore && bill.status === '未缴') {
        await bill.update({ status: '逾期' });
      }
    }
  }

  if (dispatched > 0) {
    console.log('[Dunning] Dispatched ' + dispatched + ' dunning tasks');
  }
  return dispatched;
}

async function createDunningTask(bill: any, cfg: EffectiveDunningLevel): Promise<number> {
  const channels = cfg.channels && cfg.channels.length > 0 ? cfg.channels : ['站内信'];
  const amount = Number(bill.totalAmount || 0);
  const content = '账单' + bill.billNo + '（金额¥' + amount.toFixed(2) + '）' + cfg.title + '，请尽快缴纳';

  const task = await DunningTask.create({
    billId: bill.id,
    level: cfg.level,
    channel: channels.join('、'),
    title: cfg.title,
    content: '账单' + bill.billNo + '，金额' + bill.totalAmount + '元，请尽快缴纳',
    status: '已发送',
    sentAt: new Date(),
    response: '',
  } as any);

  // 关联租户（用于通知跳转与短信/邮件收件人）
  const contract = await Contract.findByPk(bill.contractId, { include: [{ model: Tenant, as: 'tenant' }] });
  const tenant = (contract as any)?.tenant;
  const tenantId = tenant?.id || null;
  const tenantName = tenant?.name || '未知租户';

  // 渠道真正外发：每个渠道独立 try/catch，通知/催缴失败绝不中断业务（未配置密钥时 Provider 自动降级 Mock/跳过）
  for (const ch of channels) {
    try {
      if (ch === '站内信') {
        await broadcastNotification(cfg.title, content, 'tenant', tenantId);
        broadcast('notification:new', {
          title: cfg.title,
          content,
          linkType: 'tenant',
          linkId: tenantId,
          tenantId,
        });
      } else if (ch === '短信') {
        if (tenant?.phone && isSmsConfigured()) {
          await sendDunningSms(tenant.phone, bill.billNo, amount, bill.dueDate);
        }
      } else if (ch === '邮件') {
        if (tenant?.email && isMailerConfigured()) {
          await sendMail(tenant.email, cfg.title, '<p>' + content + '</p>');
        }
      }
      // 微信（需 openid）与书面（纸质邮寄）暂不外发，仅在催缴任务里记录渠道
    } catch (err: any) {
      console.error('[Dunning] 渠道 ' + ch + ' 发送失败：' + (err?.message || err));
    }
  }

  // WebSocket 广播：新催缴任务（列表实时刷新）
  broadcast('dunning:new', {
    taskId: (task as any).id,
    billId: bill.id,
    level: cfg.level,
    title: cfg.title,
    channels,
    tenantId,
    tenantName,
    content: '账单' + bill.billNo + '，金额¥' + amount.toFixed(2),
  });

  return 1;
}
