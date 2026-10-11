import { describe, it, expect } from 'vitest';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { validateIdNumber, maskIdNumber, checkAge, checkExpiry } from '../src/services/id-card-service.js';
import { canTransition } from '../src/services/voucher-status-machine.js';
import { readSheetAsObjects, buildWorkbookBuffer, writeWorkbookFile } from '../src/utils/excel.js';
import { nextBillPeriod, firstPeriodMonths } from '../src/services/bill-generator.js';
import { buildBillItemsFromContract, buildManualBillItems, summarizeItems, mapItemToColumn, lineAmount } from '../src/services/bill-items.js';
import { splitClausesFromText, diffClauseLists, diffFragments, titleKey } from '../src/services/clause-diff.js';
import { computeTaxAmounts, parseTaxRates, validateTaxRates, TAX_RATE_DEFAULTS } from '../src/services/tax-rates.js';
import { parseDunningStrategy, buildDunningLevels, validateDunningStrategy, DUNNING_DEFAULTS } from '../src/services/dunning-config.js';

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


describe('合同条款比对（用户 2026-10-11 要求：上传租户修订版，自动提示改了哪些条款）', () => {
  it('按「第X条」拆条，标题保留用户原文（含编号），正文归入该条', () => {
    const items = splitClausesFromText('甲方：某某物业公司\n第一条　房屋用途\n仅用于居住，不得改作他用。\n第二条　转租限制\n未经书面同意不得转租。\n不得分租。');
    // 编号之前的抬头文字作为「无标题条款」保留（打印时只出正文段落）
    expect(items[0].title).toBe('');
    expect(items[0].content).toBe('甲方：某某物业公司');
    expect(items[1].title).toBe('第一条　房屋用途');
    expect(items[1].content).toBe('仅用于居住，不得改作他用。');
    expect(items[2].title).toBe('第二条　转租限制');
    expect(items[2].content).toBe('未经书面同意不得转租。\n不得分租。');
  });

  it('整份合同上传时只取「合同条款」章节，签章区与其它章节不算条款', () => {
    const full = [
      '物业租赁合同', '合同编号：HT-001', '一、合同当事人', '出租方（甲方）', '名称：某某物业公司',
      '五、合同条款', '第1条　房屋用途', '仅用于居住。', '第2条　转租限制', '不得转租。',
      '六、消防安全约定', '禁止电动车入户充电。', '日期：＿＿＿＿年＿＿月＿＿日', '甲方：＿',
    ].join('\n');
    const items = splitClausesFromText(full);
    expect(items.map((i) => i.title)).toEqual(['第1条　房屋用途', '第2条　转租限制']);
    expect(items[1].content).toBe('不得转租。');
    expect(items.some((i) => i.content.includes('禁止电动车'))).toBe(false);
  });

  it('没有编号时按自然段拆条，标题留空', () => {
    const items = splitClausesFromText('第一段内容。\n\n第二段内容。');
    expect(items.map((i) => i.title)).toEqual(['', '']);
    expect(items.map((i) => i.content)).toEqual(['第一段内容。', '第二段内容。']);
  });

  it('中文数字与阿拉伯数字编号都能识别', () => {
    expect(splitClausesFromText('一、房屋用途\n居住。').map((i) => i.title)).toEqual(['一、房屋用途']);
    expect(splitClausesFromText('1. 房屋用途\n居住。').map((i) => i.title)).toEqual(['1. 房屋用途']);
  });

  it('标题归一化忽略编号与标点（第一条/一、/1. 视作同一条）', () => {
    expect(titleKey('第一条　房屋用途')).toBe(titleKey('1. 房屋用途'));
    expect(titleKey('一、转租限制')).toBe('转租限制');
  });

  it('新增 / 修改 / 删除 三类变化都能识别，并给出中文提示', () => {
    const oldList = [
      { title: '第一条　房屋用途', content: '仅用于居住。', sortOrder: 0 },
      { title: '第二条　转租限制', content: '不得转租。', sortOrder: 1 },
    ];
    const newList = [
      { title: '第一条　房屋用途', content: '仅用于居住。可自住。', sortOrder: 0 },
      { title: '第三条　消防补充', content: '禁止电动车入户充电。', sortOrder: 1 },
    ];
    const d = diffClauseLists(oldList, newList);
    expect(d.counts).toEqual({ added: 1, removed: 1, modified: 1, unchanged: 0 });
    expect(d.summary).toBe('新增 1 条、修改 1 条、删除 1 条');
    expect(d.details.join(' | ')).toContain('房屋用途');
    expect(d.details.join(' | ')).toContain('消防补充');
    const modified = d.items.find((i) => i.status === 'modified')!;
    expect(modified.fragments.some((f) => f.type === 'add' && f.text.includes('可自住'))).toBe(true);
    expect(d.items.find((i) => i.status === 'removed')!.oldTitle).toContain('转租限制');
  });

  it('标题改了但正文没改：仍按同一条处理（不会误报成新增+删除）', () => {
    const d = diffClauseLists(
      [{ title: '第二条　转租限制', content: '不得转租。', sortOrder: 0 }],
      [{ title: '第二条　转租与分租限制', content: '不得转租。', sortOrder: 0 }],
    );
    expect(d.counts).toEqual({ added: 0, removed: 0, modified: 1, unchanged: 0 });
    expect(d.items[0].titleChanged).toBe(true);
    expect(d.items[0].note).toContain('标题由');
  });

  it('条款完全一致时提示「未检测到条款变化」', () => {
    const list = [{ title: '第一条　房屋用途', content: '仅用于居住。', sortOrder: 0 }];
    const d = diffClauseLists(list, list);
    expect(d.summary).toBe('未检测到条款变化');
    expect(d.counts).toEqual({ added: 0, removed: 0, modified: 0, unchanged: 1 });
  });

  it('句子级差异能定位到具体增删的句子', () => {
    expect(diffFragments('甲。乙。', '甲。丙。')).toEqual([
      { type: 'same', text: '甲。' },
      { type: 'remove', text: '乙。' },
      { type: 'add', text: '丙。' },
    ]);
  });
});

