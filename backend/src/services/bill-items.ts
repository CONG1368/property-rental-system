/**
 * 账单明细折算规则（纯函数，便于单测）——用户 2026-10-10 要求（方案 B）。
 * 合同费用项 → 账单明细行；明细行 → 账单固定费用列（保持报表/凭证等老逻辑可用）。
 */

export interface ContractFeeItem { name: string; amount: number; unit: string; area?: number }
export interface BillItemLine {
  name: string; unit: string; unitPrice: number; quantity: number;
  months: number; amount: number; source: string; remark: string; sortOrder: number;
}

/** 计量单位：按用量计费，由抄表单独出账，不参与固定费用自动出账 */
const METERED_UNITS = ['元/吨', '元/度'];

const round2 = (n: number) => Number((Number(n) || 0).toFixed(2));

/** 单行金额 = 单价 × 数量 × (月数 || 1) */
export function lineAmount(unitPrice: number, quantity: number, months: number): number {
  const m = Number(months || 0) > 0 ? Number(months) : 1;
  return round2(Number(unitPrice || 0) * Number(quantity || 0) * m);
}

/** 把合同费用项折算成账单明细行 */
export function buildBillItemsFromContract(params: {
  feeItems?: ContractFeeItem[] | null;
  months: number;
  propertyArea?: number;
  isFirst?: boolean;
}): BillItemLine[] {
  const { feeItems, months, propertyArea = 0, isFirst = true } = params;
  const lines: BillItemLine[] = [];
  let sort = 1;
  for (const raw of feeItems || []) {
    const name = String(raw?.name || '').trim();
    const price = Number(raw?.amount || 0);
    const unit = String(raw?.unit || '元/月');
    if (!name || price <= 0) continue;
    if (METERED_UNITS.includes(unit)) continue;   // 水/电按用量，交抄表出账
    let quantity = 1; let useMonths = 0; let remark = '';
    if (unit === '元/㎡/月') {
      // 面积优先取费用项上自定义的计费面积，其次房源建筑面积（用户要求：不能完全写死）
      const area = Number(raw?.area || 0) > 0 ? Number(raw.area) : Number(propertyArea || 0);
      if (area <= 0) continue;
      quantity = area; useMonths = months;
      remark = `${area} ㎡ × ${months} 个月`;
    } else if (unit === '元/月') {
      quantity = months; remark = `${months} 个月`;
    } else if (unit === '元/季') {
      quantity = Number((months / 3).toFixed(2)); remark = `${quantity} 个季度`;
    } else if (unit === '元/年') {
      quantity = Number((months / 12).toFixed(2)); remark = `${quantity} 年`;
    } else if (unit === '一次性') {
      if (!isFirst) continue;   // 一次性费用只在首期收取
      remark = '一次性';
    } else {
      remark = unit === '元/次' ? '1 次' : '按次计收';
    }
    const amount = lineAmount(price, quantity, useMonths);
    if (amount <= 0) continue;
    lines.push({ name, unit, unitPrice: price, quantity, months: useMonths, amount, source: '合同', remark, sortOrder: sort++ });
  }
  return lines;
}

/**
 * 按账单的固定金额字段拼出明细行：老合同（没有 feeItems）自动出账、以及手工开账单都用它，
 * 这样每张账单都有明细可看，不再只有四个裸列。
 */
export function buildManualBillItems(params: {
  rentAmount?: number; waterFee?: number; electricFee?: number; propertyFee?: number; otherAmount?: number;
  months?: number; source?: string;
}): BillItemLine[] {
  const { rentAmount = 0, waterFee = 0, electricFee = 0, propertyFee = 0, otherAmount = 0, months = 1, source = '手工' } = params;
  const lines: BillItemLine[] = [];
  const push = (name: string, amount: number) => {
    if (Number(amount) <= 0) return;
    lines.push({
      name, unit: '元/月',
      unitPrice: months > 0 ? round2(Number(amount) / months) : round2(Number(amount)),
      quantity: months, months: 0, amount: round2(amount), source,
      remark: months > 1 ? `${months} 个月` : '', sortOrder: lines.length + 1,
    });
  };
  push('租金', Number(rentAmount));
  push('水费', Number(waterFee));
  push('电费', Number(electricFee));
  push('物业费', Number(propertyFee));
  push('其他费用', Number(otherAmount));
  return lines;
}

/** 明细行 → 账单固定费用列（保证报表/凭证/列表等既有逻辑继续可用） */
export function mapItemToColumn(name: string): 'rentAmount' | 'waterFee' | 'electricFee' | 'propertyFee' | 'otherAmount' {
  const n = String(name || '');
  if (n.includes('租')) return 'rentAmount';
  if (n.includes('水')) return 'waterFee';
  if (n.includes('电')) return 'electricFee';
  if (n.includes('物业')) return 'propertyFee';
  return 'otherAmount';
}

/** 按明细行汇总账单各固定列与合计 */
export function summarizeItems(items: { name: string; amount: number }[] | null | undefined, lateFee = 0) {
  const cols = { rentAmount: 0, waterFee: 0, electricFee: 0, propertyFee: 0, otherAmount: 0 };
  for (const it of items || []) {
    const key = mapItemToColumn(it.name);
    (cols as any)[key] = (cols as any)[key] + (Number(it.amount) || 0);
  }
  Object.keys(cols).forEach((k) => { (cols as any)[k] = round2((cols as any)[k]); });
  const utilityAmount = round2(cols.waterFee + cols.electricFee);
  const totalAmount = round2(cols.rentAmount + utilityAmount + cols.propertyFee + cols.otherAmount + (Number(lateFee) || 0));
  return { ...cols, utilityAmount, totalAmount };
}
