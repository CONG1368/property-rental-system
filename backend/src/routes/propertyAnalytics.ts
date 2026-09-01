import { Router } from 'express';
import { Op, fn, col } from 'sequelize';
import WorkOrder from '../models/WorkOrder.js';
import Facility from '../models/Facility.js';
import Complaint from '../models/Complaint.js';
import Bill from '../models/Bill.js';
import CommonRevenue from '../models/CommonRevenue.js';
import MeterReading from '../models/MeterReading.js';
import ParkingRecord from '../models/ParkingRecord.js';
import { AuthRequest } from '../middleware/auth.js';

const router = Router();

// 近 N 个月的 YYYY-MM 列表
function lastMonths(n: number): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = [];
  const d = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
    const key = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`;
    out.push({ key, label: key });
  }
  return out;
}

// GET /api/property-analytics/dashboard
router.get('/dashboard', async (req: AuthRequest, res) => {
  try {
    const months = lastMonths(6);
    const monthStart = months[0].key + '-01';
    const now = new Date();
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    // 趋势：近6个月 工单/投诉/账单
    const workOrderTrend = await Promise.all(months.map(async m => {
      const cnt = await WorkOrder.count({ where: { createdAt: { [Op.between]: [`${m.key}-01`, `${m.key}-31`] } } });
      return { month: m.key, count: cnt };
    }));
    const complaintTrend = await Promise.all(months.map(async m => {
      const cnt = await Complaint.count({ where: { createdAt: { [Op.between]: [`${m.key}-01`, `${m.key}-31`] } } });
      return { month: m.key, count: cnt };
    }));
    const collectedTrend = await Promise.all(months.map(async m => {
      const bills = await Bill.findAll({ where: { period: m.key }, attributes: ['status', 'totalAmount'], raw: true });
      const total = bills.reduce((s, b) => s + Number(b.totalAmount || 0), 0);
      const paid = bills.filter((b: any) => b.status === '已缴').reduce((s, b) => s + Number(b.totalAmount || 0), 0);
      return { month: m.key, total: Math.round(total * 100) / 100, paid: Math.round(paid * 100) / 100, rate: total > 0 ? Math.round(paid / total * 100) : 0 };
    }));

    // 结构占比
    const [workByType, facByStatus, compByType, revByType, meterBilled] = await Promise.all([
      WorkOrder.findAll({ attributes: ['type', [fn('COUNT', col('id')), 'count']], group: ['type'], raw: true }),
      Facility.findAll({ attributes: ['status', [fn('COUNT', col('id')), 'count']], group: ['status'], raw: true }),
      Complaint.findAll({ attributes: ['type', [fn('COUNT', col('id')), 'count']], group: ['type'], raw: true }),
      CommonRevenue.findAll({ attributes: ['type', [fn('SUM', col('amount')), 'sum']], group: ['type'], raw: true }),
      MeterReading.findAll({ where: { billed: '未生成' }, attributes: [[fn('SUM', col('amount')), 'sum']], raw: true }),
    ]);

    // 预测：近6个月平均工单×1.1 → 下月预测；当前月收缴率
    const workAvg = workOrderTrend.length ? (workOrderTrend.reduce((s, t) => s + t.count, 0) / workOrderTrend.length) : 0;
    const forecastNextWork = Math.round(workAvg * 1.1);
    const curRate = collectedTrend.length ? collectedTrend[collectedTrend.length - 1].rate : 0;

    const meterUnbilled = Number((meterBilled[0] as any)?.sum || 0);
    const parkingRevenue = await ParkingRecord.sum('amount');

    res.json({ code: 200, data: {
      trends: { workOrderTrend, complaintTrend, collectedTrend },
      structure: {
        workByType: workByType.map(r => ({ name: r.type, value: Number(r.count) })),
        facByStatus: facByStatus.map(r => ({ name: r.status, value: Number(r.count) })),
        compByType: compByType.map(r => ({ name: r.type, value: Number(r.count) })),
        revByType: revByType.map(r => ({ name: r.type, value: Number(r.sum || 0) })),
      },
      prediction: { forecastNextWork, curCollectionRate: curRate, workAvg: Math.round(workAvg * 10) / 10, meterUnbilled, parkingRevenue: Number(parkingRevenue || 0) },
    } });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

export default router;
