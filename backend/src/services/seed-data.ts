import AccountBook from '../models/AccountBook.js';
import ChartOfAccount from '../models/ChartOfAccount.js';

const STANDARD_ACCOUNTS = [
  // 资产类
  { code: '1001', name: '库存现金', type: '资产', direction: '借', parentCode: null },
  { code: '1002', name: '银行存款', type: '资产', direction: '借', parentCode: null },
  { code: '1122', name: '应收账款', type: '资产', direction: '借', parentCode: null },
  { code: '1221', name: '其他应收款', type: '资产', direction: '借', parentCode: null },
  { code: '1601', name: '固定资产', type: '资产', direction: '借', parentCode: null },
  { code: '1602', name: '累计折旧', type: '资产', direction: '贷', parentCode: null },
  { code: '1701', name: '无形资产', type: '资产', direction: '借', parentCode: null },
  // 负债类
  { code: '2202', name: '应付账款', type: '负债', direction: '贷', parentCode: null },
  { code: '2241', name: '其他应付款', type: '负债', direction: '贷', parentCode: null },
  { code: '2242', name: '预收租金', type: '负债', direction: '贷', parentCode: null },
  { code: '2221', name: '应交税费', type: '负债', direction: '贷', parentCode: null },
  // 所有者权益类
  { code: '4001', name: '实收资本', type: '所有者权益', direction: '贷', parentCode: null },
  { code: '4104', name: '利润分配', type: '所有者权益', direction: '贷', parentCode: null },
  { code: '4103', name: '本年利润', type: '所有者权益', direction: '贷', parentCode: null },
  // 收入类
  { code: '6001', name: '租金收入', type: '收入', direction: '贷', parentCode: null },
  { code: '6051', name: '物业费收入', type: '收入', direction: '贷', parentCode: null },
  { code: '6099', name: '其他业务收入', type: '收入', direction: '贷', parentCode: null },
  // 费用类
  { code: '5001', name: '管理费用', type: '费用', direction: '借', parentCode: null },
  { code: '5002', name: '维修费用', type: '费用', direction: '借', parentCode: null },
  { code: '5003', name: '保洁费用', type: '费用', direction: '借', parentCode: null },
  { code: '5004', name: '安保费用', type: '费用', direction: '借', parentCode: null },
  { code: '5005', name: '绿化费用', type: '费用', direction: '借', parentCode: null },
  { code: '5006', name: '办公费用', type: '费用', direction: '借', parentCode: null },
  { code: '5007', name: '折旧费用', type: '费用', direction: '借', parentCode: null },
  { code: '5008', name: '税金及附加', type: '费用', direction: '借', parentCode: null },
  { code: '5401', name: '财务费用', type: '费用', direction: '借', parentCode: null },
];

export async function seedChartOfAccounts(): Promise<void> {
  let book = await AccountBook.findOne({ where: { isActive: true } });
  if (!book) {
    book = await AccountBook.create({
      name: '主账套',
      companyName: '物业租赁管理公司',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      currency: 'CNY',
      isActive: true,
    });
    console.log('[Seed] Default account book created');
  }

  const existing = await ChartOfAccount.count({ where: { bookId: book.id } });
  if (existing > 0) {
    console.log(`[Seed] ${existing} accounts already exist, skipping`);
    return;
  }

  for (const acct of STANDARD_ACCOUNTS) {
    await ChartOfAccount.create({
      bookId: book.id,
      code: acct.code,
      name: acct.name,
      type: acct.type as any,
      level: 1,
      direction: acct.direction as any,
      isEnabled: true,
    });
  }
  console.log(`[Seed] ${STANDARD_ACCOUNTS.length} standard accounts created`);
}
