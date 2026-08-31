import cron from 'node-cron';
import { generateBills } from '../services/bill-generator.js';
import { runDunningCheck } from '../services/dunning-engine.js';
import { setExpiringContracts } from '../services/contract-workflow.js';
import { runMonthlyDepreciation } from '../services/depreciation.js';
import { broadcastNotification } from '../services/notification.js';
import { runPropertyAutomation } from '../services/property-automation.js';
import { generateMonthlyBriefing } from '../services/briefing-report.js';
import DoorLockPassword from '../models/DoorLockPassword.js';
import { Op } from 'sequelize';

async function safeBroadcast(title: string, content: string) {
  try { await broadcastNotification(title, content); } catch { /* 通知失败不影响主业务流程 */ }
}

export const scheduler = {
  start() {
    // 账单生成 — 每日凌晨 2:00
    cron.schedule('0 2 * * *', async () => {
      console.log('[Cron] Bill generation started');
      try {
        const count = await generateBills();
        console.log(`[Cron] Bill generation done: ${count} bills`);
        if (count > 0) await safeBroadcast('账单生成完成', `系统已自动生成${count}条新账单，请前往收租管理查看并处理。`);
      } catch (e: any) {
        console.error('[Cron] Bill generation error:', e.message);
      }
    });

    // 催缴升级 — 每日上午 8:00
    cron.schedule('0 8 * * *', async () => {
      console.log('[Cron] Dunning check started');
      try {
        const count = await runDunningCheck();
        console.log(`[Cron] Dunning check done: ${count} tasks`);
        if (count > 0) await safeBroadcast('催缴任务已更新', `系统已生成${count}条催缴任务，请前往智能催缴查看逾期账单。`);
      } catch (e: any) {
        console.error('[Cron] Dunning check error:', e.message);
      }
    });

    // 合同到期检查 — 每日上午 7:00
    cron.schedule('0 7 * * *', async () => {
      console.log('[Cron] Contract expiry check started');
      try {
        const count = await setExpiringContracts();
        console.log(`[Cron] Contract expiry check done: ${count} contracts updated`);
        if (count > 0) await safeBroadcast('合同到期提醒', `${count}份合同即将到期，已标记为"到期提醒"状态，请前往到期管理查看详情。`);
      } catch (e: any) {
        console.error('[Cron] Contract expiry check error:', e.message);
      }
    });

    // 折旧计算 — 每月 1 日凌晨 2:00
    cron.schedule('0 2 1 * *', async () => {
      console.log('[Cron] Monthly depreciation started');
      try {
        const count = await runMonthlyDepreciation();
        console.log(`[Cron] Depreciation done: ${count} assets`);
        if (count > 0) await safeBroadcast('月度折旧完成', `系统已完成${count}项固定资产折旧计算，请前往财务看板查看。`);
      } catch (e: any) {
        console.error('[Cron] Depreciation error:', e.message);
      }
    });

    // 物业自动化 — 每日上午 9:00（工单SLA/设备到期/合同到期提醒）
    cron.schedule('0 9 * * *', async () => {
      console.log('[Cron] Property automation started');
      try {
        const r = await runPropertyAutomation();
        console.log(`[Cron] Property automation done: ${r.createdNotifications} notifications`);
        if (r.createdNotifications > 0) await safeBroadcast('物业自动化提醒', `系统已处理：升级工单${r.escalatedOrders}，设备到期${r.expiringFacilities}，合同到期${r.expiringContracts}。`);
      } catch (e: any) { console.error('[Cron] Property automation error:', e.message); }
    });

    // 月度经营简报 — 每月 1 日上午 9:30 生成本月简报 PDF 存档
    cron.schedule('30 9 1 * *', async () => {
      console.log('[Cron] Monthly briefing generation started');
      try {
        const r = await generateMonthlyBriefing();
        console.log(`[Cron] Monthly briefing done: ${r.filePath}`);
        await safeBroadcast('月度报表包已生成', `${r.month} 月度经营简报 PDF 已生成并归档，可前往[报表中心→经营简报/月度简报]查看下载。`);
      } catch (e: any) { console.error('[Cron] Monthly briefing error:', e.message); }
    });

    // 门锁临时密码到期清理 — 每日上午 8:30
    cron.schedule('30 8 * * *', async () => {
      try {
        const [cnt] = await DoorLockPassword.update({ isActive: false }, { where: { isActive: true, endTime: { [Op.lt]: new Date() } } } as any);
        console.log(`[Cron] Door lock password expiry cleanup: ${cnt} expired`);
      } catch (e: any) { console.error('[Cron] Door lock cleanup error:', e.message); }
    });

    console.log('[Cron] Scheduler initialized (6 tasks + notifications)');
  },
};
