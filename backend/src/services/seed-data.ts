import AccountBook from '../models/AccountBook.js';
import ChartOfAccount from '../models/ChartOfAccount.js';
import Property from '../models/Property.js';
import Tenant from '../models/Tenant.js';
import Contract from '../models/Contract.js';
import Bill from '../models/Bill.js';
import PaymentRecord from '../models/PaymentRecord.js';
import Voucher from '../models/Voucher.js';
import VoucherEntry from '../models/VoucherEntry.js';
import Expense from '../models/Expense.js';
import { Op } from 'sequelize';
import dayjs from 'dayjs';

const STANDARD_ACCOUNTS = [
  { code: '1001', name: '库存现金', type: '资产', direction: '借' },
  { code: '1002', name: '银行存款', type: '资产', direction: '借' },
  { code: '1122', name: '应收账款', type: '资产', direction: '借' },
  { code: '1221', name: '其他应收款', type: '资产', direction: '借' },
  { code: '1601', name: '固定资产', type: '资产', direction: '借' },
  { code: '1602', name: '累计折旧', type: '资产', direction: '贷' },
  { code: '1701', name: '无形资产', type: '资产', direction: '借' },
  { code: '2202', name: '应付账款', type: '负债', direction: '贷' },
  { code: '2241', name: '其他应付款', type: '负债', direction: '贷' },
  { code: '2242', name: '预收租金', type: '负债', direction: '贷' },
  { code: '2221', name: '应交税费', type: '负债', direction: '贷' },
  { code: '4001', name: '实收资本', type: '所有者权益', direction: '贷' },
  { code: '4104', name: '利润分配', type: '所有者权益', direction: '贷' },
  { code: '4103', name: '本年利润', type: '所有者权益', direction: '贷' },
  { code: '6001', name: '租金收入', type: '收入', direction: '贷' },
  { code: '6051', name: '物业费收入', type: '收入', direction: '贷' },
  { code: '6099', name: '其他业务收入', type: '收入', direction: '贷' },
  { code: '5001', name: '管理费用', type: '费用', direction: '借' },
  { code: '5002', name: '维修费用', type: '费用', direction: '借' },
  { code: '5003', name: '保洁费用', type: '费用', direction: '借' },
  { code: '5004', name: '安保费用', type: '费用', direction: '借' },
  { code: '5005', name: '绿化费用', type: '费用', direction: '借' },
  { code: '5006', name: '办公费用', type: '费用', direction: '借' },
  { code: '5007', name: '折旧费用', type: '费用', direction: '借' },
  { code: '5008', name: '税金及附加', type: '费用', direction: '借' },
  { code: '5401', name: '财务费用', type: '费用', direction: '借' },
];

