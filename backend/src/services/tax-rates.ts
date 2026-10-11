import SystemConfig from '../models/SystemConfig.js';

/**
 * 税务费率参数（用户 2026-10-11 要求：税率不能写死）。
 *
 * 增值税征收率、房产税税率、城镇土地使用税单价、印花税税率、销项税率全部存 `system_configs`，
 * 可在「税务管理」页按当地/本企业口径修改；未配置时用默认值。
 * **默认值就是改造前写死在代码里的数值**，因此老库升级后计算结果零变化。
 */

export interface TaxRates {
  vatRate: number;        // 增值税征收率（小规模纳税人默认 1%）
  propertyRate: number;   // 房产税（从租计征，默认 12%）
  landUnitPrice: number;  // 城镇土地使用税（元/㎡，默认 1.5）
  stampRate: number;      // 印花税（租金收入，默认 0.1%）
  outputRate: number;     // 不动产租赁销项税率（导出报表用，默认 9%）
  inputRate: number;      // 进项税额税率（导出报表用，默认 6%）
}

export const TAX_RATE_DEFAULTS: TaxRates = {
  vatRate: 0.01,
  propertyRate: 0.12,
  landUnitPrice: 1.5,
  stampRate: 0.001,
  outputRate: 0.09,
  inputRate: 0.06,
};

export interface TaxRateMeta {
  key: string;                 // system_configs 键
  field: keyof TaxRates;
  label: string;
  unit: '%' | '元/㎡';
  desc: string;
  min: number;
  max: number;
}

export const TAX_RATE_META: TaxRateMeta[] = [
  { key: 'tax_vat_rate', field: 'vatRate', label: '增值税征收率', unit: '%', desc: '小规模纳税人征收率（默认 1%；一般纳税人请按适用税率/征收率填写）', min: 0, max: 1 },
  { key: 'tax_property_rate', field: 'propertyRate', label: '房产税税率', unit: '%', desc: '从租计征（默认 12%）', min: 0, max: 1 },
  { key: 'tax_land_unit_price', field: 'landUnitPrice', label: '土地使用税单价', unit: '元/㎡', desc: '城镇土地使用税，按在租建筑面积估算（默认 1.5，各地标准不同）', min: 0, max: 10000 },
  { key: 'tax_stamp_rate', field: 'stampRate', label: '印花税税率', unit: '%', desc: '租金收入印花税（默认 0.1%）', min: 0, max: 1 },
  { key: 'tax_output_rate', field: 'outputRate', label: '销项税率', unit: '%', desc: '不动产租赁销项税率，用于税务导出报表（默认 9%）', min: 0, max: 1 },
  { key: 'tax_input_rate', field: 'inputRate', label: '进项税额税率', unit: '%', desc: '费用凭证进项税额换算税率，用于税务导出报表（默认 6%）', min: 0, max: 1 },
];

function toNum(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/** 纯函数：把 system_configs 里读到的原始键值合并成费率（非法值回退默认）—— 便于单测 */
export function parseTaxRates(map: Record<string, unknown>): TaxRates {
  const out: TaxRates = { ...TAX_RATE_DEFAULTS };
  for (const m of TAX_RATE_META) {
    const raw = map[m.key];
    if (raw !== undefined && raw !== null && String(raw) !== '') out[m.field] = toNum(raw, TAX_RATE_DEFAULTS[m.field]);
  }
  return out;
}

/** 读取当前生效费率（读不到就用默认值，绝不抛异常影响报表） */
export async function getTaxRates(): Promise<TaxRates> {
  try {
    const rows = await SystemConfig.findAll({ where: { configKey: TAX_RATE_META.map((m) => m.key) } });
    const map: Record<string, unknown> = {};
    rows.forEach((r: any) => { map[r.configKey] = r.configValue; });
    return parseTaxRates(map);
  } catch {
    return { ...TAX_RATE_DEFAULTS };
  }
}

/** 首次运行补齐 5 个内置配置项（幂等），让「税务管理」页和系统参数中心能看到并修改 */
export async function ensureTaxRateConfigs(): Promise<void> {
  for (const m of TAX_RATE_META) {
    try {
      const row = await SystemConfig.findOne({ where: { configKey: m.key } });
      if (!row) {
        await SystemConfig.create({
          configKey: m.key,
          configValue: String(TAX_RATE_DEFAULTS[m.field]),
          description: m.desc,
          configGroup: '税务',
          valueType: 'number',
          builtIn: 1,
        } as any);
      }
    } catch { /* 建不上不影响计算（getTaxRates 会回退默认值） */ }
  }
}

/** 校验并保存费率（供 PUT /tax/rates 使用）：返回 { ok, errors } */
export function validateTaxRates(input: Record<string, unknown>): { ok: boolean; errors: string[]; values: Partial<TaxRates> } {
  const errors: string[] = [];
  const values: Partial<TaxRates> = {};
  for (const m of TAX_RATE_META) {
    const raw = input[m.field];
    if (raw === undefined || raw === null || String(raw) === '') continue;
    const n = Number(raw);
    if (!Number.isFinite(n)) { errors.push(`${m.label}必须是数字`); continue; }
    if (n < m.min || n > m.max) { errors.push(`${m.label}应在 ${m.min} ~ ${m.max} 之间`); continue; }
    values[m.field] = n;
  }
  return { ok: errors.length === 0, errors, values };
}

/** 纯函数：按给定费率算各税种金额（不碰数据库，便于单测） */
export function computeTaxAmounts(totalRevenue: number, totalArea: number, rates: TaxRates) {
  const r2 = (n: number) => Math.round(n * 100) / 100;
  // 增值税：租金为含税价，先价税分离再乘征收率
  const vatOutput = r2((totalRevenue / (1 + rates.vatRate)) * rates.vatRate);
  return {
    vatOutput,
    vatPayable: vatOutput, // 简化：假设无进项抵扣
    propertyTax: r2(totalRevenue * rates.propertyRate),
    urbanLandTax: r2(totalArea * rates.landUnitPrice),
    stampTax: r2(totalRevenue * rates.stampRate),
  };
}
