import SystemConfig from '../models/SystemConfig.js';

/**
 * 业务规则配置（全项目「写死业务功能」审计第 3 项：工单 SLA；第 4 项：信用评分模型）。
 * 全部存 system_configs，默认值 ＝ 改造前写死的数值，老库行为零变化。
 */

// ===== 工单 SLA =====
export const WO_SLA_KEY = 'wo_sla_days';
export const WO_SLA_DEFAULT = 2;

/** 纯函数：解析 SLA 天数（非法/越界回退默认） */
export function parseSlaDays(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1 || n > 365) return WO_SLA_DEFAULT;
  return Math.floor(n);
}

export async function getWorkOrderSlaDays(): Promise<number> {
  try {
    const row = await SystemConfig.findOne({ where: { configKey: WO_SLA_KEY } });
    return parseSlaDays((row as any)?.configValue);
  } catch {
    return WO_SLA_DEFAULT;
  }
}

// ===== 信用评分规则 =====
export const CREDIT_RULE_KEY = 'credit_rule';

export interface CreditRule {
  paymentWeight: number;        // 按时缴费满分（默认 40）
  activeContractScore: number;  // 有在执行合同（默认 25）
  inactiveContractScore: number;// 无在执行合同（默认 15）
  cooperationBase: number;      // 配合度基础分（默认 10）
  cooperationPerContract: number; // 每份合同加分（默认 2）
  cooperationMax: number;       // 配合度上限（默认 20）
  latePenaltyWeight: number;    // 逾期扣分满分（默认 15）
  initScore: number;            // 无合同/无账单时的初始分（默认 60）
  initGrade: CreditGrade;       // 初始等级（默认 C；原实现初始分固定配 C，正常路径 60 分才算 B，故单独可配）
  gradeA: number;               // A 级线（默认 80）
  gradeB: number;               // B 级线（默认 60）
  gradeC: number;               // C 级线（默认 40）
}

export const CREDIT_RULE_DEFAULTS: CreditRule = {
  paymentWeight: 40,
  activeContractScore: 25,
  inactiveContractScore: 15,
  cooperationBase: 10,
  cooperationPerContract: 2,
  cooperationMax: 20,
  latePenaltyWeight: 15,
  initScore: 60,
  initGrade: 'C',
  gradeA: 80,
  gradeB: 60,
  gradeC: 40,
};

function num(v: unknown, def: number, min: number, max: number): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max) return def;
  return n;
}

/** 纯函数：解析信用评分规则（逐项非法回退默认） */
export function parseCreditRule(raw: unknown): CreditRule {
  let obj: any = raw;
  if (typeof raw === 'string') {
    try { obj = JSON.parse(raw); } catch { return { ...CREDIT_RULE_DEFAULTS }; }
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return { ...CREDIT_RULE_DEFAULTS };
  return {
    paymentWeight: num(obj.paymentWeight, CREDIT_RULE_DEFAULTS.paymentWeight, 0, 100),
    activeContractScore: num(obj.activeContractScore, CREDIT_RULE_DEFAULTS.activeContractScore, 0, 100),
    inactiveContractScore: num(obj.inactiveContractScore, CREDIT_RULE_DEFAULTS.inactiveContractScore, 0, 100),
    cooperationBase: num(obj.cooperationBase, CREDIT_RULE_DEFAULTS.cooperationBase, 0, 100),
    cooperationPerContract: num(obj.cooperationPerContract, CREDIT_RULE_DEFAULTS.cooperationPerContract, 0, 100),
    cooperationMax: num(obj.cooperationMax, CREDIT_RULE_DEFAULTS.cooperationMax, 0, 100),
    latePenaltyWeight: num(obj.latePenaltyWeight, CREDIT_RULE_DEFAULTS.latePenaltyWeight, 0, 100),
    initScore: num(obj.initScore, CREDIT_RULE_DEFAULTS.initScore, 0, 100),
    initGrade: (['A', 'B', 'C', 'D'] as string[]).includes(String(obj.initGrade)) ? (String(obj.initGrade) as CreditGrade) : CREDIT_RULE_DEFAULTS.initGrade,
    gradeA: num(obj.gradeA, CREDIT_RULE_DEFAULTS.gradeA, 0, 100),
    gradeB: num(obj.gradeB, CREDIT_RULE_DEFAULTS.gradeB, 0, 100),
    gradeC: num(obj.gradeC, CREDIT_RULE_DEFAULTS.gradeC, 0, 100),
  };
}

export interface CreditInput {
  contractsCount: number;
  activeContracts: number;
  totalBills: number;
  paidOnTime: number;
  overdue: number;
}

export type CreditGrade = 'A' | 'B' | 'C' | 'D';

function gradeOf(score: number, rule: CreditRule): CreditGrade {
  if (score >= rule.gradeA) return 'A';
  if (score >= rule.gradeB) return 'B';
  if (score >= rule.gradeC) return 'C';
  return 'D';
}

/** 纯函数：按规则计算信用分与等级（默认规则下与改造前的算法逐项一致） */
export function computeCreditScore(input: CreditInput, rule: CreditRule): { score: number; grade: CreditGrade } {
  if (input.contractsCount === 0 || input.totalBills === 0) {
    // 原实现在这种情况下固定返回 60 分 / C 等级（与正常路径按 80/60/40 判定不同），故初始等级单独可配以保持行为一致
    return { score: rule.initScore, grade: rule.initGrade };
  }
  const paymentScore = Math.round((input.paidOnTime / input.totalBills) * rule.paymentWeight);
  const contractScore = input.activeContracts > 0 ? rule.activeContractScore : rule.inactiveContractScore;
  const cooperationScore = Math.min(rule.cooperationMax, rule.cooperationBase + input.contractsCount * rule.cooperationPerContract);
  const latePenalty = Math.min(rule.latePenaltyWeight, Math.round((input.overdue / input.totalBills) * rule.latePenaltyWeight));
  const score = Math.max(0, Math.min(100, paymentScore + contractScore + cooperationScore - latePenalty));
  return { score, grade: gradeOf(score, rule) };
}

export async function getCreditRule(): Promise<CreditRule> {
  try {
    const row = await SystemConfig.findOne({ where: { configKey: CREDIT_RULE_KEY } });
    return parseCreditRule((row as any)?.configValue);
  } catch {
    return { ...CREDIT_RULE_DEFAULTS };
  }
}

/** 首次运行补齐配置项（幂等） */
export async function ensureBusinessConfigs(): Promise<void> {
  const items = [
    { key: WO_SLA_KEY, value: String(WO_SLA_DEFAULT), desc: '工单 SLA：待派单超过该天数自动升级优先级（默认 2 天）', configGroup: '物业', valueType: 'number' },
    { key: CREDIT_RULE_KEY, value: JSON.stringify(CREDIT_RULE_DEFAULTS), desc: '信用评分规则：各项权重、配合度、逾期扣分、初始分与 A/B/C 等级线', configGroup: '收租', valueType: 'json' },
  ];
  for (const c of items) {
    try {
      const row = await SystemConfig.findOne({ where: { configKey: c.key } });
      if (!row) await SystemConfig.create({ configKey: c.key, configValue: c.value, description: c.desc, configGroup: c.configGroup, valueType: c.valueType, builtIn: 1 } as any);
    } catch { /* 建不上不影响业务（读取处均回退默认值） */ }
  }
}
