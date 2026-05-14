/**
 * 模拟经营数据生成脚本
 * 生成50名租户、12处房源、3年日常经营数据
 * 运行方式: cd backend && npx tsx src/scripts/generate-demo-data.ts
 */

import { sequelize } from '../config/database.js';
import '../models/index.js';    // 触发关联注册
import Property from '../models/Property.js';
import Tenant from '../models/Tenant.js';
import Contract from '../models/Contract.js';
import Bill from '../models/Bill.js';
import PaymentRecord from '../models/PaymentRecord.js';
import Voucher from '../models/Voucher.js';
import VoucherEntry from '../models/VoucherEntry.js';
import ChartOfAccount from '../models/ChartOfAccount.js';
import AccountBook from '../models/AccountBook.js';
import DunningTask from '../models/DunningTask.js';
import dayjs from 'dayjs';

// ==================== 房源数据 ====================
const PROPERTIES = [
  // 翡翠湾小区 — 公寓
  { name: '翡翠湾A座101', type: '公寓', area: 88.5, waterFeeRate: 3.80, electricFeeRate: 0.68, propertyFeeRate: 2.50, address: '翡翠湾小区A座1楼101室', floor: '1', unit: 'A', status: '已出租' },
  { name: '翡翠湾A座205', type: '公寓', area: 76.0, waterFeeRate: 3.80, electricFeeRate: 0.68, propertyFeeRate: 2.50, address: '翡翠湾小区A座2楼205室', floor: '2', unit: 'A', status: '已出租' },
  { name: '翡翠湾B座301', type: '公寓', area: 92.0, waterFeeRate: 3.80, electricFeeRate: 0.68, propertyFeeRate: 2.50, address: '翡翠湾小区B座3楼301室', floor: '3', unit: 'B', status: '已出租' },
  { name: '翡翠湾B座502', type: '公寓', area: 105.0, waterFeeRate: 3.80, electricFeeRate: 0.68, propertyFeeRate: 2.50, address: '翡翠湾小区B座5楼502室', floor: '5', unit: 'B', status: '已出租' },
  { name: '翡翠湾C座1201', type: '公寓', area: 68.0, waterFeeRate: 3.80, electricFeeRate: 0.68, propertyFeeRate: 2.50, address: '翡翠湾小区C座12楼1201室', floor: '12', unit: 'C', status: '已出租' },
  { name: '翡翠湾C座803', type: '公寓', area: 115.0, waterFeeRate: 3.80, electricFeeRate: 0.68, propertyFeeRate: 2.50, address: '翡翠湾小区C座8楼803室', floor: '8', unit: 'C', status: '已出租' },
  { name: '翡翠湾D座1502', type: '公寓', area: 82.0, waterFeeRate: 3.80, electricFeeRate: 0.68, propertyFeeRate: 2.50, address: '翡翠湾小区D座15楼1502室', floor: '15', unit: 'D', status: '已出租' },
  { name: '翡翠湾D座201', type: '公寓', area: 96.0, waterFeeRate: 3.80, electricFeeRate: 0.68, propertyFeeRate: 2.50, address: '翡翠湾小区D座2楼201室', floor: '2', unit: 'D', status: '已出租' },
  // 万象汇商业广场 — 商铺
  { name: '万象汇1F-01', type: '商铺', area: 55.0, waterFeeRate: 4.50, electricFeeRate: 0.95, propertyFeeRate: 8.00, address: '万象汇商业广场1楼01号铺', floor: '1', unit: '', status: '已出租' },
  { name: '万象汇1F-05', type: '商铺', area: 42.0, waterFeeRate: 4.50, electricFeeRate: 0.95, propertyFeeRate: 8.00, address: '万象汇商业广场1楼05号铺', floor: '1', unit: '', status: '已出租' },
  { name: '万象汇2F-12', type: '商铺', area: 68.0, waterFeeRate: 4.50, electricFeeRate: 0.95, propertyFeeRate: 8.00, address: '万象汇商业广场2楼12号铺', floor: '2', unit: '', status: '已出租' },
  { name: '万象汇B1-03', type: '商铺', area: 35.0, waterFeeRate: 4.50, electricFeeRate: 0.95, propertyFeeRate: 8.00, address: '万象汇商业广场B1层03号铺', floor: 'B1', unit: '', status: '已出租' },
  // 高新区科创园 — 厂房
  { name: '科创园1号厂房A区', type: '厂房', area: 1200.0, waterFeeRate: 5.20, electricFeeRate: 1.15, propertyFeeRate: 1.80, address: '高新区科创园1号厂房A区', floor: '1', unit: '', status: '已出租' },
  { name: '科创园2号厂房', type: '厂房', area: 1500.0, waterFeeRate: 5.20, electricFeeRate: 1.15, propertyFeeRate: 1.80, address: '高新区科创园2号厂房', floor: '1', unit: '', status: '已出租' },
  { name: '科创园3号厂房', type: '厂房', area: 800.0, waterFeeRate: 5.20, electricFeeRate: 1.15, propertyFeeRate: 1.80, address: '高新区科创园3号厂房', floor: '1', unit: '', status: '已出租' },
  { name: '科创园5号厂房', type: '厂房', area: 2000.0, waterFeeRate: 5.20, electricFeeRate: 1.15, propertyFeeRate: 1.80, address: '高新区科创园5号厂房', floor: '1', unit: '', status: '已出租' },
  { name: '科创园6号厂房', type: '厂房', area: 1000.0, waterFeeRate: 5.20, electricFeeRate: 1.15, propertyFeeRate: 1.80, address: '高新区科创园6号厂房', floor: '1', unit: '', status: '已出租' },
  { name: '科创园8号厂房B区', type: '厂房', area: 1800.0, waterFeeRate: 5.20, electricFeeRate: 1.15, propertyFeeRate: 1.80, address: '高新区科创园8号厂房B区', floor: '1', unit: '', status: '已出租' },
];

