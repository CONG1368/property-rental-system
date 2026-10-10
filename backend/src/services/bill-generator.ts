import { Op } from 'sequelize';
import Contract from '../models/Contract.js';
import Bill from '../models/Bill.js';
import BillItem from '../models/BillItem.js';
import Property from '../models/Property.js';
import dayjs from 'dayjs';
import { buildBillItemsFromContract, buildManualBillItems, summarizeItems } from './bill-items.js';
import type { BillItemLine } from './bill-items.js';

const CYCLE_MONTHS: Record<string, number> = {
  '月': 1, '季': 3, '半年': 6, '年': 12,
  '两年': 24, '三年': 36, '五年': 60,
};

/**
 * 首期实际覆盖的月数（用户 2026-10-10 要求）：
 * 合同在起草页自定义了「首期应交租金」时按「金额 ÷ 月租金」折算，否则返回 0 表示未自定义。
 * 账单列是 INTEGER，这里四舍五入并至少 1 个月。
 */
export function firstPeriodMonths(firstPeriodRent: unknown, rentAmount: unknown): number {
  const custom = Number(firstPeriodRent || 0);
  const rent = Number(rentAmount || 0);
  if (custom <= 0 || rent <= 0) return 0;
  return Math.max(1, Math.round(custom / rent));
}

/**
 * 计算下一个账期与它覆盖的月数（纯函数，便于单测）。
 * - 尚无账单：首个账期取合同起始月；合同自定义了首期月数就按它，否则按付款周期月数。
 * - 已有账单：从**上一期实际覆盖的月数**往后推（这样"首期一次收三年"之后不会错位），
 *   老账单没存 periodMonths 时回退到付款周期月数。
 */
export function nextBillPeriod(params: {
  startDate: string | Date;
  lastPeriod?: string | null;
  lastPeriodMonths?: number | null;
  cycleMonths: number;
  customFirstMonths?: number;
}): { period: string; months: number; isFirst: boolean } {
  const { startDate, lastPeriod, lastPeriodMonths, cycleMonths, customFirstMonths = 0 } = params;
  if (!lastPeriod) {
    return {
      period: dayjs(startDate).format('YYYY-MM'),
      months: customFirstMonths > 0 ? customFirstMonths : cycleMonths,
      isFirst: true,
    };
  }
  const advance = Number(lastPeriodMonths || 0) > 0 ? Number(lastPeriodMonths) : cycleMonths;
  return {
    period: dayjs(lastPeriod + '-01').add(advance, 'month').format('YYYY-MM'),
    months: cycleMonths,
    isFirst: false,
  };
}

export async function generateBills(options: { contractId?: number } = {}): Promise<number> {
  const where: any = { status: '执行中' };
  // 传 contractId 时只补这一份合同的账单（便于单合同重算/自检）
  if (options.contractId) where.id = options.contractId;

  const activeContracts = await Contract.findAll({
    where,
    // 取房源建筑面积，供「元/㎡/月」的费用项折算（费用项上另有自定义面积时以它为准）
    include: [{ model: Property, as: 'property', attributes: ['id', 'area'] }],
  });

  const thisMonth = dayjs().format('YYYY-MM');
  let generated = 0;

  for (const contract of activeContracts) {
    const lastBill = await Bill.findOne({
      where: { contractId: contract.id },
      order: [['period', 'DESC']],
    });

    const cycle = (contract as any).paymentCycle as string;
    const cycleMonths = CYCLE_MONTHS[cycle] || 1;

    // 首期自定义（几年一起交）：金额与月数都按合同上的口径走
    const customFirst = Number((contract as any).firstPeriodRent || 0);
    const customFirstMonths = firstPeriodMonths(customFirst, (contract as any).rentAmount);

    // 计算下一期账期与它实际覆盖的月数
    const plan = nextBillPeriod({
      startDate: (contract as any).startDate,
      lastPeriod: lastBill ? (lastBill as any).period : null,
      lastPeriodMonths: lastBill ? (lastBill as any).periodMonths : null,
      cycleMonths,
      customFirstMonths,
    });
    const nextPeriod = plan.period;
    const months = plan.months;

    // 只生成本月及之前的账期（不提前生成未来账单）
    if (nextPeriod > thisMonth) continue;

    const existing = await Bill.findOne({
      where: { contractId: contract.id, period: nextPeriod },
    });
    if (existing) continue;

    const bc = (contract as any).billingConfig || {};
    const useCustomFirst = plan.isFirst && customFirst > 0 && customFirstMonths > 0;
    // 首期自定义时直接取合同上的一次性金额（不再用「月租金 × 周期」重算）
    const rentAmount = useCustomFirst ? customFirst : Number(contract.rentAmount) * months;

    // ===== 费用明细（方案 B）：优先用新版费用项，老合同回退到扁平字段 =====
    const feeItems = Array.isArray(bc.feeItems) ? bc.feeItems : [];
    const propertyArea = Number((contract as any).property?.area || 0);
    let feeLines: BillItemLine[] = [];
    if (feeItems.length > 0) {
      feeLines = buildBillItemsFromContract({ feeItems, months, propertyArea, isFirst: plan.isFirst });
    } else if (Number(bc.waterFee || 0) + Number(bc.electricFee || 0) + Number(bc.propertyFee || 0) > 0) {
      feeLines = buildManualBillItems({ waterFee: bc.waterFee, electricFee: bc.electricFee, propertyFee: bc.propertyFee, months, source: '合同' });
    }

    // 租金也单独成行，账单明细才是完整的一张账
    const lines: BillItemLine[] = [];
    if (rentAmount > 0) {
      lines.push({
        name: '租金',
        unit: '元/月',
        unitPrice: useCustomFirst && customFirstMonths > 0
          ? Number((rentAmount / customFirstMonths).toFixed(2))
          : Number((contract as any).rentAmount || 0),
        quantity: months,
        months: 0,
        amount: Number(rentAmount.toFixed(2)),
        source: '合同',
        remark: useCustomFirst ? `${months} 个月（首期自定义）` : `${months} 个月`,
        sortOrder: 0,
      });
    }
    lines.push(...feeLines.map((l, i) => ({ ...l, sortOrder: i + 1 })));

    // 按明细汇总出账单的固定费用列（日报/凭证/列表等老逻辑继续可用）
    const cols = summarizeItems(lines);

    // 到期日为账期月份第5天
    const dueDate = dayjs(nextPeriod + '-01').date(5).format('YYYY-MM-DD');
    const billNo = `BL-${contract.contractNo}-${nextPeriod}`;

    const bill = await Bill.create({
      contractId: contract.id,
      billNo,
      period: nextPeriod,
      periodMonths: months,
      rentAmount: cols.rentAmount,
      waterFee: cols.waterFee,
      electricFee: cols.electricFee,
      utilityAmount: cols.utilityAmount,
      propertyFee: cols.propertyFee,
      otherAmount: cols.otherAmount,
      lateFee: 0,
      totalAmount: cols.totalAmount,
      dueDate: new Date(dueDate),
      status: '未缴',
    } as any);

    if (lines.length > 0) {
      await BillItem.bulkCreate(lines.map((l) => ({ ...l, billId: (bill as any).id })) as any);
    }
    generated++;
  }

  if (generated > 0) console.log(`[BillGen] Generated ${generated} bills`);
  return generated;
}
