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
import DoorLock from '../models/DoorLock.js';
import DoorLockPassword from '../models/DoorLockPassword.js';
import DoorLockKey from '../models/DoorLockKey.js';
import DoorLockLog from '../models/DoorLockLog.js';
import ContractTemplate from '../models/ContractTemplate.js';
import ContractClause from '../models/ContractClause.js';
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
  { name: '翡翠湾A座201', type: '公寓' as const, subType: '住宅', area: 85.5, waterFeeRate: 3.8, electricFeeRate: 0.68, propertyFeeRate: 2.5, address: '翡翠湾小区A座2楼201室', floor: '2', unit: 'A', buildingName: '翡翠湾A座', roomNumber: '201', buildingOrder: 1, floorOrder: 2, status: '已出租' as const, amenities: {}, owner: '', notes: '' },
  { name: '翡翠湾B座1503', type: '公寓' as const, subType: '住宅', area: 92.0, waterFeeRate: 3.8, electricFeeRate: 0.68, propertyFeeRate: 2.5, address: '翡翠湾小区B座15楼1503室', floor: '15', unit: 'B', buildingName: '翡翠湾B座', roomNumber: '1503', buildingOrder: 2, floorOrder: 15, status: '已出租' as const, amenities: {}, owner: '', notes: '' },
  { name: '科创园区1号厂房', type: '厂房' as const, subType: '标准厂房', area: 1200.0, waterFeeRate: 5.2, electricFeeRate: 1.15, propertyFeeRate: 1.8, address: '高新区科创园区1号', floor: '1', unit: '', buildingName: '科创园区', roomNumber: '1号厂房', buildingOrder: 3, floorOrder: 1, status: '已出租' as const, amenities: {}, owner: '', notes: '' },
  { name: '科创园区2号厂房', type: '厂房' as const, subType: '标准厂房', area: 1500.0, waterFeeRate: 5.2, electricFeeRate: 1.15, propertyFeeRate: 1.8, address: '高新区科创园区2号', floor: '1', unit: '', buildingName: '科创园区', roomNumber: '2号厂房', buildingOrder: 3, floorOrder: 1, status: '已出租' as const, amenities: {}, owner: '', notes: '' },
  { name: '科创园区5号厂房', type: '厂房' as const, subType: '标准厂房', area: 2000.0, waterFeeRate: 5.2, electricFeeRate: 1.15, propertyFeeRate: 1.8, address: '高新区科创园区5号', floor: '1', unit: '', buildingName: '科创园区', roomNumber: '5号厂房', buildingOrder: 3, floorOrder: 1, status: '空置' as const, amenities: {}, owner: '', notes: '' },
  { name: '万象汇商铺1F-08', type: '商铺' as const, subType: '商业', area: 60.0, waterFeeRate: 4.5, electricFeeRate: 0.95, propertyFeeRate: 8.0, address: '万象汇商业广场1楼08号', floor: '1', unit: '', buildingName: '万象汇商铺', roomNumber: '1F-08', buildingOrder: 4, floorOrder: 1, status: '已出租' as const, amenities: {}, owner: '', notes: '' },
];