// ==================== 租客数据 ====================
const TENANTS = [
  // 个人租客 (30人)
  { name: '张建国', idType: '身份证', idNumber: '320102196503121234', phone: '13905161201', contactPerson: '', creditScore: 85, creditGrade: 'A', status: '在租中' },
  { name: '李美玲', idType: '身份证', idNumber: '320103197208081345', phone: '13805161202', contactPerson: '', creditScore: 78, creditGrade: 'B', status: '在租中' },
  { name: '王建华', idType: '身份证', idNumber: '320104198203151456', phone: '13705161203', contactPerson: '', creditScore: 90, creditGrade: 'A', status: '在租中' },
  { name: '赵文博', idType: '身份证', idNumber: '320105199007201567', phone: '13605161204', contactPerson: '', creditScore: 72, creditGrade: 'B', status: '在租中' },
  { name: '孙丽华', idType: '身份证', idNumber: '320106198511081678', phone: '13505161205', contactPerson: '', creditScore: 95, creditGrade: 'A', status: '在租中' },
  { name: '周志强', idType: '身份证', idNumber: '320107197804121789', phone: '13405161206', contactPerson: '', creditScore: 65, creditGrade: 'C', status: '在租中' },
  { name: '吴秀英', idType: '身份证', idNumber: '320108199207051890', phone: '13305161207', contactPerson: '', creditScore: 82, creditGrade: 'A', status: '在租中' },
  { name: '郑明辉', idType: '身份证', idNumber: '320109198807221901', phone: '13205161208', contactPerson: '', creditScore: 70, creditGrade: 'B', status: '在租中' },
  { name: '冯玉兰', idType: '身份证', idNumber: '320110199503032012', phone: '13105161209', contactPerson: '', creditScore: 88, creditGrade: 'A', status: '在租中' },
  { name: '陈志远', idType: '身份证', idNumber: '320111198105182123', phone: '13005161210', contactPerson: '', creditScore: 60, creditGrade: 'C', status: '在租中' },
  { name: '蒋海燕', idType: '身份证', idNumber: '320112199308252234', phone: '18905161211', contactPerson: '', creditScore: 75, creditGrade: 'B', status: '在租中' },
  { name: '沈国栋', idType: '身份证', idNumber: '320113198612302345', phone: '18805161212', contactPerson: '', creditScore: 92, creditGrade: 'A', status: '在租中' },
  { name: '韩雪梅', idType: '身份证', idNumber: '320114199111142456', phone: '18705161213', contactPerson: '', creditScore: 80, creditGrade: 'A', status: '在租中' },
  { name: '杨晓峰', idType: '身份证', idNumber: '320115198909032567', phone: '18605161214', contactPerson: '', creditScore: 68, creditGrade: 'C', status: '在租中' },
  { name: '朱丽萍', idType: '身份证', idNumber: '320116199406072678', phone: '18505161215', contactPerson: '', creditScore: 87, creditGrade: 'A', status: '在租中' },
  { name: '秦志伟', idType: '身份证', idNumber: '320117198307282789', phone: '18405161216', contactPerson: '', creditScore: 55, creditGrade: 'D', status: '在租中' },
  { name: '尤文杰', idType: '身份证', idNumber: '320118199701052890', phone: '18305161217', contactPerson: '', creditScore: 73, creditGrade: 'B', status: '在租中' },
  { name: '许春梅', idType: '身份证', idNumber: '320119199210152901', phone: '18205161218', contactPerson: '', creditScore: 91, creditGrade: 'A', status: '在租中' },
  { name: '何家明', idType: '身份证', idNumber: '320120198506203012', phone: '18105161219', contactPerson: '', creditScore: 77, creditGrade: 'B', status: '在租中' },
  { name: '吕秀芳', idType: '身份证', idNumber: '320121199612283123', phone: '18005161220', contactPerson: '', creditScore: 84, creditGrade: 'A', status: '在租中' },
  { name: '施伟强', idType: '身份证', idNumber: '320122198811083234', phone: '17705161221', contactPerson: '', creditScore: 62, creditGrade: 'C', status: '在租中' },
  { name: '张琳琳', idType: '身份证', idNumber: '320123199409153345', phone: '17605161222', contactPerson: '', creditScore: 79, creditGrade: 'B', status: '在租中' },
  { name: '孔德明', idType: '身份证', idNumber: '320124198703223456', phone: '17505161223', contactPerson: '', creditScore: 93, creditGrade: 'A', status: '在租中' },
  { name: '曹晓红', idType: '身份证', idNumber: '320125199504083567', phone: '17405161224', contactPerson: '', creditScore: 71, creditGrade: 'B', status: '在租中' },
  { name: '严志刚', idType: '身份证', idNumber: '320126198201193678', phone: '17305161225', contactPerson: '', creditScore: 86, creditGrade: 'A', status: '在租中' },
  { name: '华美琴', idType: '身份证', idNumber: '320127199706253789', phone: '17205161226', contactPerson: '', creditScore: 67, creditGrade: 'C', status: '在租中' },
  { name: '金永康', idType: '身份证', idNumber: '320128198910303890', phone: '17105161227', contactPerson: '', creditScore: 81, creditGrade: 'A', status: '在租中' },
  { name: '魏晓燕', idType: '身份证', idNumber: '320129199211113901', phone: '16905161228', contactPerson: '', creditScore: 74, creditGrade: 'B', status: '在租中' },
  { name: '陶志杰', idType: '身份证', idNumber: '320130198412203012', phone: '16805161229', contactPerson: '', creditScore: 58, creditGrade: 'D', status: '在租中' },
  { name: '姜秀云', idType: '身份证', idNumber: '320131199606053123', phone: '16705161230', contactPerson: '', creditScore: 89, creditGrade: 'A', status: '在租中' },
  // 企业租客 (20家)
  { name: '创新科技有限公司', idType: '营业执照', idNumber: '91320100100001', phone: '025-88001001', contactPerson: '王建国', creditScore: 95, creditGrade: 'A', status: '在租中' },
  { name: '瑞丰商贸有限公司', idType: '营业执照', idNumber: '91320100100002', phone: '025-88001002', contactPerson: '李志强', creditScore: 88, creditGrade: 'A', status: '在租中' },
  { name: '星辰信息技术公司', idType: '营业执照', idNumber: '91320100100003', phone: '025-88001003', contactPerson: '赵明辉', creditScore: 82, creditGrade: 'A', status: '在租中' },
  { name: '恒达建筑工程公司', idType: '营业执照', idNumber: '91320100100004', phone: '025-88001004', contactPerson: '陈伟强', creditScore: 75, creditGrade: 'B', status: '在租中' },
  { name: '嘉和餐饮管理有限公司', idType: '营业执照', idNumber: '91320100100005', phone: '025-88001005', contactPerson: '林志远', creditScore: 90, creditGrade: 'A', status: '在租中' },
  { name: '鼎盛文化传媒公司', idType: '营业执照', idNumber: '91320100100006', phone: '025-88001006', contactPerson: '孙国庆', creditScore: 78, creditGrade: 'B', status: '在租中' },
  { name: '天华教育培训中心', idType: '营业执照', idNumber: '91320100100007', phone: '025-88001007', contactPerson: '周美玲', creditScore: 85, creditGrade: 'A', status: '在租中' },
  { name: '宏达电子科技有限公司', idType: '营业执照', idNumber: '91320100100008', phone: '025-88001008', contactPerson: '吴永强', creditScore: 70, creditGrade: 'B', status: '在租中' },
  { name: '金盛物流运输公司', idType: '营业执照', idNumber: '91320100100009', phone: '025-88001009', contactPerson: '郑文博', creditScore: 65, creditGrade: 'C', status: '在租中' },
  { name: '博雅广告设计公司', idType: '营业执照', idNumber: '91320100100010', phone: '025-88001010', contactPerson: '冯建华', creditScore: 80, creditGrade: 'A', status: '在租中' },
  { name: '华联超市连锁公司', idType: '营业执照', idNumber: '91320100100011', phone: '025-88001011', contactPerson: '陈丽华', creditScore: 72, creditGrade: 'B', status: '在租中' },
  { name: '鑫源金融投资公司', idType: '营业执照', idNumber: '91320100100012', phone: '025-88001012', contactPerson: '蒋志明', creditScore: 92, creditGrade: 'A', status: '在租中' },
  { name: '新视野旅游服务公司', idType: '营业执照', idNumber: '91320100100013', phone: '025-88001013', contactPerson: '沈海燕', creditScore: 76, creditGrade: 'B', status: '在租中' },
  { name: '长江机械制造公司', idType: '营业执照', idNumber: '91320100100014', phone: '025-88001014', contactPerson: '韩建国', creditScore: 83, creditGrade: 'A', status: '在租中' },
  { name: '绿地环保科技公司', idType: '营业执照', idNumber: '91320100100015', phone: '025-88001015', contactPerson: '杨志伟', creditScore: 68, creditGrade: 'C', status: '在租中' },
  { name: '万通物业管理公司', idType: '营业执照', idNumber: '91320100100016', phone: '025-88001016', contactPerson: '朱文杰', creditScore: 87, creditGrade: 'A', status: '在租中' },
  { name: '阳光健身服务公司', idType: '营业执照', idNumber: '91320100100017', phone: '025-88001017', contactPerson: '秦晓峰', creditScore: 71, creditGrade: 'B', status: '在租中' },
  { name: '三和食品加工公司', idType: '营业执照', idNumber: '91320100100018', phone: '025-88001018', contactPerson: '尤永康', creditScore: 79, creditGrade: 'B', status: '在租中' },
  { name: '康乐医疗器械公司', idType: '营业执照', idNumber: '91320100100019', phone: '025-88001019', contactPerson: '许春梅', creditScore: 94, creditGrade: 'A', status: '在租中' },
  { name: '锦绣纺织服装公司', idType: '营业执照', idNumber: '91320100100020', phone: '025-88001020', contactPerson: '何家明', creditScore: 66, creditGrade: 'C', status: '在租中' },
  // 厂房企业租客 (10家)
  { name: '长江机械制造有限公司', idType: '营业执照', idNumber: '91320100100021', phone: '025-88001021', contactPerson: '韩建国', creditScore: 83, creditGrade: 'A', status: '在租中' },
  { name: '精密模具加工厂', idType: '营业执照', idNumber: '91320100100022', phone: '025-88001022', contactPerson: '刘志强', creditScore: 70, creditGrade: 'B', status: '在租中' },
  { name: '华东汽车零部件公司', idType: '营业执照', idNumber: '91320100100023', phone: '025-88001023', contactPerson: '马永康', creditScore: 88, creditGrade: 'A', status: '在租中' },
  { name: '新力新材料科技公司', idType: '营业执照', idNumber: '91320100100024', phone: '025-88001024', contactPerson: '苏志远', creditScore: 76, creditGrade: 'B', status: '在租中' },
  { name: '恒通仓储物流有限公司', idType: '营业执照', idNumber: '91320100100025', phone: '025-88001025', contactPerson: '潘伟强', creditScore: 65, creditGrade: 'C', status: '在租中' },
  { name: '金鼎家具制造公司', idType: '营业执照', idNumber: '91320100100026', phone: '025-88001026', contactPerson: '范丽华', creditScore: 72, creditGrade: 'B', status: '在租中' },
  { name: '瑞丰食品包装有限公司', idType: '营业执照', idNumber: '91320100100027', phone: '025-88001027', contactPerson: '方志刚', creditScore: 80, creditGrade: 'A', status: '在租中' },
  { name: '天工钢结构工程公司', idType: '营业执照', idNumber: '91320100100028', phone: '025-88001028', contactPerson: '袁晓峰', creditScore: 68, creditGrade: 'C', status: '在租中' },
  { name: '远东电子装配有限公司', idType: '营业执照', idNumber: '91320100100029', phone: '025-88001029', contactPerson: '宋秀英', creditScore: 85, creditGrade: 'A', status: '在租中' },
  { name: '明达塑料制品有限公司', idType: '营业执照', idNumber: '91320100100030', phone: '025-88001030', contactPerson: '唐文博', creditScore: 62, creditGrade: 'C', status: '在租中' },
];

