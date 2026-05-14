import '../models/index.js';
import Bill from '../models/Bill.js';
import DunningTask from '../models/DunningTask.js';
import Voucher from '../models/Voucher.js';
import VoucherEntry from '../models/VoucherEntry.js';
import AccountBook from '../models/AccountBook.js';
import ChartOfAccount from '../models/ChartOfAccount.js';
import dayjs from 'dayjs';

async function main() {
  const now = dayjs();
  const book = await AccountBook.findOne({ where: { isActive: true } });
  if (!book) throw new Error('无账套');
  const accts = await ChartOfAccount.findAll({ where: { bookId: book.id } });
  const income = accts.find(a => (a as any).code === '6001');
  const bank = accts.find(a => (a as any).code === '1002');
  if (!income || !bank) throw new Error('缺科目');

  const channels = ['站内信', '短信', '微信', '电话'];
  const titles = ['租金催缴通知', '逾期催缴提醒', '严重逾期警告', '最终催缴通知'];

  // 催缴任务
  const overdueBills = await Bill.findAll({ where: { status: '逾期' }, raw: true }) as any[];
  console.log('逾期账单:', overdueBills.length);
  let dc = 0;
  for (const b of overdueBills) {
    const exist = await DunningTask.findOne({ where: { billId: b.id } });
    if (exist) continue;
    const overdueDays = now.diff(dayjs(b.dueDate), 'day');
    const level = overdueDays <= 15 ? 1 : overdueDays <= 30 ? 2 : overdueDays <= 60 ? 3 : 4;
    await DunningTask.create({
      billId: b.id, level,
      channel: channels[Math.min(level - 1, 3)],
      title: titles[Math.min(level - 1, 3)],
      content: b.billNo + '已逾期' + overdueDays + '天,应缴' + Number(b.totalAmount).toFixed(2) + '元',
      status: '已发送',
      sentAt: dayjs(b.dueDate).add(level * 15, 'day').format('YYYY-MM-DD'),
      response: '',
    } as any);
    dc++;
    if (dc % 50 === 0) console.log('  催缴进度:', dc);
  }
  console.log('催缴任务:', dc);

  // 凭证
  const paidBills = await Bill.findAll({ where: { status: ['已缴', '部分缴'] }, raw: true }) as any[];
  console.log('已缴账单:', paidBills.length);
  let vc = 0;
  const seen = new Set<string>();
  for (const b of paidBills) {
    const key = b.contractId + '-' + b.period;
    if (seen.has(key)) continue;
    seen.add(key);
    const vNo = 'SK-BL-' + b.billNo;
    const exist = await Voucher.findOne({ where: { voucherNo: vNo } });
    if (exist) continue;
    const v = await Voucher.create({
      bookId: book.id, voucherNo: vNo,
      date: b.paidDate || b.dueDate,
      period: (b.period as string).replace('-', ''),
      type: '收', summary: '收租-' + b.billNo,
      status: '已过账', createdBy: 1,
    } as any);
    const amt = Number(b.totalAmount);
    await VoucherEntry.create({ voucherId: v.id, accountId: bank.id, direction: '借', amount: amt, summary: '收-' + b.billNo } as any);
    await VoucherEntry.create({ voucherId: v.id, accountId: income.id, direction: '贷', amount: amt, summary: '收-' + b.billNo } as any);
    vc++;
    if (vc % 30 === 0) console.log('  凭证进度:', vc);
  }
  console.log('凭证:', vc);
  console.log('DONE');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