const DEMO_TENANTS = [
  { name: '张伟', idType: '身份证' as const, idNumber: '3201**********1234', phone: '13800008888', email: '', wechat: '', contactPerson: '', creditScore: 85, creditGrade: 'A' as const, status: '在租中' as const, attachments: {}, notes: '', gender: '', birthDate: '', ethnicity: '', idAddress: '', idIssuingAuthority: '', idValidFrom: '', idValidTo: '', idPhoto: '' },
  { name: '李娜', idType: '身份证' as const, idNumber: '3202**********5678', phone: '13900009999', email: '', wechat: '', contactPerson: '', creditScore: 72, creditGrade: 'B' as const, status: '在租中' as const, attachments: {}, notes: '', gender: '', birthDate: '', ethnicity: '', idAddress: '', idIssuingAuthority: '', idValidFrom: '', idValidTo: '', idPhoto: '' },
  { name: '创新科技公司', idType: '营业执照' as const, idNumber: '9132**********01', phone: '0512-66668888', email: '', wechat: '', contactPerson: '王经理', creditScore: 90, creditGrade: 'A' as const, status: '在租中' as const, attachments: {}, notes: '', gender: '', birthDate: '', ethnicity: '', idAddress: '', idIssuingAuthority: '', idValidFrom: '', idValidTo: '', idPhoto: '' },
  { name: '长江机械制造公司', idType: '营业执照' as const, idNumber: '9132**********02', phone: '0512-66667777', email: '', wechat: '', contactPerson: '韩厂长', creditScore: 83, creditGrade: 'A' as const, status: '在租中' as const, attachments: {}, notes: '', gender: '', birthDate: '', ethnicity: '', idAddress: '', idIssuingAuthority: '', idValidFrom: '', idValidTo: '', idPhoto: '' },
  { name: '精密模具加工厂', idType: '营业执照' as const, idNumber: '9132**********03', phone: '0512-66669999', email: '', wechat: '', contactPerson: '刘经理', creditScore: 70, creditGrade: 'B' as const, status: '在租中' as const, attachments: {}, notes: '', gender: '', birthDate: '', ethnicity: '', idAddress: '', idIssuingAuthority: '', idValidFrom: '', idValidTo: '', idPhoto: '' },
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

  // 7. 门锁演示数据（4套：2 智能 + 2 传统）
  const demoProperties = properties; // 复用前面创建的房源
  const smartLock1 = await DoorLock.create({
    propertyId: demoProperties[0].id, name: '301室智能锁',
    category: '智能门锁', lockType: '指纹密码锁',
    manufacturer: '涂鸦智能', model: 'T1 Pro', sn: 'SN-TUYA-2024001',
    installDate: '2024-01-15', status: '在线',
    deviceId: 'tuya-dev-301', battery: 85,
    firmwareVersion: 'v2.3.1', ipAddress: '192.168.1.101',
    lastOnlineAt: new Date(),
    notes: '主卧入户智能锁',
  } as any);

  const smartLock2 = await DoorLock.create({
    propertyId: demoProperties[1].id, name: '1503室智能锁',
    category: '智能门锁', lockType: '蓝牙锁',
    manufacturer: 'Aqara', model: 'N200', sn: 'SN-AQARA-2024002',
    installDate: '2024-03-10', status: '在线',
    deviceId: 'aqara-dev-1503', battery: 32,
    firmwareVersion: 'v1.8.0', ipAddress: '192.168.1.203',
    lastOnlineAt: new Date(Date.now() - 7200000),
    notes: '蓝牙智能锁，低电量需关注',
  } as any);

  const tradLock1 = await DoorLock.create({
    propertyId: demoProperties[0].id, name: '201室防盗锁',
    category: '传统门锁', lockType: '防盗门锁',
    manufacturer: '玥玛', model: 'YM-8801', sn: 'SN-YM-2024003',
    installDate: '2024-01-10', status: '正常',
    lockCylinder: 'C级', material: '不锈钢', keyType: '普通钥匙',
    totalKeyCount: 3,
    notes: '甲级防盗门锁，C级锁芯',
  } as any);

  const tradLock2 = await DoorLock.create({
    propertyId: demoProperties[3].id, name: 'B栋厂房大门锁',
    category: '传统门锁', lockType: '挂锁',
    manufacturer: '金点原子', model: 'JY-660', sn: 'SN-JY-2024004',
    installDate: '2024-02-20', status: '正常',
    lockCylinder: 'B级', material: '铜', keyType: '普通钥匙',
    totalKeyCount: 4,
    notes: '厂房大门重型挂锁',
  } as any);

  // 智能锁密码
  await DoorLockPassword.create({
    lockId: smartLock1.id, password: '852046',
    passwordType: '永久', purpose: '入住',
    tenantId: tenants[0]?.id || null,
    startTime: new Date('2024-01-01'),
    isActive: true, maxUseCount: 0,
    createdBy: 1, notes: '租客张伟入住密码',
  } as any);

  await DoorLockPassword.create({
    lockId: smartLock1.id, password: '369715',
    passwordType: '临时', purpose: '保洁',
    startTime: new Date('2026-05-01'),
    endTime: new Date('2026-06-01'),
    isActive: true, maxUseCount: 0,
    createdBy: 1, notes: '5月保洁临时密码',
  } as any);

  await DoorLockPassword.create({
    lockId: smartLock2.id, password: '741203',
    passwordType: '永久', purpose: '入住',
    tenantId: tenants[1]?.id || null,
    startTime: new Date('2024-02-01'),
    isActive: true, maxUseCount: 0,
    createdBy: 1, notes: '租客李娜入住密码',
  } as any);

  // 传统锁钥匙
  await DoorLockKey.create({
    lockId: tradLock1.id, keyCode: 'KEY-201-001',
    keyStatus: '在库', createdBy: 1,
  } as any);
  await DoorLockKey.create({
    lockId: tradLock1.id, keyCode: 'KEY-201-002',
    keyStatus: '在库', createdBy: 1,
  } as any);
  await DoorLockKey.create({
    lockId: tradLock1.id, keyCode: 'KEY-201-003',
    keyStatus: '借出', holderType: '租客',
    holderName: '张伟', holderPhone: '13800008888',
    lendTime: new Date('2026-05-10'),
    expectedReturnTime: new Date('2026-06-10'),
    lendReason: '租客入住',
    createdBy: 1,
  } as any);

  await DoorLockKey.create({
    lockId: tradLock2.id, keyCode: 'KEY-B-001',
    keyStatus: '在库', createdBy: 1,
  } as any);
  await DoorLockKey.create({
    lockId: tradLock2.id, keyCode: 'KEY-B-002',
    keyStatus: '在库', createdBy: 1,
  } as any);
  await DoorLockKey.create({
    lockId: tradLock2.id, keyCode: 'KEY-B-003',
    keyStatus: '借出', holderType: '管理员',
    holderName: '王经理', holderPhone: '0512-66668888',
    lendTime: new Date('2026-04-15'),
    expectedReturnTime: new Date('2026-05-15'),
    lendReason: '厂房巡检',
    createdBy: 1,
  } as any);
  await DoorLockKey.create({
    lockId: tradLock2.id, keyCode: 'KEY-B-004',
    keyStatus: '借出', holderType: '维修',
    holderName: '韩师傅', holderPhone: '13900000000',
    lendTime: new Date('2026-05-12'),
    expectedReturnTime: new Date('2026-05-20'),
    lendReason: '设备维修',
    createdBy: 1,
  } as any);

  // 操作日志
  const logBaseTime = Date.now();
  const logData = [
    { lockId: smartLock1.id, operationType: '密码开锁', operatorName: '张伟', operatorType: '租客', result: '成功', detail: '密码开锁' },
    { lockId: smartLock1.id, operationType: '指纹开锁', operatorName: '张伟', operatorType: '租客', result: '成功', detail: '指纹开锁' },
    { lockId: smartLock1.id, operationType: '远程开锁', operatorName: '管理员', operatorType: '管理员', result: '成功', detail: '管理员远程开锁' },
    { lockId: smartLock1.id, operationType: '密码开锁', operatorName: '保洁阿姨', operatorType: '保洁', result: '成功', detail: '保洁密码开锁' },
    { lockId: smartLock1.id, operationType: '告警', operatorName: '', operatorType: '系统', result: '成功', detail: '电量低于20%告警' },
    { lockId: smartLock2.id, operationType: '蓝牙开锁', operatorName: '李娜', operatorType: '租客', result: '成功', detail: '蓝牙开锁' },
    { lockId: smartLock2.id, operationType: '密码开锁', operatorName: '李娜', operatorType: '租客', result: '成功', detail: '密码开锁' },
    { lockId: smartLock2.id, operationType: '告警', operatorName: '', operatorType: '系统', result: '成功', detail: '电量低于30%告警' },
    { lockId: tradLock1.id, operationType: '钥匙借出', operatorName: '管理员', operatorType: '管理员', result: '成功', detail: '借出钥匙 KEY-201-003 给 张伟（租客）' },
    { lockId: tradLock1.id, operationType: '钥匙开锁', operatorName: '张伟', operatorType: '租客', result: '成功', detail: '钥匙开锁' },
    { lockId: tradLock2.id, operationType: '钥匙借出', operatorName: '管理员', operatorType: '管理员', result: '成功', detail: '借出钥匙 KEY-B-003 给 王经理（管理员）' },
    { lockId: tradLock2.id, operationType: '钥匙借出', operatorName: '管理员', operatorType: '管理员', result: '成功', detail: '借出钥匙 KEY-B-004 给 韩师傅（维修）' },
    { lockId: tradLock2.id, operationType: '钥匙开锁', operatorName: '韩师傅', operatorType: '维修', result: '成功', detail: '钥匙开锁 - 设备维修' },
  ];

  for (let i = 0; i < logData.length; i++) {
    const l = logData[i];
    await DoorLockLog.create({
      lockId: l.lockId,
      operationType: l.operationType,
      operatorName: l.operatorName,
      operatorType: l.operatorType,
      result: l.result,
      detail: l.detail,
      createdAt: new Date(logBaseTime - (logData.length - i) * 86400000),
    } as any);
  }

  console.log('[Seed] 4 door locks (2 smart + 2 traditional) created');
  console.log('[Seed] Demo data complete — 3 years of operational data ready');
}