// ==================== 辅助函数 ====================
function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randFloat(min: number, max: number, decimals: number = 2): number {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

function randChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function buildContractNo(prefix: string, n: number): string {
  return `HT-${prefix}-${String(n).padStart(3, '0')}`;
}

// ==================== 主流程 ====================
async function main() {
  console.log('========================================');
  console.log('  模拟经营数据生成');
  console.log('========================================\n');

  // 连接数据库
  await sequelize.authenticate();
  console.log('[DB] Connected');

  // 获取账套和科目
  const book = await AccountBook.findOne({ where: { isActive: true } });
  if (!book) throw new Error('没有活跃账套，请先启动应用初始化种子数据');
  console.log(`[Book] ${(book as any).name}`);

  const accounts = await ChartOfAccount.findAll({ where: { bookId: book.id } });
  const incomeAcct = accounts.find(a => (a as any).code === '6001');  // 租金收入
  const bankAcct = accounts.find(a => (a as any).code === '1002');    // 银行存款
  if (!incomeAcct || !bankAcct) throw new Error('缺少必要会计科目');
  console.log(`[Account] ${accounts.length} 个科目\n`);

  const now = dayjs();
  const today = now.format('YYYY-MM-DD');

  // ---- 1. 创建房源 ----
  console.log('--- 创建房源 ---');
  const properties: any[] = [];
  for (const p of PROPERTIES) {
    const existing = await Property.findOne({ where: { name: p.name } });
    if (existing) {
      properties.push(existing);
      console.log(`  [SKIP] ${p.name}`);
    } else {
      const prop = await Property.create(p as any);
      properties.push(prop);
      console.log(`  [OK] ${p.name} (${p.type} ${p.area}m2)`);
    }
  }
  console.log(`  房源: ${properties.length} 处\n`);

  // ---- 2. 创建租客 ----
  console.log('--- 创建租客 ---');
  const tenants: any[] = [];
  for (const t of TENANTS) {
    const existing = await Tenant.findOne({ where: { name: t.name } });
    if (existing) {
      tenants.push(existing);
      console.log(`  [SKIP] ${t.name}`);
    } else {
      const tenant = await Tenant.create(t as any);
      tenants.push(tenant);
      console.log(`  [OK] ${t.name} (${t.idType})`);
    }
  }
  console.log(`  租客: ${tenants.length} 名\n`);

  // ---- 3. 配对合同 ----
  console.log('--- 创建合同 ---');
  const contracts: any[] = [];

  // 公寓租客 → 公寓房源
  const apartmentProps = properties.filter(p => (p as any).type === '公寓');
  const shopProps = properties.filter(p => (p as any).type === '商铺');
  // No factory properties in our list - add some factory tenants to shop/apartment

  // Assign tenants to properties
  const contractDefs: { tenantIdx: number; propIdx: number; rent: number; deposit: number; cycle: string; startDate: string; endDate: string; billingMode: string; billingConfig: any }[] = [];

  // 公寓租约 (前30个个人租客分配到8个公寓)
  for (let i = 0; i < 30; i++) {
    const prop = apartmentProps[i % apartmentProps.length];
    const area = (prop as any).area;
    const rentBase = area * 30; // 30元/平/月
    const rent = Math.round(rentBase / 50) * 50; // 取整到50
    const startMonth = rand(1, 36); // 1-36个月前开始
    const contractLength = rand(12, 36); // 1-3年合同
    const startDate = now.subtract(startMonth, 'month').startOf('month').format('YYYY-MM-DD');
    const endDate = dayjs(startDate).add(contractLength, 'month').subtract(1, 'day').format('YYYY-MM-DD');

    contractDefs.push({
      tenantIdx: i,
      propIdx: properties.indexOf(prop),
      rent,
      deposit: rent * 2,
      cycle: '月',
      startDate,
      endDate,
      billingMode: '固定',
      billingConfig: {
        waterFee: parseFloat((area * 0.5).toFixed(2)),
        electricFee: parseFloat((area * 1.2).toFixed(2)),
        propertyFee: parseFloat((area * 2.5).toFixed(2)),
        factoryArea: 0,
      },
    });
  }

  // 商铺租约 (后20个企业租客分配到4个商铺)
  for (let i = 0; i < 20; i++) {
    const prop = shopProps[i % shopProps.length];
    const area = (prop as any).area;
    const rentBase = area * rand(120, 250); // 商铺租金更高
    const rent = Math.round(rentBase / 100) * 100;
    const startMonth = rand(1, 36);
    const contractLength = rand(12, 36);
    const startDate = now.subtract(startMonth, 'month').startOf('month').format('YYYY-MM-DD');
    const endDate = dayjs(startDate).add(contractLength, 'month').subtract(1, 'day').format('YYYY-MM-DD');

    contractDefs.push({
      tenantIdx: 30 + i, // 企业租客从索引30开始
      propIdx: properties.indexOf(prop),
      rent,
      deposit: rent * 3,
      cycle: '月',
      startDate,
      endDate,
      billingMode: '固定',
      billingConfig: {
        waterFee: parseFloat((area * 0.8).toFixed(2)),
        electricFee: parseFloat((area * 2.0).toFixed(2)),
        propertyFee: parseFloat((area * 8.0).toFixed(2)),
        factoryArea: 0,
      },
    });
  }

  // 厂房租约 (新增10家企业租客分配到6个厂房)
  const factoryProps = properties.filter(p => (p as any).type === '厂房');
  const factoryTenantStartIdx = 50; // 厂房租客从索引50开始
  for (let i = 0; i < 10; i++) {
    const prop = factoryProps[i % factoryProps.length];
    const area = (prop as any).area;
    const leasedArea = area * randFloat(0.5, 1.0, 0); // 厂房可按部分面积出租
    const rentPerSqm = rand(15, 25); // 厂房15-25元/㎡/月
    const rent = Math.round(leasedArea * rentPerSqm / 100) * 100;
    const startMonth = rand(2, 36);
    const contractLength = rand(12, 48); // 厂房合同一般1-4年
    const startDate = now.subtract(startMonth, 'month').startOf('month').format('YYYY-MM-DD');
    const endDate = dayjs(startDate).add(contractLength, 'month').subtract(1, 'day').format('YYYY-MM-DD');

    contractDefs.push({
      tenantIdx: factoryTenantStartIdx + i,
      propIdx: properties.indexOf(prop),
      rent,
      deposit: rent * 2,
      cycle: '月',
      startDate,
      endDate,
      billingMode: '阶梯',
      billingConfig: {
        waterFee: parseFloat((leasedArea * 0.3).toFixed(2)),
        electricFee: parseFloat((leasedArea * 1.5).toFixed(2)),
        propertyFee: parseFloat((leasedArea * 1.8).toFixed(2)),
        factoryArea: parseFloat(leasedArea.toFixed(2)),
      },
    });
  }

  let contractIdx = 0;
  for (const def of contractDefs) {
    contractIdx++;
    const tenant = tenants[def.tenantIdx];
    const prop = properties[def.propIdx];
    const isExpired = def.endDate < today;
    const status = isExpired ? '已到期' : '执行中';

    const existing = await Contract.findOne({ where: { contractNo: buildContractNo(prop.type, contractIdx) } });
    if (existing) {
      contracts.push(existing);
      continue;
    }

    const contract = await Contract.create({
      contractNo: buildContractNo(prop.type, contractIdx),
      propertyId: prop.id,
      tenantId: tenant.id,
      rentAmount: def.rent,
      depositAmount: def.deposit,
      paymentCycle: def.cycle,
      billingMode: def.billingMode,
      billingConfig: def.billingConfig,
      startDate: def.startDate,
      endDate: def.endDate,
      status,
      createdBy: 1,
      signedAt: def.startDate, // 已签署
    } as any);
    contracts.push(contract);
  }
  console.log(`  合同: ${contracts.length} 份 (${contracts.filter(c => (c as any).status === '执行中').length} 执行中, ${contracts.filter(c => (c as any).status !== '执行中').length} 已到期)\n`);

  // ---- 4. 生成账单 ----
  console.log('--- 生成账单 (近3年) ---');
  let totalBills = 0;
  const allBills: any[] = [];

  for (const contract of contracts) {
    const c = contract as any;
    const startMonth = dayjs(c.startDate).startOf('month');
    const endMonth = now.startOf('month');
    const bc = c.billingConfig || {};

    let currentMonth = startMonth;
    while (currentMonth.isBefore(endMonth) || currentMonth.isSame(endMonth)) {
      const period = currentMonth.format('YYYY-MM');
      const dueDate = currentMonth.format('YYYY-MM-01');

      const existing = await Bill.findOne({ where: { contractId: c.id, period } });
      if (existing) { currentMonth = currentMonth.add(1, 'month'); continue; }

      const rentAmount = Number(c.rentAmount);
      const waterFee = Number(bc.waterFee || 0);
      const electricFee = Number(bc.electricFee || 0);
      const propertyFee = Number(bc.propertyFee || 0);
      const totalAmount = parseFloat((rentAmount + waterFee + electricFee + propertyFee).toFixed(2));

      const bill = await Bill.create({
        contractId: c.id,
        billNo: `BL-${c.contractNo}-${period}`,
        period,
        rentAmount,
        waterFee,
        electricFee,
        utilityAmount: waterFee + electricFee,
        propertyFee,
        otherAmount: 0,
        lateFee: 0,
        totalAmount,
        dueDate,
        status: '未缴',
      } as any);
      allBills.push(bill);
      totalBills++;
      currentMonth = currentMonth.add(1, 'month');
    }
  }
  console.log(`  账单: ${totalBills} 条\n`);

  // ---- 5. 生成收款记录 (模拟缴费) ----
  console.log('--- 生成收款记录 ---');
  let totalPayments = 0;
  let totalPaidBills = 0;
  const paidBillIds: Set<number> = new Set();
  const channels = ['银行转账', '微信', '支付宝', '现金', 'POS'];

  for (const bill of allBills) {
    const b = bill as any;
    const billDate = dayjs(b.dueDate);
    if (billDate.isAfter(now)) continue; // 未来账单不处理

    // 历史账单 85% 已缴，逾期账单只有 50% 已缴
    const isOverdue = billDate.isBefore(now.subtract(1, 'month'));
    const payProb = isOverdue ? 0.50 : 0.85;

    if (Math.random() < payProb) {
      const channel = randChoice(channels);
      const paidAt = billDate.add(rand(0, 10), 'day').format('YYYY-MM-DD');

      await PaymentRecord.create({
        billId: b.id,
        amount: Number(b.totalAmount),
        channel,
        transactionNo: `TXN${Date.now()}-${rand(1000, 9999)}`,
        paidAt,
      } as any);

      // Randomize exact status
      let newStatus: string;
      if (Math.random() < 0.95) {
        newStatus = '已缴';
      } else {
        newStatus = '部分缴';
      }

      await b.update({ status: newStatus, paidDate: paidAt, paymentChannel: channel } as any);
      paidBillIds.add(b.id);
      totalPayments++;
      totalPaidBills++;
    }
  }

  // Mark overdue bills
  for (const bill of allBills) {
    const b = bill as any;
    if (!paidBillIds.has(b.id) && dayjs(b.dueDate).isBefore(now)) {
      await b.update({ status: '逾期' } as any);
    }
  }

  const overdueCount = allBills.filter((b: any) => b.status === '逾期').length;
  console.log(`  收款记录: ${totalPayments} 条`);
  console.log(`  已缴账单: ${totalPaidBills} 条`);
  console.log(`  逾期账单: ${overdueCount} 条\n`);

  // ---- 6. 生成催缴任务 ----
  console.log('--- 生成催缴任务 ---');
  let totalDunning = 0;
  for (const bill of allBills) {
    const b = bill as any;
    if (b.status !== '逾期') continue;

    const overdueDays = now.diff(dayjs(b.dueDate), 'day');
    let level: number;
    if (overdueDays <= 15) level = 1;
    else if (overdueDays <= 30) level = 2;
    else if (overdueDays <= 60) level = 3;
    else level = 4;

    const existing = await DunningTask.findOne({ where: { billId: b.id } });
    if (!existing) {
      const channels = ['站内信', '短信', '微信', '电话'];
      const titles = ['租金催缴通知', '逾期催缴提醒', '严重逾期警告', '最终催缴通知'];
      await DunningTask.create({
        billId: b.id,
        level,
        channel: channels[Math.min(level - 1, 3)],
        title: titles[Math.min(level - 1, 3)],
        content: `您的账单${b.billNo}已逾期${overdueDays}天，应缴金额${Number(b.totalAmount).toFixed(2)}元，请尽快缴费。`,
        status: '已发送',
        sentAt: dayjs(b.dueDate).add(level * 15, 'day').format('YYYY-MM-DD'),
        response: '',
      } as any);
      totalDunning++;
    }
  }
  console.log(`  催缴任务: ${totalDunning} 条\n`);

  // ---- 7. 生成凭证 (仅对已缴账单) ----
  console.log('--- 生成凭证 ---');
  let totalVouchers = 0;
  const processedMonths = new Set<string>();

  for (const bill of allBills) {
    const b = bill as any;
    if (b.status !== '已缴' && b.status !== '部分缴') continue;

    const period = b.period;
    const monthKey = `${b.contractId}-${period}`;
    if (processedMonths.has(monthKey)) continue;
    processedMonths.add(monthKey);

    const vNo = `SK-BL-${b.billNo}`;
    const existing = await Voucher.findOne({ where: { voucherNo: vNo } });
    if (existing) continue;

    const voucher = await Voucher.create({
      bookId: book.id,
      voucherNo: vNo,
      date: b.paidDate || b.dueDate,
      period: period.replace('-', ''),
      type: '收',
      summary: `收租-${b.billNo}`,
      status: '已过账',
      createdBy: 1,
    } as any);

    const amount = Number(b.totalAmount);
    await VoucherEntry.create({
      voucherId: voucher.id,
      accountId: bankAcct.id,
      direction: '借',
      amount,
      summary: `收到租金-${b.billNo}`,
    } as any);
    await VoucherEntry.create({
      voucherId: voucher.id,
      accountId: incomeAcct.id,
      direction: '贷',
      amount,
      summary: `租金收入-${b.billNo}`,
    } as any);

    totalVouchers++;
  }
  console.log(`  凭证: ${totalVouchers} 条\n`);

  // ---- 8. 统计汇总 ----
  console.log('========================================');
  console.log('  数据生成完成！');
  console.log('========================================');
  console.log(`  房源:     ${properties.length} 处`);
  console.log(`  租客:     ${tenants.length} 名`);
  console.log(`  合同:     ${contracts.length} 份`);
  console.log(`  账单:     ${totalBills} 条`);
  console.log(`  收款:     ${totalPayments} 条`);
  console.log(`  逾期:     ${overdueCount} 条`);
  console.log(`  催缴:     ${totalDunning} 条`);
  console.log(`  凭证:     ${totalVouchers} 条`);
  console.log('========================================');

  process.exit(0);
}

main().catch(err => {
  console.error('生成失败:', err.message);
  console.error(err.stack);
  process.exit(1);
});
