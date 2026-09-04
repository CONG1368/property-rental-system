import { Router } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { auditLog } from '../middleware/audit-log.js';
import { syncNow, getOverview, getPlatformConfig } from '../services/meter-platform.js';
import SmartMeterDevice from '../models/SmartMeterDevice.js';
import SmartMeterTenant from '../models/SmartMeterTenant.js';
import SmartMeterRecharge from '../models/SmartMeterRecharge.js';
import MeterPlatformLink from '../models/MeterPlatformLink.js';
import Meter from '../models/Meter.js';
import { Op } from 'sequelize';
import dayjs from 'dayjs';

const router = Router();

// 触发一次会话内同步（token 由桌面版同机会话捕获，随请求传入）
router.post('/sync', auditLog('智能水电表', '同步'), async (req: AuthRequest, res) => {
  try {
    const token = (req.body as any)?.token || '';
    if (!token) return res.status(400).json({ code: 400, message: '缺少 token（请先在桌面版登录平台取得会话 token）' });
    const result = await syncNow(token);
    if (result.tokenInvalid) return res.status(401).json({ code: 401, message: result.error || '平台会话已失效，请重新登录' });
    if (!result.ok) return res.status(400).json({ code: 400, message: result.error || '同步失败' });
    res.json({ code: 200, data: result.counts, message: result.message });
  } catch (e: any) { res.status(500).json({ code: 500, message: e.message }); }
});

// 手动关联：平台设备 → 系统仪表
router.post('/link', auditLog('智能水电表', '关联设备'), async (req: AuthRequest, res) => {
  try {
    const { platformDeviceId, meterId } = req.body || {};
    if (!platformDeviceId || !meterId) return res.status(400).json({ code: 400, message: '缺少 platformDeviceId / meterId' });
    const meter = await Meter.findByPk(meterId);
    if (!meter) return res.status(404).json({ code: 404, message: '仪表不存在' });
    const link = await MeterPlatformLink.findOne({ where: { platformDeviceId } });
    if (link) await link.update({ meterId, linkStatus: 'linked', mappedBy: (req as any).userId || null, syncedAt: new Date() } as any);
    else await MeterPlatformLink.create({ platformDeviceId, meterNo: (meter as any).meterNo, meterId, linkStatus: 'linked', mappedBy: (req as any).userId || null, syncedAt: new Date() } as any);
    res.json({ code: 200, message: '已关联' });
  } catch (e: any) { res.status(500).json({ code: 500, message: e.message }); }
});

// 概览 KPI
router.get('/overview', async (_req: AuthRequest, res) => {
  try { res.json({ code: 200, data: await getOverview() }); }
  catch (e: any) { res.status(500).json({ code: 500, message: e.message }); }
});

// 设备台账
router.get('/devices', async (req: AuthRequest, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1); const pageSize = Math.min(200, Number(req.query.pageSize) || 20);
    const where: any = {};
    const kw = (req.query.keyword as string) || '';
    if (kw) where[Op.or] = [{ meterNo: { [Op.like]: '%' + kw + '%' } }, { name: { [Op.like]: '%' + kw + '%' } }];
    const { count, rows } = await SmartMeterDevice.findAndCountAll({ where, order: [['createdAt', 'DESC']], limit: pageSize, offset: (page - 1) * pageSize });
    res.json({ code: 200, data: { total: count, list: rows, page, pageSize } });
  } catch (e: any) { res.status(500).json({ code: 500, message: e.message }); }
});

// 租币/租户
router.get('/tenants', async (req: AuthRequest, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1); const pageSize = Math.min(200, Number(req.query.pageSize) || 20);
    const { count, rows } = await SmartMeterTenant.findAndCountAll({ order: [['balance', 'DESC']], limit: pageSize, offset: (page - 1) * pageSize });
    res.json({ code: 200, data: { total: count, list: rows, page, pageSize } });
  } catch (e: any) { res.status(500).json({ code: 500, message: e.message }); }
});

// 充值记录
router.get('/recharges', async (req: AuthRequest, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1); const pageSize = Math.min(200, Number(req.query.pageSize) || 20);
    const { count, rows } = await SmartMeterRecharge.findAndCountAll({ order: [['rechargeTime', 'DESC']], limit: pageSize, offset: (page - 1) * pageSize });
    res.json({ code: 200, data: { total: count, list: rows, page, pageSize } });
  } catch (e: any) { res.status(500).json({ code: 500, message: e.message }); }
});

// 统计（图表）：近 N 天充值趋势 + 设备类型分布
router.get('/statistics', async (_req: AuthRequest, res) => {
  try {
    const recharges = await SmartMeterRecharge.findAll({ raw: true });
    const devices = await SmartMeterDevice.findAll({ raw: true });
    const tenants = await SmartMeterTenant.findAll({ raw: true });
    const days: Record<string, number> = {};
    const byType: Record<string, number> = {};
    let today = 0;
    const todayStr = dayjs().format('YYYY-MM-DD');
    for (const r of recharges) {
      const d = String((r as any).rechargeTime || '').slice(0, 10);
      if (d) days[d] = (days[d] || 0) + Number((r as any).amount || 0);
      if (String((r as any).rechargeTime || '').slice(0, 10) === todayStr) today += Number((r as any).amount || 0);
    }
    for (const dv of devices) { const t = (dv as any).meterType || '电'; byType[t] = (byType[t] || 0) + 1; }
    const rechargeTrend = Object.entries(days).sort((a, b) => a[0].localeCompare(b[0])).slice(-30).map(([d, v]) => ({ date: d, amount: v }));
    const topBalance = tenants.slice().sort((a: any, b: any) => (b.balance || 0) - (a.balance || 0)).slice(0, 10).map((t: any) => ({ name: t.name, balance: t.balance }));
    res.json({ code: 200, data: { todayRecharge: today, rechargeTrend, deviceByType: byType, topBalance } });
  } catch (e: any) { res.status(500).json({ code: 500, message: e.message }); }
});

// 待关联列表
router.get('/pending', async (_req: AuthRequest, res) => {
  try {
    const rows = await MeterPlatformLink.findAll({ where: { linkStatus: 'pending' }, raw: true });
    const meterNos = rows.map((r: any) => r.meterNo);
    res.json({ code: 200, data: rows });
  } catch (e: any) { res.status(500).json({ code: 500, message: e.message }); }
});

// 同步状态（上次同步时间 / token 有效性提示由前端据 token expiration 判断）
router.get('/status', async (_req: AuthRequest, res) => {
  try {
    const last = await MeterPlatformLink.findOne({ order: [['syncedAt', 'DESC']] });
    const cfg = await getPlatformConfig();
    res.json({ code: 200, data: { lastSyncAt: (last as any)?.syncedAt || null, intervalMin: cfg.interval, endpointsConfigured: !!cfg.endpoints } });
  } catch (e: any) { res.status(500).json({ code: 500, message: e.message }); }
});

export default router;
