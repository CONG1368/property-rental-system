import Bill from '../models/Bill.js';
import Contract from '../models/Contract.js';
import { Op } from 'sequelize';
import dayjs from 'dayjs';
import { createTTLCache } from './ttl-cache.js';
import { getTaxRates, computeTaxAmounts } from './tax-rates.js';

interface TaxResult {
  vat: { output: number; input: number; payable: number };
  propertyTax: number;
  urbanLandTax: number;
  stampTax: number;
  totalPayable: number;
}

export async function calculateTaxes(period?: string): Promise<TaxResult> {
  const p = period || dayjs().subtract(1, 'month').format('YYYY-MM');

  // 收集当期所有已收租金
  const paidBills = await Bill.findAll({
    where: { period: p, status: '已缴' },
  });
  const totalRevenue = paidBills.reduce((s: number, b: any) => s + Number(b.totalAmount), 0);

  // 税率全部可配置（用户 2026-10-11 要求）：读 system_configs，未配置则用默认值（= 改造前写死的费率）
  const rates = await getTaxRates();

  // 城镇土地使用税（简化：按房源面积估算）
  const contracts = await Contract.findAll({
    where: { status: '执行中' },
    include: [{ model: (await import('../models/Property.js')).default, as: 'property' }],
  });
  const totalArea = contracts.reduce((s: number, c: any) => {
    return s + Number(c.property?.area || 0);
  }, 0);
  const { vatOutput, vatPayable, propertyTax, urbanLandTax, stampTax } = computeTaxAmounts(totalRevenue, totalArea, rates);

  return {
    vat: { output: vatOutput, input: 0, payable: vatPayable },
    propertyTax,
    urbanLandTax,
    stampTax,
    totalPayable: Math.round((vatPayable + propertyTax + urbanLandTax + stampTax) * 100) / 100,
  };
}

// 带 5 分钟 TTL 缓存的计算：避免读接口(如 GET /tax、GET /tax/reports 循环12次)反复触发重计算打库
const taxCache = createTTLCache<TaxResult>(5 * 60 * 1000);
export async function getCachedTaxes(period?: string): Promise<TaxResult> {
  const key = period || 'default';
  const hit = taxCache.get(key);
  if (hit) return hit;
  const result = await calculateTaxes(period);
  taxCache.set(key, result);
  return result;
}

// 数据变更后使缓存失效（如手动触发重算、账单/合同变更）
export function invalidateTaxCache(period?: string): void {
  if (period) taxCache.invalidate(period); else taxCache.clear();
}