export async function seedChartOfAccounts(): Promise<void> {
  let book = await AccountBook.findOne({ where: { isActive: true } });
  if (!book) {
    book = await AccountBook.create({
      name: '主账套',
      companyName: '物业租赁管理公司',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
      currency: 'CNY',
      isActive: true,
      settings: {},
    } as any);
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

// ============================================================
// 演示数据定义
// ============================================================

const DEMO_PROPERTIES = [
  { name: '翡翠湾A座201', type: '公寓' as const, subType: '住宅', area: 85.5, waterFeeRate: 3.8, electricFeeRate: 0.68, propertyFeeRate: 2.5, address: '翡翠湾小区A座2楼201室', floor: '2', unit: 'A', status: '已出租' as const, amenities: {}, owner: '', notes: '' },
  { name: '翡翠湾B座1503', type: '公寓' as const, subType: '住宅', area: 92.0, waterFeeRate: 3.8, electricFeeRate: 0.68, propertyFeeRate: 2.5, address: '翡翠湾小区B座15楼1503室', floor: '15', unit: 'B', status: '已出租' as const, amenities: {}, owner: '', notes: '' },
  { name: '科创园区1号厂房', type: '厂房' as const, subType: '标准厂房', area: 1200.0, waterFeeRate: 5.2, electricFeeRate: 1.15, propertyFeeRate: 1.8, address: '高新区科创园区1号', floor: '1', unit: '', status: '已出租' as const, amenities: {}, owner: '', notes: '' },
  { name: '科创园区2号厂房', type: '厂房' as const, subType: '标准厂房', area: 1500.0, waterFeeRate: 5.2, electricFeeRate: 1.15, propertyFeeRate: 1.8, address: '高新区科创园区2号', floor: '1', unit: '', status: '已出租' as const, amenities: {}, owner: '', notes: '' },
  { name: '科创园区5号厂房', type: '厂房' as const, subType: '标准厂房', area: 2000.0, waterFeeRate: 5.2, electricFeeRate: 1.15, propertyFeeRate: 1.8, address: '高新区科创园区5号', floor: '1', unit: '', status: '空置' as const, amenities: {}, owner: '', notes: '' },
  { name: '万象汇商铺1F-08', type: '商铺' as const, subType: '商业', area: 60.0, waterFeeRate: 4.5, electricFeeRate: 0.95, propertyFeeRate: 8.0, address: '万象汇商业广场1楼08号', floor: '1', unit: '', status: '已出租' as const, amenities: {}, owner: '', notes: '' },
];

const DEMO_TENANTS = [
  { name: '张伟', idType: '身份证' as const, idNumber: '3201**********1234', phone: '13800008888', email: '', wechat: '', contactPerson: '', creditScore: 85, creditGrade: 'A' as const, status: '在租中' as const, attachments: {}, notes: '' },
  { name: '李娜', idType: '身份证' as const, idNumber: '3202**********5678', phone: '13900009999', email: '', wechat: '', contactPerson: '', creditScore: 72, creditGrade: 'B' as const, status: '在租中' as const, attachments: {}, notes: '' },
  { name: '创新科技公司', idType: '营业执照' as const, idNumber: '9132**********01', phone: '0512-66668888', email: '', wechat: '', contactPerson: '王经理', creditScore: 90, creditGrade: 'A' as const, status: '在租中' as const, attachments: {}, notes: '' },
  { name: '长江机械制造公司', idType: '营业执照' as const, idNumber: '9132**********02', phone: '0512-66667777', email: '', wechat: '', contactPerson: '韩厂长', creditScore: 83, creditGrade: 'A' as const, status: '在租中' as const, attachments: {}, notes: '' },
  { name: '精密模具加工厂', idType: '营业执照' as const, idNumber: '9132**********03', phone: '0512-66669999', email: '', wechat: '', contactPerson: '刘经理', creditScore: 70, creditGrade: 'B' as const, status: '在租中' as const, attachments: {}, notes: '' },
];

interface DemoContractDef {
  contractNo: string; tenantIdx: number; propertyIdx: number;
  rentAmount: number; depositAmount: number; paymentCycle: '月' | '季' | '年';
  startDate: string; endDate: string;
  waterFee: number; electricFee: number; propertyFee: number;
}

const DEMO_CONTRACTS: DemoContractDef[] = [
  { contractNo: 'CT-2024-001', tenantIdx: 0, propertyIdx: 0, rentAmount: 2500, depositAmount: 5000, paymentCycle: '月', startDate: '2024-01-01', endDate: '2027-01-01', waterFee: 30, electricFee: 120, propertyFee: 200 },
  { contractNo: 'CT-2024-002', tenantIdx: 1, propertyIdx: 1, rentAmount: 2800, depositAmount: 5600, paymentCycle: '月', startDate: '2024-02-01', endDate: '2027-02-01', waterFee: 35, electricFee: 140, propertyFee: 230 },
  { contractNo: 'CT-2024-003', tenantIdx: 2, propertyIdx: 2, rentAmount: 15000, depositAmount: 45000, paymentCycle: '季', startDate: '2024-01-01', endDate: '2027-01-01', waterFee: 200, electricFee: 800, propertyFee: 1800 },
  { contractNo: 'CT-2024-004', tenantIdx: 3, propertyIdx: 3, rentAmount: 18000, depositAmount: 36000, paymentCycle: '月', startDate: '2024-03-01', endDate: '2027-03-01', waterFee: 250, electricFee: 1000, propertyFee: 2200 },
  { contractNo: 'CT-2024-005', tenantIdx: 4, propertyIdx: 5, rentAmount: 8000, depositAmount: 24000, paymentCycle: '月', startDate: '2024-01-01', endDate: '2027-01-01', waterFee: 80, electricFee: 300, propertyFee: 480 },
];

const EXPENSE_MONTHLY_PLAN: Record<string, number> = {
  '维修': 800, '保洁': 1200, '安保': 2000, '办公': 500,
};

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
}

export async function seedAllDemoData(): Promise<void> {
  const existingContract = await Contract.findOne({ where: { contractNo: 'CT-2024-001' } });
  if (existingContract) {
    console.log('[Seed] Demo data already exists, skipping');
    return;
  }

  console.log('[Seed] Creating comprehensive demo data (2024-01 ~ present)...');

  // 0. 获取科目ID映射（按code查找）
  const accountMap: Record<string, number> = {};
  const accounts = await ChartOfAccount.findAll({ attributes: ['id', 'code'], raw: true });
  accounts.forEach((a: any) => { accountMap[a.code] = a.id; });
  const BANK_ID = accountMap['1002'];   // 银行存款
  const RENT_INCOME_ID = accountMap['6001']; // 租金收入
  const PROPERTY_INCOME_ID = accountMap['6051']; // 物业费收入
  const OTHER_INCOME_ID = accountMap['6099']; // 其他业务收入（水电费）
  // 费用科目code→id
  const EXPENSE_ACCT_MAP: Record<string, string> = { '维修': '5002', '保洁': '5003', '安保': '5004', '办公': '5006' };

  // 1. 房源
  const properties: any[] = [];
  for (const p of DEMO_PROPERTIES) {
    const existing = await Property.findOne({ where: { name: p.name } });
    if (existing) { await existing.update({ status: p.status }); properties.push(existing); }
    else { properties.push(await Property.create(p)); }
  }

  // 2. 租客
  const tenants: any[] = [];
  for (const t of DEMO_TENANTS) {
    const existing = await Tenant.findOne({ where: { name: t.name } });
    if (existing) { await existing.update({ status: t.status }); tenants.push(existing); }
    else { tenants.push(await Tenant.create(t)); }
  }

  // 3. 合同
  const contracts: any[] = [];
  for (const def of DEMO_CONTRACTS) {
    contracts.push(await Contract.create({
      contractNo: def.contractNo, propertyId: properties[def.propertyIdx].id,
      tenantId: tenants[def.tenantIdx].id, startDate: new Date(def.startDate),
      endDate: new Date(def.endDate), rentAmount: def.rentAmount,
      depositAmount: def.depositAmount, paymentCycle: def.paymentCycle,
      billingMode: '固定',
      billingConfig: { waterFee: def.waterFee, electricFee: def.electricFee, propertyFee: def.propertyFee },
      status: '执行中', signedAt: new Date(def.startDate), createdBy: 1,
    } as any));
  }

  // 4. 账单 + 收款 + 凭证
  const currentPeriod = dayjs().format('YYYY-MM');
  const nextPeriod = dayjs().add(1, 'month').format('YYYY-MM');
  const { sequelize } = await import('../config/database.js');
  let billSeq = 0, voucherSeq = 0;

  for (const contract of contracts) {
    const def = DEMO_CONTRACTS.find(d => d.contractNo === contract.contractNo)!;
    const startMonth = dayjs(def.startDate).format('YYYY-MM');
    const cycleMonths = def.paymentCycle === '月' ? 1 : def.paymentCycle === '季' ? 3 : 12;
    const rand = seededRandom(contract.id * 100);

    let period = startMonth;
    while (period <= nextPeriod) {
      const periodDate = dayjs(period + '-01');
      const dueDate = periodDate.date(5).format('YYYY-MM-DD');
      const utilityAmount = def.waterFee + def.electricFee;
      const otherAmount = 0;
      const totalAmount = def.rentAmount + utilityAmount + def.propertyFee + otherAmount;
      const periodNum = parseInt(period.replace('-', ''));

      let status: string;
      let paidDate: string | null = null;

      if (period === nextPeriod || period === currentPeriod) {
        status = '未缴';
      } else if (periodNum >= 202604) {
        const r = rand();
        if (r < 0.5) { status = '已缴'; paidDate = dueDate; }
        else if (r < 0.8) { status = '部分缴'; paidDate = dueDate; }
        else status = '逾期';
      } else if (periodNum >= 202601) {
        const r = rand();
        if (r < 0.8) { status = '已缴'; paidDate = dueDate; }
        else if (r < 0.95) { status = '部分缴'; paidDate = dueDate; }
        else status = '逾期';
      } else {
        status = '已缴'; paidDate = dueDate;
      }

      billSeq++;
      const billNo = `BL-${String(billSeq).padStart(4, '0')}`;
      const lateFee = status === '逾期' ? Math.round(totalAmount * 0.05 * 100) / 100 : 0;

      const bill = await Bill.create({
        contractId: contract.id, billNo, period,
        rentAmount: def.rentAmount,
        waterFee: def.waterFee,
        electricFee: def.electricFee,
        utilityAmount,
        propertyFee: def.propertyFee,
        otherAmount,
        lateFee,
        totalAmount: totalAmount + lateFee,
        dueDate: new Date(dueDate),
        paidDate: paidDate ? new Date(paidDate) : null,
        status,
        paymentChannel: paidDate ? (rand() > 0.5 ? '微信支付' : '银行转账') : null,
      } as any);

      // 已缴/部分缴 → 收款记录
      if (paidDate && (status === '已缴' || status === '部分缴')) {
        const payAmount = status === '部分缴' ? Math.round(totalAmount * 0.6 * 100) / 100 : totalAmount;
        await PaymentRecord.create({
          billId: bill.id, amount: payAmount,
          channel: rand() > 0.5 ? '微信支付' : '银行转账',
          transactionNo: `TXN${period.replace('-', '')}${String(billSeq).padStart(3, '0')}`,
          paidAt: new Date(paidDate + 'T10:00:00'), notes: '', createdBy: 1,
        } as any);

        // 全额已缴 → 会计凭证（收入分拆到三个科目）
        if (status === '已缴') {
          voucherSeq++;
          const v = await Voucher.create({
            bookId: 1, voucherNo: `SK-${String(voucherSeq).padStart(4, '0')}`,
            date: new Date(paidDate), period, type: '收',
            summary: `${def.contractNo} 收租(${period})`, status: '已过账', createdBy: 1,
          } as any);

          // 借: 银行存款（全额）
          await VoucherEntry.create({ voucherId: v.id, accountId: BANK_ID, summary: `收租(${period})`, debitAmount: totalAmount, creditAmount: 0, billId: bill.id });
          // 贷: 租金收入
          if (def.rentAmount > 0) {
            await VoucherEntry.create({ voucherId: v.id, accountId: RENT_INCOME_ID, summary: `租金收入(${period})`, debitAmount: 0, creditAmount: def.rentAmount, billId: bill.id });
          }
          // 贷: 物业费收入
          if (def.propertyFee > 0) {
            await VoucherEntry.create({ voucherId: v.id, accountId: PROPERTY_INCOME_ID, summary: `物业费收入(${period})`, debitAmount: 0, creditAmount: def.propertyFee, billId: bill.id });
          }
          // 贷: 其他业务收入（水电费）
          const utilitySum = def.waterFee + def.electricFee;
          if (utilitySum > 0) {
            await VoucherEntry.create({ voucherId: v.id, accountId: OTHER_INCOME_ID, summary: `水电费收入(${period})`, debitAmount: 0, creditAmount: utilitySum, billId: bill.id });
          }
        }
      }

      period = periodDate.add(cycleMonths, 'month').format('YYYY-MM');
    }
  }

  console.log(`[Seed] ${billSeq} bills (${voucherSeq} revenue vouchers)`);

  // 5. 月度费用（用原始SQL插入以设置正确的createdAt）
  let expSeq = 0, expVoucherSeq = 0;

  for (let m = dayjs('2024-01'); m.isBefore(dayjs().add(1, 'month')); m = m.add(1, 'month')) {
    const monthStr = m.format('YYYY-MM');
    const rand = seededRandom(parseInt(monthStr.replace('-', '')));

    for (const cat of Object.keys(EXPENSE_MONTHLY_PLAN)) {
      const baseAmount = EXPENSE_MONTHLY_PLAN[cat];
      const amount = Math.round(baseAmount * (0.7 + rand() * 0.6) * 100) / 100;
      const expenseDay = 5 + Math.floor(rand() * 20);
      const ts = m.date(expenseDay).format('YYYY-MM-DD') + ' 10:00:00';

      expSeq++;
      await sequelize.query(
        `INSERT INTO expenses (bookId, category, amount, allocationRule, status, notes, createdBy, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        { replacements: [1, cat, amount, '{}', '已批准', `${monthStr} ${cat}费`, 1, ts, ts] }
      );

      if (amount > 400) {
        expVoucherSeq++;
        const v = await Voucher.create({
          bookId: 1, voucherNo: `FK-${String(expVoucherSeq).padStart(4, '0')}`,
          date: new Date(ts), period: monthStr, type: '付',
          summary: `${cat}费(${monthStr})`, status: '已过账', createdBy: 1,
        } as any);
        const acctCode = EXPENSE_ACCT_MAP[cat] || '5001';
        const acctId = accountMap[acctCode];
        await VoucherEntry.create({ voucherId: v.id, accountId: acctId, summary: `${cat}费(${monthStr})`, debitAmount: amount, creditAmount: 0 });
        await VoucherEntry.create({ voucherId: v.id, accountId: BANK_ID, summary: `支付${cat}费(${monthStr})`, debitAmount: 0, creditAmount: amount });
      }
    }
  }

  console.log(`[Seed] ${expSeq} expenses (${expVoucherSeq} expense vouchers)`);

  // 6. 生成催缴任务 — 确保四个级别都有演示数据
  const DunningTask = (await import('../models/DunningTask.js')).default;
  const now = dayjs();
  const today = now.format('YYYY-MM-DD');
  let dunningCount = 0;

  // 1级：到期提醒 — 未来7天内到期的账单（包含下月账单）
  const upcomingBills = await Bill.findAll({
    where: { status: '未缴', dueDate: { [Op.lte]: now.add(30, 'day').format('YYYY-MM-DD'), [Op.gte]: today } as any },
    raw: true,
  });
  for (const b of upcomingBills) {
    await DunningTask.create({ billId: b.id, level: 1, channel: '站内信', title: '租金到期提醒', content: `您的账单 ${b.billNo} 即将于 ${(b as any).dueDate} 到期，金额 ¥${Number(b.totalAmount).toFixed(2)}，请提前准备。`, status: '已发送', sentAt: new Date() } as any);
    dunningCount++;
  }

  // 2级：一级催缴 — 逾期1-30天（含当前月份已逾期的未缴账单）
  const range1to30 = await Bill.findAll({
    where: { status: { [Op.in]: ['逾期', '部分缴', '未缴'] }, dueDate: { [Op.lte]: dayjs().subtract(1, 'day').format('YYYY-MM-DD'), [Op.gte]: dayjs().subtract(30, 'day').format('YYYY-MM-DD') } as any },
    raw: true,
  });
  for (const b of range1to30) {
    await DunningTask.create({ billId: b.id, level: 2, channel: '站内信', title: '租金催缴通知', content: `尊敬的租户，您的账单 ${b.billNo} 已逾期，金额 ¥${Number(b.totalAmount).toFixed(2)}，请尽快缴纳。`, status: '已发送', sentAt: new Date() } as any);
    dunningCount++;
  }

  // 3级：二级催缴 — 逾期30-60天
  const range30to60 = await Bill.findAll({
    where: { status: { [Op.in]: ['逾期', '部分缴'] }, dueDate: { [Op.lte]: dayjs().subtract(30, 'day').format('YYYY-MM-DD'), [Op.gte]: dayjs().subtract(60, 'day').format('YYYY-MM-DD') } as any },
    raw: true,
  });
  for (const b of range30to60) {
    await DunningTask.create({ billId: b.id, level: 3, channel: '短信', title: '租金逾期催缴', content: `【物业催缴】您的账单 ${b.billNo} 已逾期超过30天，欠费 ¥${Number(b.totalAmount).toFixed(2)}，请立即处理以免影响信用。`, status: '已发送', sentAt: new Date() } as any);
    dunningCount++;
  }

  // 4级：三级催缴 — 逾期60天以上
  const range60plus = await Bill.findAll({
    where: { status: { [Op.in]: ['逾期', '部分缴'] }, dueDate: { [Op.lte]: dayjs().subtract(60, 'day').format('YYYY-MM-DD') } as any },
    raw: true,
  });
  for (const b of range60plus) {
    await DunningTask.create({ billId: b.id, level: 4, channel: '书面', title: '最后催缴通知', content: `【最后催缴】您的账单 ${b.billNo} 已逾期超过60天，欠费 ¥${Number(b.totalAmount).toFixed(2)}，请3日内结清，否则将按合同采取法律措施。`, status: '已发送', sentAt: new Date() } as any);
    dunningCount++;
  }

  console.log(`[Seed] ${dunningCount} dunning tasks created`);
  console.log('[Seed] Demo data complete — 3 years of operational data ready');
}