// 门锁种子数据 — 独立于演示经营数据，可单独调用
export async function seedDoorLocks(): Promise<void> {
  const existing = await DoorLock.findOne();
  if (existing) {
    console.log('[Seed] Door locks already exist, skipping');
    return;
  }

  console.log('[Seed] Creating door lock demo data...');

  const properties = await Property.findAll({ limit: 10, raw: true });
  const tenants = await Tenant.findAll({ limit: 10, raw: true });
  if (properties.length === 0) {
    console.log('[Seed] No properties found, skipping door lock seed');
    return;
  }

  const smartLock1 = await DoorLock.create({
    propertyId: properties[0].id, name: '301室智能锁',
    category: '智能门锁', lockType: '指纹密码锁',
    manufacturer: '涂鸦智能', model: 'T1 Pro', sn: 'SN-TUYA-2024001',
    installDate: '2024-01-15', status: '在线',
    deviceId: 'tuya-dev-301', battery: 85,
    firmwareVersion: 'v2.3.1', ipAddress: '192.168.1.101',
    lastOnlineAt: new Date(),
    notes: '主卧入户智能锁',
  } as any);

  const smartLock2 = await DoorLock.create({
    propertyId: properties[1]?.id || properties[0].id, name: '1503室智能锁',
    category: '智能门锁', lockType: '蓝牙锁',
    manufacturer: 'Aqara', model: 'N200', sn: 'SN-AQARA-2024002',
    installDate: '2024-03-10', status: '在线',
    deviceId: 'aqara-dev-1503', battery: 32,
    firmwareVersion: 'v1.8.0', ipAddress: '192.168.1.203',
    lastOnlineAt: new Date(Date.now() - 7200000),
    notes: '蓝牙智能锁，低电量需关注',
  } as any);

  const tradLock1 = await DoorLock.create({
    propertyId: properties[0].id, name: '201室防盗锁',
    category: '传统门锁', lockType: '防盗门锁',
    manufacturer: '玥玛', model: 'YM-8801', sn: 'SN-YM-2024003',
    installDate: '2024-01-10', status: '正常',
    lockCylinder: 'C级', material: '不锈钢', keyType: '普通钥匙',
    totalKeyCount: 3,
    notes: '甲级防盗门锁，C级锁芯',
  } as any);

  const tradLock2 = await DoorLock.create({
    propertyId: properties[3]?.id || properties[0].id, name: 'B栋厂房大门锁',
    category: '传统门锁', lockType: '挂锁',
    manufacturer: '金点原子', model: 'JY-660', sn: 'SN-JY-2024004',
    installDate: '2024-02-20', status: '正常',
    lockCylinder: 'B级', material: '铜', keyType: '普通钥匙',
    totalKeyCount: 4,
    notes: '厂房大门重型挂锁',
  } as any);

  // 智能锁密码
  await DoorLockPassword.create({
    lockId: smartLock1.id, password: '852046',
    passwordType: '永久', purpose: '入住',
    tenantId: tenants[0]?.id || null,
    startTime: new Date('2024-01-01'),
    isActive: true, maxUseCount: 0,
    createdBy: 1, notes: '租客入住密码',
  } as any);

  await DoorLockPassword.create({
    lockId: smartLock1.id, password: '369715',
    passwordType: '临时', purpose: '保洁',
    startTime: new Date('2026-05-01'),
    endTime: new Date('2026-06-01'),
    isActive: true, maxUseCount: 0,
    createdBy: 1, notes: '5月保洁临时密码',
  } as any);

  await DoorLockPassword.create({
    lockId: smartLock2.id, password: '741203',
    passwordType: '永久', purpose: '入住',
    tenantId: tenants[1]?.id || null,
    startTime: new Date('2024-02-01'),
    isActive: true, maxUseCount: 0,
    createdBy: 1, notes: '租客入住密码',
  } as any);

  // 传统锁钥匙
  await DoorLockKey.create({ lockId: tradLock1.id, keyCode: 'KEY-201-001', keyStatus: '在库', createdBy: 1 } as any);
  await DoorLockKey.create({ lockId: tradLock1.id, keyCode: 'KEY-201-002', keyStatus: '在库', createdBy: 1 } as any);
  await DoorLockKey.create({
    lockId: tradLock1.id, keyCode: 'KEY-201-003',
    keyStatus: '借出', holderType: '租客',
    holderName: tenants[0]?.name || '张伟', holderPhone: '13800008888',
    lendTime: new Date('2026-05-10'),
    expectedReturnTime: new Date('2026-06-10'),
    lendReason: '租客入住', createdBy: 1,
  } as any);

  await DoorLockKey.create({ lockId: tradLock2.id, keyCode: 'KEY-B-001', keyStatus: '在库', createdBy: 1 } as any);
  await DoorLockKey.create({ lockId: tradLock2.id, keyCode: 'KEY-B-002', keyStatus: '在库', createdBy: 1 } as any);
  await DoorLockKey.create({
    lockId: tradLock2.id, keyCode: 'KEY-B-003',
    keyStatus: '借出', holderType: '管理员',
    holderName: '王经理', holderPhone: '0512-66668888',
    lendTime: new Date('2026-04-15'),
    expectedReturnTime: new Date('2026-05-15'),
    lendReason: '厂房巡检', createdBy: 1,
  } as any);
  await DoorLockKey.create({
    lockId: tradLock2.id, keyCode: 'KEY-B-004',
    keyStatus: '借出', holderType: '维修',
    holderName: '韩师傅', holderPhone: '13900000000',
    lendTime: new Date('2026-05-12'),
    expectedReturnTime: new Date('2026-05-20'),
    lendReason: '设备维修', createdBy: 1,
  } as any);

  // 操作日志
  const logBaseTime = Date.now();
  const logs = [
    { lockId: smartLock1.id, operationType: '密码开锁', operatorName: tenants[0]?.name || '张伟', operatorType: '租客', result: '成功', detail: '密码开锁' },
    { lockId: smartLock1.id, operationType: '指纹开锁', operatorName: tenants[0]?.name || '张伟', operatorType: '租客', result: '成功', detail: '指纹开锁' },
    { lockId: smartLock1.id, operationType: '远程开锁', operatorName: '管理员', operatorType: '管理员', result: '成功', detail: '管理员远程开锁' },
    { lockId: smartLock1.id, operationType: '密码开锁', operatorName: '保洁阿姨', operatorType: '保洁', result: '成功', detail: '保洁密码开锁' },
    { lockId: smartLock1.id, operationType: '告警', operatorName: '', operatorType: '系统', result: '成功', detail: '电量低于20%告警' },
    { lockId: smartLock2.id, operationType: '蓝牙开锁', operatorName: tenants[1]?.name || '李娜', operatorType: '租客', result: '成功', detail: '蓝牙开锁' },
    { lockId: smartLock2.id, operationType: '密码开锁', operatorName: tenants[1]?.name || '李娜', operatorType: '租客', result: '成功', detail: '密码开锁' },
    { lockId: smartLock2.id, operationType: '告警', operatorName: '', operatorType: '系统', result: '成功', detail: '电量低于30%告警' },
    { lockId: tradLock1.id, operationType: '钥匙借出', operatorName: '管理员', operatorType: '管理员', result: '成功', detail: '借出钥匙 KEY-201-003' },
    { lockId: tradLock1.id, operationType: '钥匙开锁', operatorName: tenants[0]?.name || '张伟', operatorType: '租客', result: '成功', detail: '钥匙开锁' },
    { lockId: tradLock2.id, operationType: '钥匙借出', operatorName: '管理员', operatorType: '管理员', result: '成功', detail: '借出钥匙 KEY-B-003 给 王经理' },
    { lockId: tradLock2.id, operationType: '钥匙借出', operatorName: '管理员', operatorType: '管理员', result: '成功', detail: '借出钥匙 KEY-B-004 给 韩师傅' },
    { lockId: tradLock2.id, operationType: '钥匙开锁', operatorName: '韩师傅', operatorType: '维修', result: '成功', detail: '钥匙开锁 - 设备维修' },
  ];

  for (let i = 0; i < logs.length; i++) {
    const l = logs[i];
    await DoorLockLog.create({
      lockId: l.lockId, operationType: l.operationType,
      operatorName: l.operatorName, operatorType: l.operatorType,
      result: l.result, detail: l.detail,
      createdAt: new Date(logBaseTime - (logs.length - i) * 86400000),
    } as any);
  }

  console.log('[Seed] 4 door locks (2 smart + 2 traditional) with demo data created');
}

