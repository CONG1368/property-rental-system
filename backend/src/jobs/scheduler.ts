import cron from 'node-cron';
import { Op } from 'sequelize';
import { generateBills } from '../services/bill-generator.js';
import { runDunningCheck } from '../services/dunning-engine.js';
import { setExpiringContracts } from '../services/contract-workflow.js';
import { runMonthlyDepreciation } from '../services/depreciation.js';
import { broadcastNotification } from '../services/notification.js';
import { runPropertyAutomation } from '../services/property-automation.js';
import { generateMonthlyBriefing } from '../services/briefing-report.js';
import DoorLockPassword from '../models/DoorLockPassword.js';

type ScheduledTask = ReturnType<typeof cron.schedule>;

/** 通知失败不影响主业务流程 */
async function safeBroadcast(title: string, content: string): Promise<void> {
  try { await broadcastNotification(title, content); } catch { /* 忽略 */ }
}

export interface CronTaskDef {
  key: string;
  name: string;
  expr: string;        // cron 表达式
  schedule: string;    // 人类可读描述
  desc: string;
  /** 执行体：返回一句执行摘要，异常由调用方统一捕获 */
  run: () => Promise<string>;
}

export interface CronRunRecord {
  at: string;
  ok: boolean;
  detail: string;
  source: 'cron' | 'manual';
  durationMs: number;
}

// ============================================================
// 任务清单 —— 定时触发与手动触发共用同一份 run()，避免两条路径行为分叉
// ============================================================
const TASKS: CronTaskDef[] = [
  {
    key: 'bill-generation', name: '账单生成', expr: '0 2 * * *', schedule: '每日 02:00',
    desc: '按执行中合同生成下期租金账单（同合同同期间已存在则跳过）',
    run: async () => {
      const count = await generateBills();
      if (count > 0) await safeBroadcast('账单生成完成', '系统已自动生成' + count + '条新账单，请前往收租管理查看并处理。');
      return '生成 ' + count + ' 条账单';
    },
  },
  {
    key: 'dunning', name: '催缴升级', expr: '0 8 * * *', schedule: '每日 08:00',
    desc: '扫描逾期账单并生成/升级催缴任务',
    run: async () => {
      const count = await runDunningCheck();
      if (count > 0) await safeBroadcast('催缴任务已更新', '系统已生成' + count + '条催缴任务，请前往智能催缴查看逾期账单。');
      return '催缴任务 ' + count + ' 条';
    },
  },
  {
    key: 'contract-expiry', name: '合同到期检查', expr: '0 7 * * *', schedule: '每日 07:00',
    desc: '将临近到期的合同标记为「到期提醒」',
    run: async () => {
      const count = await setExpiringContracts();
      if (count > 0) await safeBroadcast('合同到期提醒', count + '份合同即将到期，已标记为"到期提醒"状态，请前往到期管理查看详情。');
      return '标记 ' + count + ' 份到期合同';
    },
  },
  {
    key: 'depreciation', name: '固定资产折旧', expr: '0 2 1 * *', schedule: '每月 1 日 02:00',
    desc: '月度折旧计提（按期间水位线幂等，本期已计提的资产自动跳过）',
    run: async () => {
      const count = await runMonthlyDepreciation();
      if (count > 0) await safeBroadcast('月度折旧完成', '系统已完成' + count + '项固定资产折旧计算，请前往财务看板查看。');
      return '计提 ' + count + ' 项资产';
    },
  },
  {
    key: 'property-automation', name: '物业自动化', expr: '0 9 * * *', schedule: '每日 09:00',
    desc: '工单 SLA 升级 / 设备到期 / 合同到期提醒',
    run: async () => {
      const r = await runPropertyAutomation();
      if (r.createdNotifications > 0) {
        await safeBroadcast('物业自动化提醒', '系统已处理：升级工单' + r.escalatedOrders + '，设备到期' + r.expiringFacilities + '，合同到期' + r.expiringContracts + '。');
      }
      return '升级工单 ' + r.escalatedOrders + '，设备到期 ' + r.expiringFacilities + '，合同到期 ' + r.expiringContracts;
    },
  },
  {
    key: 'monthly-briefing', name: '月度经营简报', expr: '30 9 1 * *', schedule: '每月 1 日 09:30',
    desc: '生成月度经营简报 PDF 并归档',
    run: async () => {
      const r = await generateMonthlyBriefing();
      await safeBroadcast('月度报表包已生成', r.month + ' 月度经营简报 PDF 已生成并归档，可前往[报表中心→经营简报/月度简报]查看下载。');
      return '已生成 ' + r.month + ' 简报';
    },
  },
  {
    key: 'door-lock-cleanup', name: '门锁密码清理', expr: '30 8 * * *', schedule: '每日 08:30',
    desc: '将已过有效期的临时密码置为失效',
    run: async () => {
      const [cnt] = await DoorLockPassword.update(
        { isActive: false },
        { where: { isActive: true, endTime: { [Op.lt]: new Date() } } } as any,
      );
      return '失效 ' + cnt + ' 条过期密码';
    },
  },
];

const lastRuns: Record<string, CronRunRecord> = {};
let jobs: ScheduledTask[] = [];
let started = false;

export const scheduler = {
  /** 任务清单 + 最近一次执行结果（供系统运维页展示） */
  list() {
    return TASKS.map((t) => ({
      key: t.key, name: t.name, schedule: t.schedule, expr: t.expr, desc: t.desc,
      lastRun: lastRuns[t.key] || null,
    }));
  },

  isStarted(): boolean { return started; },

  /** 执行单个任务（定时与手动共用），异常在此统一捕获并记录 */
  async runTask(key: string, source: 'cron' | 'manual' = 'manual'): Promise<CronRunRecord> {
    const task = TASKS.find((t) => t.key === key);
    if (!task) throw new Error('未知的定时任务: ' + key);
    const t0 = Date.now();
    let record: CronRunRecord;
    try {
      const detail = await task.run();
      record = { at: new Date().toISOString(), ok: true, detail, source, durationMs: Date.now() - t0 };
      console.log('[Cron] ' + task.name + ' 完成（' + source + '）: ' + detail);
    } catch (e: any) {
      record = { at: new Date().toISOString(), ok: false, detail: e?.message || String(e), source, durationMs: Date.now() - t0 };
      console.error('[Cron] ' + task.name + ' 失败（' + source + '）: ' + record.detail);
    }
    lastRuns[key] = record;
    return record;
  },

  /** 挂载全部定时任务；重复调用安全（先停后起） */
  start(): number {
    if (started) this.stop();
    jobs = TASKS.map((t) => cron.schedule(t.expr, () => { void scheduler.runTask(t.key, 'cron'); }));
    started = true;
    console.log('[Cron] 调度器已启动，' + jobs.length + ' 个任务：' + TASKS.map((t) => t.name + '(' + t.schedule + ')').join('、'));
    return jobs.length;
  },

  /** 停止全部定时任务 */
  stop(): void {
    jobs.forEach((j) => { try { j.stop(); } catch { /* 忽略 */ } });
    jobs = [];
    started = false;
    console.log('[Cron] 调度器已停止');
  },
};
