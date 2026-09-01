import { Op } from 'sequelize';
import WorkOrder from '../models/WorkOrder.js';
import Facility from '../models/Facility.js';
import Contract from '../models/Contract.js';
import Meter from '../models/Meter.js';
import MeterReading from '../models/MeterReading.js';
import Bill from '../models/Bill.js';
import { sendNotification } from './notification.js';
import dayjs from 'dayjs';

// 工单 SLA（天）：待派单超过该天数则升级
const WO_SLA_DAYS = 2;

export interface AutomationResult {
  escalatedOrders: number;
  expiringFacilities: number;
  expiringContracts: number;
  anomalies: number;
  createdNotifications: number;
}

async function notify(title: string, content: string): Promise<void> {
  await sendNotification({ recipientId: 0, recipientType: 'user', channel: '站内信', title, content });
}

// 工单 SLA 超时升级
async function escalateOverdueOrders(): Promise<number> {
  const cutoff = dayjs().subtract(WO_SLA_DAYS, 'day').toDate();
  const overdue = await WorkOrder.findAll({
    where: { status: { [Op.in]: ['待派单', '已派单', '处理中'] }, createdAt: { [Op.lte]: cutoff } },
  });
  let n = 0;
  for (const wo of overdue) {
    if ((wo as any).priority !== '紧急') {
      await (wo as any).update({ priority: '高' });
      await notify(`工单 ${wo.ticketNo} 已超时`, `工单「${wo.title}」超过 ${WO_SLA_DAYS} 天未处理，已自动升级优先级。`);
      n++;
    }
  }
  return n;
}

// 设备即将到期提醒（nextMaintainDate 7 天内）
async function expiringFacilities(): Promise<number> {
  const now = dayjs();
  const soon = now.add(7, 'day').toDate();
  const list = await Facility.findAll({
    where: { nextMaintainDate: { [Op.between]: [now.startOf('day').toDate(), soon] }, status: { [Op.ne]: '停用' } },
  });
  let n = 0;
  for (const f of list) {
    await notify(`设备保养提醒：${f.name}`, `设备「${f.name}」下次维护日期 ${f.nextMaintainDate} 将近，请及时安排维保。`);
    n++;
  }
  return n;
}

// 合同到期提醒（30 天内）
async function expiringContracts(): Promise<number> {
  const soon = dayjs().add(30, 'day').toDate();
  const list = await Contract.findAll({ where: { status: '执行中', endDate: { [Op.between]: [dayjs().startOf('day').toDate(), soon] } } });
  let n = 0;
  for (const c of list) {
    await notify(`合同到期提醒：${c.contractNo}`, `合同 ${c.contractNo} 将于 ${c.endDate} 到期，请确认续约或退租安排。`);
    n++;
  }
  return n;
}

// 异常检测：能耗异常 + 收缴率下滑
async function detectAnomalies(): Promise<{ type: string; title: string; content: string }[]> {
  const anomalies: { type: string; title: string; content: string }[] = [];
  // 能耗异常：最近读数超历史均值 3 倍
  const meters = await Meter.findAll({ include: [{ model: MeterReading, as: 'readings', separate: true }] });
  for (const m of meters as any[]) {
    const readings = m.readings || [];
    if (readings.length < 3) continue;
    readings.sort((a: any, b: any) => a.period.localeCompare(b.period));
    const last = readings[readings.length - 1];
    const prev = readings.slice(0, -1);
    const avg = prev.reduce((s: number, r: any) => s + Number(r.usage || 0), 0) / prev.length;
    if (avg > 0 && Number(last.usage || 0) > avg * 3) {
      anomalies.push({ type: '能耗', title: `能耗异常：${m.name || m.meterNo}`, content: `${m.name || ''}最近用量 ${last.usage}${m.unit}，超过历史均值 ${avg.toFixed(1)} 的 3 倍，请核查。` });
    }
  }
  // 收缴率下滑：本月较上月下降 >10pp
  const rateOf = async (period: string) => {
    const bills = await Bill.findAll({ where: { period }, attributes: ['status', 'totalAmount'], raw: true });
    const t = bills.reduce((s: number, b: any) => s + Number(b.totalAmount || 0), 0);
    const p = bills.filter((b: any) => b.status === '已缴').reduce((s: number, b: any) => s + Number(b.totalAmount || 0), 0);
    return t > 0 ? (p / t) * 100 : null;
  };
  const cur = dayjs().format('YYYY-MM'); const prev = dayjs().subtract(1, 'month').format('YYYY-MM');
  const curRate = await rateOf(cur); const prevRate = await rateOf(prev);
  if (curRate !== null && prevRate !== null && prevRate - curRate > 10) {
    anomalies.push({ type: '收缴', title: '收缴率下滑预警', content: `本月收缴率 ${curRate.toFixed(1)}%，较上月 ${prevRate.toFixed(1)}% 下降 ${(prevRate - curRate).toFixed(1)} 个百分点，请关注欠费。` });
  }
  return anomalies;
}

// 执行全部物业自动化
export async function runPropertyAutomation(): Promise<AutomationResult> {
  const escalatedOrders = await escalateOverdueOrders();
  const expiringFacilityCount = await expiringFacilities();
  const expiringContractCount = await expiringContracts();
  const anomalyList = await detectAnomalies();
  for (const a of anomalyList) { await notify(a.title, a.content); }
  const createdNotifications = escalatedOrders + expiringFacilityCount + expiringContractCount + anomalyList.length;
  return { escalatedOrders, expiringFacilities: expiringFacilityCount, expiringContracts: expiringContractCount, anomalies: anomalyList.length, createdNotifications };
}