const DEFAULT_CLAUSES = [
  { title: '房屋用途', content: '乙方承诺租赁物业仅用于生产经营用途，不得擅自改变房屋用途。如需变更，应提前30日书面通知甲方并征得甲方书面同意。', type: '标准', sortOrder: 1, isRequired: true },
  { title: '转租限制', content: '未经甲方书面同意，乙方不得将租赁物业全部或部分转租、分租、转让、抵押或以其他方式处置给第三方。如乙方确需转租，须事先取得甲方书面同意，并按甲方要求补交转租相关费用。', type: '标准', sortOrder: 2, isRequired: true },
  { title: '装修与改造', content: '乙方如需对租赁物业进行装修、改造或增设附属设施，须事先向甲方提交书面方案（含设计图纸和安全评估）并经甲方书面批准后方可实施。装修期间不得损坏房屋主体结构和承重墙，相关费用由乙方自行承担。', type: '标准', sortOrder: 3, isRequired: false },
  /* fire safety */
  { title: '消防安全责任主体', content: '乙方为承租区域的消防安全第一责任人，须严格遵守《中华人民共和国消防法》及地方消防安全管理规定。因乙方原因（含乙方员工、访客、承包商行为）导致的火灾事故，由乙方承担全部法律责任和经济赔偿责任（含第三方人身财产损失）。乙方法定代表人或指定负责人为消防安全管理人，须在合同签订后7日内向甲方书面报备。', type: '风险', sortOrder: 4, isRequired: true },
  { title: '消防设施配备与维护', content: '乙方须按国家消防技术规范配备以下消防器材：(1)干粉灭火器（每50㎡至少1具4kg以上）；(2)独立式烟感火灾探测报警器；(3)应急照明灯及疏散指示标志。灭火器须每月自查一次并填写检查记录卡，每年送专业机构检修。甲方有权每季度检查消防设施完好情况，发现隐患乙方须在3日内完成整改并书面回复。', type: '风险', sortOrder: 5, isRequired: true },
  { title: '装修与用电消防安全', content: '装修材料须达到GB 50222《建筑内部装修设计防火规范》B1级及以上防火标准，并提供材料防火检测报告。电气线路敷设须由持证电工施工，禁止私拉乱接电线。大功率电器（≥2kW）须单独回路并加装漏电保护装置。电气线路须每年由专业机构进行一次安全检测，检测报告提交甲方备案。严禁使用假冒伪劣或未取得3C认证的电气产品。', type: '风险', sortOrder: 6, isRequired: true },
  { title: '易燃易爆及危险品管理', content: '严禁在租赁区域内储存、使用、生产易燃易爆危险化学品（含汽油、酒精、油漆、液化气、烟花爆竹等）。严禁电动车在室内停放或充电、严禁将电动车电池带入室内充电。如乙方生产经营确需使用少量危险化学品，须事先取得甲方书面同意并报当地应急管理部门备案，同时配备相应消防设施。违规存放的，甲方有权立即清除，清理费用由乙方承担；情节严重的甲方有权单方解除合同并不退还押金。', type: '风险', sortOrder: 7, isRequired: true },
  { title: '消防通道与疏散管理', content: '乙方不得以任何形式占用、堵塞、封闭疏散通道、安全出口和消防车通道。不得遮挡、圈占、埋压消火栓、灭火器、手动报警按钮等消防设施设备。经营区域内疏散走道净宽度不得小于1.4米，安全出口1.5米范围内不得摆放任何物品。须保持常闭式防火门处于关闭状态，不得上锁。疏散指示标志和应急照明须保持完好有效，每月至少测试一次。', type: '风险', sortOrder: 8, isRequired: true },
  { title: '消防检查与违规处罚', content: '甲方每季度至少进行一次消防安全检查，检查记录须双方签字确认。乙方须在接到整改通知后按期限完成整改；逾期未整改的，每项每日收取违约金200元，甲方可暂停物业服务直至整改完成。累计3次及以上未按要求整改的，甲方有权单方解除合同，乙方须承担因此产生的一切损失。乙方须每年至少组织一次消防疏散演练并留存记录备查。', type: '风险', sortOrder: 9, isRequired: true },
  /* other */
  { title: '环境卫生', content: '乙方应保持租赁物业及周边区域清洁卫生，不得堆放易燃易爆、有毒有害等危险物品。生产经营产生的废弃物须按照环保部门规定分类妥善处理，不得随意倾倒排放。', type: '标准', sortOrder: 10, isRequired: false },
  { title: '设备维护', content: '租赁期间，乙方应合理使用并妥善维护甲方提供的设备设施。因乙方使用不当造成损坏的，维修费用由乙方承担。日常易损件（灯泡、开关面板、水龙头垫圈等）更换由乙方负责，大型设备维修由甲方负责。', type: '标准', sortOrder: 11, isRequired: false },
  { title: '水电费用', content: '租赁期间产生的水费、电费由乙方自行承担。乙方应按时向供水供电部门或甲方缴纳费用，不得拖欠。如因乙方欠费导致停水停电、影响生产经营的，由乙方自行承担全部责任和后果。', type: '标准', sortOrder: 12, isRequired: true },
  { title: '违约责任', content: '乙方逾期支付租金的，每逾期一日应按当期应付租金的千分之五向甲方支付违约金。逾期超过30日的，甲方有权单方解除本合同并要求乙方赔偿全部损失（含租金损失、违约金及甲方追索费用等）。', type: '风险', sortOrder: 13, isRequired: true },
  { title: '合同解除', content: '有下列情形之一的，甲方有权单方解除本合同：(1)乙方擅自转租、转让或抵押租赁物业的；(2)乙方逾期支付租金累计超过30日的；(3)乙方擅自改变房屋用途的；(4)乙方在租赁物业内从事违法活动的；(5)乙方严重损坏房屋主体结构且拒不修复的。', type: '风险', sortOrder: 14, isRequired: true },
  { title: '争议解决', content: '本合同在履行过程中发生争议的，双方应首先友好协商解决；协商不成的，任何一方均可向物业所在地有管辖权的人民法院提起诉讼。本合同一式两份，甲乙双方各执一份，具有同等法律效力。', type: '标准', sortOrder: 15, isRequired: true },
];