describe('税务费率可配置（用户 2026-10-11 要求：税率不写死）', () => {
  it('默认费率算出的结果与改造前写死的公式完全一致（老库行为零变化）', () => {
    const r = computeTaxAmounts(10100, 100, TAX_RATE_DEFAULTS);
    expect(r.vatOutput).toBe(100);      // 10100 / 1.01 × 0.01
    expect(r.propertyTax).toBe(1212);   // 10100 × 0.12
    expect(r.urbanLandTax).toBe(150);   // 100 ㎡ × 1.5 元/㎡
    expect(r.stampTax).toBe(10.1);      // 10100 × 0.001
  });

  it('改费率后按新费率计算（房产税 12% → 4%）', () => {
    const r = computeTaxAmounts(10000, 0, { ...TAX_RATE_DEFAULTS, propertyRate: 0.04 });
    expect(r.propertyTax).toBe(400);
    expect(r.vatOutput).toBe(99.01);    // 10000 / 1.01 × 0.01 = 99.0099…
  });

  it('parseTaxRates：配置值覆盖默认，空值/非法值回退默认', () => {
    const r = parseTaxRates({ tax_property_rate: '0.04', tax_land_unit_price: '', tax_stamp_rate: 'abc', tax_output_rate: '0.06' });
    expect(r.propertyRate).toBe(0.04);
    expect(r.landUnitPrice).toBe(TAX_RATE_DEFAULTS.landUnitPrice);
    expect(r.stampRate).toBe(TAX_RATE_DEFAULTS.stampRate);
    expect(r.outputRate).toBe(0.06);
  });

  it('validateTaxRates：区间与数字校验并给出中文提示', () => {
    expect(validateTaxRates({ propertyRate: 0.04 }).ok).toBe(true);
    const bad = validateTaxRates({ propertyRate: 12 });   // 误填 12 而不是 0.12
    expect(bad.ok).toBe(false);
    expect(bad.errors[0]).toContain('房产税税率');
    expect(validateTaxRates({ vatRate: -1 }).ok).toBe(false);
    expect(validateTaxRates({ landUnitPrice: 'abc' }).ok).toBe(false);
  });

  it('销项/进项导出税率也可配（默认 9% / 6%）', () => {
    expect(TAX_RATE_DEFAULTS.outputRate).toBe(0.09);
    expect(TAX_RATE_DEFAULTS.inputRate).toBe(0.06);
  });
});

