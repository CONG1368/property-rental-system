import SystemConfig from '../models/SystemConfig.js';

/**
 * 催缴策略可配置（全项目「写死业务功能」审计第 2 项，用户 2026-10-11 要求继续清理）。
 *
 * 背景：原先催缴节奏写死在 dunning-engine.ts（到期前 3 天、逾期 7/30/60 天，渠道 站内信/短信/书面）；
 * 更严重的是前端「催缴策略配置」弹窗调用的 PUT /dunning/strategy 只是个空壳（原样回显 body、既不落库也不生效）。
 * 现改为：策略存 system_configs.dunning_strategy，引擎按策略执行，渠道真正外发（站内信/短信/邮件）。
 * **默认值 = 改造前写死的节奏**，老库行为零变化。
 */

export interface DunningLevelConfig { days: number; channels: string[] }

export interface DunningStrategy {
  autoDunning: boolean;        // 关掉则不自动催缴（定时任务直接跳过）
  remindBefore: number;        // 到期前 N 天提醒（0 = 不提醒）
  levels: DunningLevelConfig[]; // 逾期催缴阶梯（按天数升序执行）
  maxDailySends: number;       // 每日最大发送条数（0 = 不限制）
}

export const DUNNING_CHANNELS = ['站内信', '短信', '邮件', '微信', '书面'];
export const DUNNING_STRATEGY_KEY = 'dunning_strategy';
export const DUNNING_TITLES = ['租金到期提醒', '租金催缴通知', '租金逾期催缴', '最后催缴通知'];

export const DUNNING_DEFAULTS: DunningStrategy = {
  autoDunning: true,
  remindBefore: 3,
  levels: [
    { days: 7, channels: ['站内信'] },
    { days: 30, channels: ['短信'] },
    { days: 60, channels: ['书面'] },
  ],
  maxDailySends: 0,
};

export interface EffectiveDunningLevel {
  level: number;
  daysBefore?: number;
  daysAfter?: number;
  channels: string[];
  title: string;
}

function toNonNegInt(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
}

function cloneDefaults(): DunningStrategy {
  return { ...DUNNING_DEFAULTS, levels: DUNNING_DEFAULTS.levels.map((l) => ({ ...l, channels: [...l.channels] })) };
}

/** 纯函数：解析并规整策略（缺失/非法字段回退默认；结构不可用时整体回退） */
export function parseDunningStrategy(raw: unknown): DunningStrategy {
  let obj: any = raw;
  if (typeof raw === 'string') {
    try { obj = JSON.parse(raw); } catch { return cloneDefaults(); }
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return cloneDefaults();

  const levels: DunningLevelConfig[] = [];
  if (Array.isArray(obj.levels)) {
    for (const l of obj.levels) {
      const days = toNonNegInt(l?.days, -1);
      if (days < 1) continue;
      const rawChans = Array.isArray(l?.channels) ? l.channels : [];
      const chans = rawChans.map((c: any) => String(c)).filter((c: string) => DUNNING_CHANNELS.includes(c));
      levels.push({ days, channels: chans.length > 0 ? chans : ['站内信'] });
    }
  }
  return {
    autoDunning: obj.autoDunning === undefined ? DUNNING_DEFAULTS.autoDunning : !!obj.autoDunning,
    remindBefore: toNonNegInt(obj.remindBefore, DUNNING_DEFAULTS.remindBefore),
    levels: levels.length > 0 ? levels : cloneDefaults().levels,
    maxDailySends: toNonNegInt(obj.maxDailySends, DUNNING_DEFAULTS.maxDailySends),
  };
}

/** 纯函数：策略 → 引擎可执行的阶梯（第 1 级为到期前提醒，其后按逾期天数升序编号） */
export function buildDunningLevels(s: DunningStrategy): EffectiveDunningLevel[] {
  const out: EffectiveDunningLevel[] = [];
  if (s.remindBefore > 0) {
    out.push({ level: 1, daysBefore: s.remindBefore, channels: ['站内信'], title: DUNNING_TITLES[0] });
  }
  // 逾期级标题固定从「租金催缴通知」开始（DUNNING_TITLES[1]）：没有到期前提醒时，第一级逾期也不该叫「到期提醒」
  const sorted = [...s.levels].sort((a, b) => a.days - b.days);
  sorted.forEach((l, i) => {
    out.push({
      level: out.length + 1,
      daysAfter: l.days,
      channels: l.channels,
      title: DUNNING_TITLES[i + 1] || ('逾期 ' + l.days + ' 天催缴通知'),
    });
  });
  return out;
}

/** 纯函数：校验外部传入的策略（供 PUT 使用） */
export function validateDunningStrategy(input: any): { ok: boolean; errors: string[]; strategy: DunningStrategy } {
  const errors: string[] = [];
  if (input?.levels !== undefined) {
    if (!Array.isArray(input.levels)) errors.push('催缴阶梯必须是数组');
    else {
      input.levels.forEach((l: any, i: number) => {
        const days = Number(l?.days);
        if (!Number.isFinite(days) || days < 1 || days > 365) errors.push('第 ' + (i + 1) + ' 级逾期天数应在 1 ~ 365 之间');
        const chans = Array.isArray(l?.channels) ? l.channels : [];
        if (chans.length === 0) errors.push('第 ' + (i + 1) + ' 级至少选择一个催缴渠道');
        chans.forEach((c: any) => { if (!DUNNING_CHANNELS.includes(String(c))) errors.push('不支持的催缴渠道：' + c); });
      });
    }
  }
  const remind = Number(input?.remindBefore);
  if (input?.remindBefore !== undefined && (!Number.isFinite(remind) || remind < 0 || remind > 90)) errors.push('到期前提醒天数应在 0 ~ 90 之间');
  const cap = Number(input?.maxDailySends);
  if (input?.maxDailySends !== undefined && (!Number.isFinite(cap) || cap < 0 || cap > 100000)) errors.push('每日最大发送量应在 0 ~ 100000 之间（0 = 不限制）');
  return { ok: errors.length === 0, errors, strategy: parseDunningStrategy(input) };
}

/** 当前生效策略（读不到就用默认值，绝不抛异常中断催缴） */
export async function getDunningStrategy(): Promise<DunningStrategy> {
  try {
    const row = await SystemConfig.findOne({ where: { configKey: DUNNING_STRATEGY_KEY } });
    return parseDunningStrategy((row as any)?.configValue);
  } catch {
    return cloneDefaults();
  }
}

/** 首次运行补齐配置项（幂等），让「催缴策略」在界面与系统参数中心可见可改 */
export async function ensureDunningConfig(): Promise<void> {
  try {
    const row = await SystemConfig.findOne({ where: { configKey: DUNNING_STRATEGY_KEY } });
    if (!row) {
      await SystemConfig.create({
        configKey: DUNNING_STRATEGY_KEY,
        configValue: JSON.stringify(DUNNING_DEFAULTS),
        description: '催缴策略：到期前提醒天数、逾期催缴阶梯（天数+渠道）、每日发送上限',
        configGroup: '催缴',
        valueType: 'json',
        builtIn: 1,
      } as any);
    }
  } catch { /* 建不上不影响引擎（getDunningStrategy 回退默认值） */ }
}