const FIRE_SAFETY_DEFAULTS = {
  responsibilityParty: '双方',
  inspectionFrequency: '每季',
  clauses: [
    { title: '消防安全责任主体', content: '乙方为承租区域的消防安全第一责任人，须严格遵守《中华人民共和国消防法》及地方消防安全管理规定。因乙方原因导致的火灾事故，由乙方承担全部法律责任和经济赔偿责任。' },
    { title: '消防设施配备与维护', content: '乙方须按消防规范配备灭火器、独立式烟感报警器等器材，每月自查一次并记录。甲方有权每季检查消防设施完好情况，发现隐患乙方须在3日内整改。' },
    { title: '装修与用电消防安全', content: '装修材料须达到B1级及以上防火标准，电气线路须由持证电工施工，禁止私拉乱接电线。大功率电器须单独回路并加装漏电保护。' },
    { title: '易燃易爆及危险品管理', content: '严禁在租赁区域内储存、使用易燃易爆危险品。违规存放的，甲方有权立即清除并要求乙方承担清理费用，情节严重的甲方有权单方解除合同。' },
    { title: '消防通道与疏散管理', content: '不得以任何形式占用、堵塞、封闭消防通道和安全出口。不得遮挡消火栓、灭火器等消防设施。须保持疏散指示标志和应急照明完好有效。' },
    { title: '消防检查与违规处罚', content: '甲方每季至少进行一次消防安全检查，检查记录双方签字确认。逾期未整改的，每项每日收取违约金200元；累计3次未整改的，甲方有权解除合同。' },
  ],
  restrictions: [
    '禁止使用明火作业（如电焊、气割等，经甲方书面同意的除外）',
    '禁止在租赁区域内存放汽油、酒精、油漆等易燃易爆物品',
    '禁止电动车在室内停放或充电、禁止将电池带入室内充电',
    '禁止擅自改变消防设施用途或拆除消防设备',
  ],
  equipment: [
    '干粉灭火器（≥2具，每50㎡至少1具4kg以上）',
    '独立式烟感火灾探测报警器',
    '应急照明灯',
    '疏散指示标志',
    '消防水带',
  ],
  violationPenalty: '逾期未整改的，每项每日收取违约金200元；累计3次及以上未整改的，甲方有权单方解除合同。',
};

