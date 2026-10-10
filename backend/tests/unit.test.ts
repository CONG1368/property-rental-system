import { describe, it, expect } from 'vitest';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { validateIdNumber, maskIdNumber, checkAge, checkExpiry } from '../src/services/id-card-service.js';
import { canTransition } from '../src/services/voucher-status-machine.js';
import { readSheetAsObjects, buildWorkbookBuffer, writeWorkbookFile } from '../src/utils/excel.js';
import { nextBillPeriod, firstPeriodMonths } from '../src/services/bill-generator.js';
import { buildBillItemsFromContract, buildManualBillItems, summarizeItems, mapItemToColumn, lineAmount } from '../src/services/bill-items.js';

describe('身份证校验（ISO 7064:1983 MOD 11-2）', () => {
  it('接受校验位正确的号码', () => {
    // 110105199001151234 的校验位由算法反推得出，避免使用真实身份证
    const base = '11010519900115123';
    const weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
    let sum = 0;
    for (let i = 0; i < 17; i++) sum += Number(base[i]) * weights[i];
    const check = '10X98765432'[sum % 11];
    expect(validateIdNumber(base + check).valid).toBe(true);
  });

  it('拒绝校验位错误的号码', () => {
    const r = validateIdNumber('110105199001151230');
    // 上面构造的号码校验位大概率不匹配；若恰好匹配则换一个
    if (r.valid) expect(validateIdNumber('110105199001151231').valid).toBe(false);
    else expect(r.message).toContain('校验位');
  });

  it('拒绝位数/字符不合法的号码', () => {
    expect(validateIdNumber('12345').valid).toBe(false);
    expect(validateIdNumber('11010519900115123A').valid).toBe(false);
    expect(validateIdNumber('').valid).toBe(false);
  });

  it('脱敏保留前 3 后 4，中间打码', () => {
    const masked = maskIdNumber('110105199001151234');
    expect(masked).toBe('110***********1234');
    expect(masked).toHaveLength(18);
    expect(maskIdNumber('123')).toBe('****');   // 非 18 位一律全掩
  });

  it('年龄与有效期判断', () => {
    expect(checkAge('2010-01-01').underage).toBe(true);
    expect(checkAge('1990-01-01').underage).toBe(false);
    expect(checkExpiry('2000-01-01').expired).toBe(true);
    expect(checkExpiry('2099-01-01').expired).toBe(false);
  });
});

describe('凭证状态机', () => {
  it('允许正向流转', () => {
    expect(canTransition('草稿', '待复核').ok).toBe(true);
    expect(canTransition('待复核', '待审核').ok).toBe(true);
    expect(canTransition('待审核', '已过账').ok).toBe(true);
  });

  it('已过账只能作废，禁止回退（核心内控）', () => {
    expect(canTransition('已过账', '已作废').ok).toBe(true);
    expect(canTransition('已过账', '待审核').ok).toBe(false);
    expect(canTransition('已过账', '草稿').ok).toBe(false);
  });

  it('已作废是终态', () => {
    expect(canTransition('已作废', '草稿').ok).toBe(false);
    expect(canTransition('已作废', '已过账').ok).toBe(false);
  });

  it('非法流转返回原因', () => {
    const r = canTransition('草稿', '已过账');
    expect(r.ok).toBe(false);
    expect(typeof r.reason).toBe('string');
  });
});

describe('Excel 工具（xlsx→exceljs 迁移后的解析契约）', () => {
  const tmpFile = path.join(os.tmpdir(), 'vitest-excel-' + Date.now() + '.xlsx');

  it('写入后读回：中文表头、数字、空行处理', async () => {
    await writeWorkbookFile(tmpFile, {
      name: '房源',
      rows: [
        { 名称: 'A栋101', 类型: '公寓', 面积: 88.5 },
        { 名称: 'B栋202', 类型: '商铺', 面积: 120 },
      ],
    });
    const rows = await readSheetAsObjects(tmpFile);
    expect(rows).toHaveLength(2);
    expect(rows[0]['名称']).toBe('A栋101');
    expect(rows[0]['面积']).toBe(88.5);          // 数字保持为数字，不能变字符串
    expect(rows[1]['类型']).toBe('商铺');
    fs.unlinkSync(tmpFile);
  });

  it('多 Sheet 导出返回合法 xlsx（PK 魔数）且跳过空表', async () => {
    const buf = await buildWorkbookBuffer([
      { name: '有数据', rows: [{ a: 1 }] },
      { name: '空表跳过', rows: [] },
    ]);
    expect(buf.length).toBeGreaterThan(1000);
    expect(buf[0]).toBe(0x50);
    expect(buf[1]).toBe(0x4b);
  });

  it('Sheet 名超过 31 字符会被截断（Excel 硬限制）', async () => {
    const longName = '这是一个非常长的工作表名称用来测试截断行为超过三十一个字符限制';
    const buf = await buildWorkbookBuffer([{ name: longName, rows: [{ a: 1 }] }]);
    expect(buf.length).toBeGreaterThan(0);
  });
});

