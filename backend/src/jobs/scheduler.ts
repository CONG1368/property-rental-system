import cron from 'node-cron';
import { generateBills } from '../services/bill-generator.js';
import { runDunningCheck } from '../services/dunning-engine.js';
import { setExpiringContracts } from '../services/contract-workflow.js';
import { runMonthlyDepreciation } from '../services/depreciation.js';

export const scheduler = {
  start() {
    // 账单生成 — 每日凌晨 2:00
    cron.schedule('0 2 * * *', async () => {
      console.log('[Cron] Bill generation started');
      try {
        const count = await generateBills();
        console.log(`[Cron] Bill generation done: ${count} bills`);
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
      } catch (e: any) {
        console.error('[Cron] Depreciation error:', e.message);
      }
    });

    console.log('[Cron] Scheduler initialized (4 tasks)');
  },
};