export async function seedContractTemplates(): Promise<void> {
  const existing = await ContractTemplate.findOne();
  if (existing) {
    console.log('[Seed] Contract templates already exist, skipping');
    return;
  }

  console.log('[Seed] Creating contract templates with default clauses...');

  const propertyTypes = ['厂房', '商铺', '住房'] as const;
  const typeNames: Record<string, string> = { '厂房': '厂房租赁标准模板', '商铺': '商铺租赁标准模板', '住房': '住房租赁标准模板' };

  for (const propType of propertyTypes) {
    const template = await ContractTemplate.create({
      name: typeNames[propType],
      type: propType,
      isDefault: true,
      content: { fireSafetyDefaults: FIRE_SAFETY_DEFAULTS } as any,
      terms: {} as any,
    });

    for (const clause of DEFAULT_CLAUSES) {
      await ContractClause.create({
        templateId: template.id,
        title: clause.title,
        content: clause.content,
        type: clause.type,
        sortOrder: clause.sortOrder,
        isRequired: clause.isRequired,
      } as any);
    }
  }

  console.log(`[Seed] 3 contract templates × ${DEFAULT_CLAUSES.length} clauses created`);
}

export async function seedIdCardReaders(): Promise<void> {
  const { default: IdCardReader } = await import('../models/IdCardReader.js');
  const count = await IdCardReader.count();
  if (count > 0) {
    console.log('[Seed] IdCardReaders already seeded — skipping');
    return;
  }

  const readers = [
    {
      name: '前台读卡器',
      brand: '华视' as const,
      model: 'CVR-100UC',
      interfaceType: 'USB' as const,
      port: 'USB1',
      status: '在线' as const,
      firmwareVersion: 'V2.3.1',
      lastReadAt: new Date(),
    },
    {
      name: '办公室读卡器',
      brand: '新中新' as const,
      model: 'DKQ-A16D',
      interfaceType: 'USB' as const,
      port: 'USB2',
      status: '未激活' as const,
      firmwareVersion: 'V1.8.0',
    },
  ];

  for (const r of readers) {
    await IdCardReader.create(r as any);
  }

  console.log(`[Seed] ${readers.length} id card readers created`);
}