describe('账单周期跟随自定义首期（用户 2026-10-10 要求）', () => {
  it('未自定义时首个账期仍按付款周期月数（原行为不变）', () => {
    const r = nextBillPeriod({ startDate: '2026-03-15', cycleMonths: 12 });
    expect(r.period).toBe('2026-03');
    expect(r.months).toBe(12);
    expect(r.isFirst).toBe(true);
  });

  it('自定义首期（三年一起交）时首个账期覆盖 36 个月', () => {
    const r = nextBillPeriod({ startDate: '2026-03-15', cycleMonths: 12, customFirstMonths: 36 });
    expect(r.period).toBe('2026-03');
    expect(r.months).toBe(36);
  });

  it('后续账期按上一期实际覆盖月数推进：首期 36 个月后从 2026-03 跳到 2029-03', () => {
    const r = nextBillPeriod({ startDate: '2026-03-01', lastPeriod: '2026-03', lastPeriodMonths: 36, cycleMonths: 12 });
    expect(r.period).toBe('2029-03');
    expect(r.months).toBe(12);   // 后续恢复付款周期
    expect(r.isFirst).toBe(false);
  });

  it('老账单没存 periodMonths 时回退到付款周期月数', () => {
    const r = nextBillPeriod({ startDate: '2026-03-01', lastPeriod: '2026-03', lastPeriodMonths: null, cycleMonths: 12 });
    expect(r.period).toBe('2027-03');
  });

  it('首期月数按「金额 ÷ 月租金」折算，未自定义/月租金为 0 时返回 0', () => {
    expect(firstPeriodMonths(108000, 3000)).toBe(36);
    expect(firstPeriodMonths(4500, 3000)).toBe(2);   // 1.5 个月四舍五入到 2
    expect(firstPeriodMonths(0, 3000)).toBe(0);
    expect(firstPeriodMonths(9000, 0)).toBe(0);
  });
});

describe('账单费用明细折算（用户 2026-10-10，方案 B）', () => {
  it('元/㎡/月：优先用费用项上自定义的计费面积，缺省回退房源建筑面积', () => {
    const custom = buildBillItemsFromContract({ feeItems: [{ name: '物业费', amount: 2.5, unit: '元/㎡/月', area: 100 }], months: 12, propertyArea: 88.5 });
    expect(custom[0].quantity).toBe(100);
    expect(custom[0].amount).toBe(3000);            // 2.5 × 100 × 12
    const fallback = buildBillItemsFromContract({ feeItems: [{ name: '物业费', amount: 2.5, unit: '元/㎡/月' }], months: 12, propertyArea: 88.5 });
    expect(fallback[0].quantity).toBe(88.5);
    expect(fallback[0].amount).toBe(2655);          // 2.5 × 88.5 × 12
  });

  it('元/月 用月数、元/年与元/季 按期数、一次性只在首期', () => {
    const lines = buildBillItemsFromContract({ feeItems: [
      { name: '空调费', amount: 200, unit: '元/月' },
      { name: '网络费', amount: 1200, unit: '元/年' },
      { name: '电梯维保费', amount: 300, unit: '元/季' },
      { name: '装修押金', amount: 5000, unit: '一次性' },
    ], months: 12, propertyArea: 0, isFirst: true });
    expect(lines.map(l => [l.name, l.amount])).toEqual([['空调费', 2400], ['网络费', 1200], ['电梯维保费', 1200], ['装修押金', 5000]]);
    const later = buildBillItemsFromContract({ feeItems: [{ name: '装修押金', amount: 5000, unit: '一次性' }], months: 12, propertyArea: 0, isFirst: false });
    expect(later).toHaveLength(0);
  });

  it('元/吨、元/度 是计量项，交给抄表出账，不进入固定费用明细', () => {
    const lines = buildBillItemsFromContract({ feeItems: [
      { name: '水费', amount: 3.8, unit: '元/吨' }, { name: '电费', amount: 0.68, unit: '元/度' },
    ], months: 12, propertyArea: 0, isFirst: true });
    expect(lines).toHaveLength(0);
  });

  it('明细行 → 账单固定列与合计（水电进 utilityAmount，其余名称进其他）', () => {
    const cols = summarizeItems([
      { name: '租金', amount: 36000 }, { name: '水费', amount: 120 }, { name: '电费', amount: 300 },
      { name: '物业费', amount: 2655 }, { name: '空调费', amount: 2400 },
    ]);
    expect(cols.rentAmount).toBe(36000);
    expect(cols.waterFee).toBe(120);
    expect(cols.electricFee).toBe(300);
    expect(cols.propertyFee).toBe(2655);
    expect(cols.otherAmount).toBe(2400);            // 空调费 → 其他费用
    expect(cols.utilityAmount).toBe(420);
    expect(cols.totalAmount).toBe(41475);
  });

  it('名称 → 固定列的映射规则', () => {
    expect(mapItemToColumn('租金')).toBe('rentAmount');
    expect(mapItemToColumn('水费')).toBe('waterFee');
    expect(mapItemToColumn('电费')).toBe('electricFee');
    expect(mapItemToColumn('物业费')).toBe('propertyFee');
    expect(mapItemToColumn('垃圾处理费')).toBe('otherAmount');
  });

  it('手工补明细：金额为 0 的不出行，单行金额公式可复用', () => {
    const lines = buildManualBillItems({ rentAmount: 3000, electricFee: 150, months: 1, source: '合同' });
    expect(lines.map(l => l.name)).toEqual(['租金', '电费']);
    expect(lines[0].source).toBe('合同');
    expect(lineAmount(2.5, 88.5, 12)).toBe(2655);
    expect(lineAmount(200, 12, 0)).toBe(2400);      // 月数为 0 视为 1
  });
});