describe('催缴策略可配置（审计第 2 项：原前端策略弹窗只回显、不落库也不生效）', () => {
  it('默认策略与改造前写死的节奏一致（老库行为零变化）', () => {
    expect(DUNNING_DEFAULTS.remindBefore).toBe(3);
    expect(DUNNING_DEFAULTS.levels.map((l) => l.days)).toEqual([7, 30, 60]);
    expect(DUNNING_DEFAULTS.levels.map((l) => l.channels.join('/'))).toEqual(['站内信', '短信', '书面']);
    expect(DUNNING_DEFAULTS.maxDailySends).toBe(0);
  });

  it('parseDunningStrategy：合法值保留，坏 JSON/空阶梯/非法渠道回退默认', () => {
    const p = parseDunningStrategy('{"autoDunning":false,"remindBefore":7,"levels":[{"days":15,"channels":["站内信","短信"]}],"maxDailySends":100}');
    expect(p.autoDunning).toBe(false);
    expect(p.remindBefore).toBe(7);
    expect(p.levels).toEqual([{ days: 15, channels: ['站内信', '短信'] }]);
    expect(p.maxDailySends).toBe(100);
    expect(parseDunningStrategy('坏 JSON').remindBefore).toBe(3);
    expect(parseDunningStrategy({ levels: [] }).levels.map((l) => l.days)).toEqual([7, 30, 60]);
    expect(parseDunningStrategy({ levels: [{ days: 0 }] }).levels.map((l) => l.days)).toEqual([7, 30, 60]);
    expect(parseDunningStrategy({ levels: [{ days: 10, channels: ['不存在的渠道'] }] }).levels[0].channels).toEqual(['站内信']);
  });

  it('buildDunningLevels：第 1 级是到期前提醒，其后按逾期天数升序编号并带标题', () => {
    const levels = buildDunningLevels(DUNNING_DEFAULTS);
    expect(levels.map((l) => l.level)).toEqual([1, 2, 3, 4]);
    expect(levels[0]).toMatchObject({ daysBefore: 3, title: '租金到期提醒' });
    expect(levels[3]).toMatchObject({ daysAfter: 60, channels: ['书面'], title: '最后催缴通知' });

    const noRemind = buildDunningLevels({ ...DUNNING_DEFAULTS, remindBefore: 0 });
    expect(noRemind[0].level).toBe(1);
    expect(noRemind[0].daysAfter).toBe(7);
    expect(noRemind[0].title).toBe('租金催缴通知');

    const many = buildDunningLevels({ ...DUNNING_DEFAULTS, remindBefore: 0, levels: [{ days: 5, channels: ['站内信'] }, { days: 10, channels: ['短信'] }, { days: 20, channels: ['邮件'] }, { days: 40, channels: ['书面'] }, { days: 90, channels: ['站内信'] }] });
    expect(many.map((l) => l.level)).toEqual([1, 2, 3, 4, 5]);
    expect(many[4].title).toContain('逾期 90 天');
  });

  it('validateDunningStrategy：拦截空渠道、超范围天数与上限并给中文提示', () => {
    expect(validateDunningStrategy(DUNNING_DEFAULTS).ok).toBe(true);
    const bad = validateDunningStrategy({ levels: [{ days: 0, channels: [] }], remindBefore: 200, maxDailySends: -5 });
    expect(bad.ok).toBe(false);
    expect(bad.errors.join(' | ')).toContain('逾期天数');
    expect(bad.errors.join(' | ')).toContain('至少选择一个催缴渠道');
    expect(bad.errors.join(' | ')).toContain('到期前提醒天数');
    expect(bad.errors.join(' | ')).toContain('每日最大发送量');
  });
});