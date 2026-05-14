import cron from 'node-cron';
import { generateBills } from '../services/bill-generator.js';
import { runDunningCheck } from '../services/dunning-engine.js';
import { setExpiringContracts } from '../services/contract-workflow.js';
import { runMonthlyDepreciation } from '../services/depreciation.js';
import { broadcastNotification } from '../services/notification.js';

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

    console.log('[Cron] Scheduler initialized (4 tasks + notifications)');
  },
};