export async function seedFireSafety(): Promise<void> {
  const { default: FireInspection } = await import('../models/FireInspection.js');
  const { default: FireEquipment } = await import('../models/FireEquipment.js');
  const { default: FireViolation } = await import('../models/FireViolation.js');
  const { default: FireDrill } = await import('../models/FireDrill.js');
  const { default: Property } = await import('../models/Property.js');

  const existing = await FireInspection.findOne();
  if (existing) { console.log('[Seed] Fire safety data already exists, skipping'); return; }

  console.log('[Seed] Creating fire safety demo data...');
  const properties = await Property.findAll({ limit: 6, raw: true });

  // 器材 — 每房源5-6件
  const equipmentData = [
    { category: '灭火器', name: '干粉灭火器 MFZ/ABC4', model: 'MFZ/ABC4', quantity: 2, location: '走廊东侧', status: '正常', nextCheckDate: '2026-12-31' },
    { category: '灭火器', name: '二氧化碳灭火器 MT/3', model: 'MT/3', quantity: 1, location: '配电房', status: '正常', nextCheckDate: '2026-09-15' },
    { category: '烟感报警器', name: '独立式烟感火灾探测器', model: 'JTY-GD-802', quantity: 3, location: '天花板', status: '正常', nextCheckDate: '2026-08-01' },
    { category: '应急照明', name: '双头应急照明灯', model: 'MJ-ZLZD-E18W', quantity: 2, location: '安全出口上方', status: '即将过期', nextCheckDate: '2026-07-01' },
    { category: '疏散标志', name: 'LED安全出口指示牌', model: 'LED-101', quantity: 2, location: '走廊转角', status: '正常', nextCheckDate: '2027-01-01' },
    { category: '消火栓', name: '室内消火栓 SN65', model: 'SN65', quantity: 1, location: '楼梯口', status: '正常', nextCheckDate: '2026-11-01' },
    { category: '灭火器', name: '干粉灭火器 MFZ/ABC4', model: 'MFZ/ABC4-old', quantity: 1, location: '仓库', status: '已过期', nextCheckDate: '2025-06-01' },
    { category: '防火门', name: '钢制乙级防火门', model: 'GFM-1021', quantity: 1, location: '楼梯间', status: '待维修', nextCheckDate: '2026-06-30' },
  ];

  for (const p of properties) {
    const eqs = equipmentData.slice(0, 4 + (p.id % 3)); // 每房源4-6件
    for (const e of eqs) {
      await FireEquipment.create({
        propertyId: (p as any).id, ...e,
        purchaseDate: '2024-01-15', expiryDate: '2028-01-15',
        lastCheckDate: '2026-03-01', manufacturer: '消防器材有限公司',
      } as any);
    }
  }

  // 检查记录 — 每房源2-3条
  const now = new Date();
  for (const p of properties) {
    for (let i = 2; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      await FireInspection.create({
        propertyId: (p as any).id, inspectorId: 1,
        inspectionDate: d.toISOString().slice(0, 10),
        type: i === 0 ? '季度检查' : '日常巡查',
        result: i === 1 ? '限期整改' : '合格',
        overallScore: i === 1 ? 72 : 95,
        fireExtinguisherOk: i !== 1, smokeAlarmOk: true,
        emergencyLightOk: i !== 1, escapeRouteOk: true,
        electricalOk: true, flammableOk: i !== 1,
        notes: i === 1 ? '灭火器过期需更换，应急灯故障需维修' : '',
        nextInspectionDate: new Date(now.getFullYear(), now.getMonth() + 3, 1).toISOString().slice(0, 10),
      } as any);
    }
  }

  // 违规记录
  const inspections = await FireInspection.findAll({ where: { result: '限期整改' }, limit: 3, raw: true });
  for (const insp of inspections) {
    await FireViolation.create({
      propertyId: (insp as any).propertyId, inspectionId: (insp as any).id,
      tenantId: null, violationDate: (insp as any).inspectionDate,
      category: '器材缺失', severity: '一般隐患',
      description: '灭火器已过有效期，应急照明灯故障不亮',
      rectificationRequirement: '7日内更换过期灭火器并修复应急灯',
      deadline: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
      status: '待整改', penaltyAmount: 0, penaltyStatus: '无罚款',
      operatorId: 1,
    } as any);
  }

  // 演练记录
  for (const p of properties.slice(0, 2)) {
    await FireDrill.create({
      propertyId: (p as any).id,
      drillDate: new Date(now.getFullYear(), now.getMonth() - 1, 15).toISOString().slice(0, 10),
      type: '综合演练', organizer: '物业管理处',
      participantCount: 25, duration: 45, evacuationTime: 180,
      score: 88, summary: '全体人员有序疏散，灭火器使用规范，应急响应流程顺畅',
      issues: '个别人员未按指定路线疏散，集合点清点人数耗时较长',
      improvementPlan: '下次演练前增加疏散路线培训，设置专人负责人数清点',
    } as any);
  }

  console.log('[Seed] Fire safety demo data created');
}
