import SystemConfig from '../models/SystemConfig.js';
import Meter from '../models/Meter.js';
import MeterReading from '../models/MeterReading.js';
import MeterPlatformLink from '../models/MeterPlatformLink.js';
import SmartMeterDevice from '../models/SmartMeterDevice.js';
import SmartMeterTenant from '../models/SmartMeterTenant.js';
import SmartMeterRecharge from '../models/SmartMeterRecharge.js';
import { Op } from 'sequelize';
import dayjs from 'dayjs';

/**
 * 智能水电表（bzp.iyunmu.com 预付费管理平台）会话内同步。
 *
 * 注意：平台登录带图片验证码且 token 30 分钟有效、绑定会话，因此：
 *  - token 由桌面版 webRequest 从同机会话捕获，随每次同步请求传入（不落库）。
 *  - 同步由同机后端进程执行，仅做只读拉取，不写回平台。
 *  - 各业务接口路径在平台前端按需加载的 chunk 里，做成可配置（meter_platform_endpoints），
 *    首次可在桌面版观察到的 /prepaidBack/* 请求里映射确认后再填。
 */

const CFG = {
  url: 'meter_platform_url',
  username: 'meter_platform_username',
  interval: 'meter_platform_interval_min',
  endpoints: 'meter_platform_endpoints',
};

export const METER_ENDPOINTS_DEFAULT = {
  devices: '/web/deviceManager/list',   // 需按实测校准（平台前端 chunk 内的真实接口）
  tenants: '/web/userSearch/',
  recharges: '/web/payOrder/list',
  stats: '/web/reportTable/pay',
};

async function getCfg(key: string, def: string): Promise<string> {
  try {
    const row = await SystemConfig.findOne({ where: { configKey: key } });
    return ((row as any)?.configValue) || def;
  } catch { return def; }
}

export async function ensureMeterPlatformConfig(): Promise<void> {
  const items: { key: string; value: string; desc: string }[] = [
    { key: CFG.url, value: 'https://bzp.iyunmu.com/prepaidBack', desc: '智能水电表平台 API 基址' },
    { key: CFG.username, value: '18688001234', desc: '平台登录账号（token 由桌面版从同机会话获取）' },
    { key: CFG.interval, value: '10', desc: '会话窗口内补同步间隔（分钟，默认 10）' },
    { key: CFG.endpoints, value: JSON.stringify(METER_ENDPOINTS_DEFAULT), desc: '平台各业务接口路径（JSON：devices/tenants/recharges/stats），需按实测校准' },
  ];
  for (const c of items) {
    const row = await SystemConfig.findOne({ where: { configKey: c.key } });
    if (!row) await SystemConfig.create({ configKey: c.key, configValue: c.value, description: c.desc, configGroup: '外部系统', valueType: c.key === CFG.endpoints ? 'json' : 'string', isSensitive: false, builtIn: true } as any);
  }
}

export async function getPlatformConfig() {
  const base = await getCfg(CFG.url, METER_ENDPOINTS_DEFAULT && 'https://bzp.iyunmu.com/prepaidBack');
  const interval = Number(await getCfg(CFG.interval, '10')) || 10;
  let endpoints: any = null;
  try { endpoints = JSON.parse(await getCfg(CFG.endpoints, '')) || null; } catch { endpoints = null; }
  return { base, interval, endpoints };
}

// 平台请求：带 Bearer token + 同源头；识别 token 失效
export async function platformRequest(path: string, opts: { token: string; method?: string; params?: Record<string, any>; body?: any }): Promise<{ ok: boolean; data?: any; tokenInvalid?: boolean; error?: string; endpoint?: string }> {
  const { base } = await getPlatformConfig();
  const method = opts.method || 'GET';
  let url = base + path;
  if (method === 'GET' && opts.params) {
    const qs = Object.entries(opts.params).filter(([, v]) => v !== null && v !== undefined)
      .map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(String(v))).join('&');
    if (qs) url += (url.includes('?') ? '&' : '?') + qs;
  }
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json;charset=utf-8',
        'Authorization': 'Bearer ' + opts.token,
        'Origin': 'https://bzp.iyunmu.com',
        'Referer': 'https://bzp.iyunmu.com/index',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
        'Accept': 'application/json',
      } as any,
      body: method === 'POST' || method === 'PUT' ? JSON.stringify(opts.body ?? {}) : undefined,
    });
  } catch (e) {
    return { ok: false, error: '平台请求失败：' + (e as Error).message, endpoint: path };
  }
  let json: any = null;
  try { json = await res.json(); } catch { json = null; }
  const code = json?.code ?? res.status;
  const msg = json?.msg || json?.message || '';
  if (code === 400 && /系统更新|浏览器缓存/.test(msg)) {
    return { ok: false, tokenInvalid: true, error: '平台拒绝复用 token（会话已失效或需重新登录）', endpoint: path };
  }
  if (code === 401 || code === 449 || res.status === 401) {
    return { ok: false, tokenInvalid: true, error: 'token 无权限或已过期', endpoint: path };
  }
  if (json && code !== 200 && json.code !== 200) {
    return { ok: false, error: '平台返回 ' + code + '：' + msg, endpoint: path };
  }
  return { ok: true, data: json?.data ?? json, endpoint: path };
}

// 取数组通用：兼容 data 直接为数组、data.list、data.records、data.items
function toRows(data: any): any[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (typeof data === 'object') {
    for (const k of ['list', 'records', 'rows', 'items', 'content', 'data']) {
      if (Array.isArray(data[k])) return data[k];
    }
  }
  return [];
}

function pick(arr: any, keys: string[], def: any): any {
  for (const k of keys) { if (arr && arr[k] !== undefined && arr[k] !== null) return arr[k]; }
  return def;
}

// 同步平台数据到 SmartMeter* 表，并回填关联的本地仪表
export async function syncNow(token: string): Promise<{ ok: boolean; counts?: Record<string, number>; tokenInvalid?: boolean; error?: string; message?: string }> {
  const cfg = await getPlatformConfig();
  if (!cfg.endpoints) {
    return { ok: false, error: '未配置 meter_platform_endpoints（请在系统参数-外部系统 填写各业务接口路径 JSON）' };
  }
  if (!token) return { ok: false, error: '缺少 token' };
  const counts: Record<string, number> = { devices: 0, tenants: 0, recharges: 0, linked: 0, pending: 0, readings: 0 };

  // 1) 设备表
  if (cfg.endpoints.devices) {
    const r = await platformRequest(cfg.endpoints.devices, { token });
    if (r.tokenInvalid) return { ok: false, tokenInvalid: true, error: r.error };
    if (r.ok) {
      for (const row of toRows(r.data)) {
        const platformId = String(pick(row, ['id', 'deviceId', 'deviceNo', 'platformId'], ''));
        const meterNo = String(pick(row, ['meterNo', 'meterNumber', 'number', 'deviceCode'], platformId));
        if (!platformId && !meterNo) continue;
        const existing = await SmartMeterDevice.findOne({ where: { [Op.or]: [{ platformId }, { meterNo }] } });
        const payload = {
          platformId: platformId || meterNo,
          meterNo,
          name: String(pick(row, ['name', 'deviceName', 'address'], '')),
          area: String(pick(row, ['area', 'region', 'projectName', 'community'], '')),
          meterType: (/水|water/i.test(String(pick(row, ['type', 'meterType', 'kind'], '电'))) ? '水' : '电') as any,
          currentReading: Number(pick(row, ['currentReading', 'reading', 'meterReading', 'amount'], 0)) || 0,
          totalUsage: Number(pick(row, ['totalUsage', 'total', 'used', 'usage'], 0)) || 0,
          status: String(pick(row, ['status', 'state', 'onlineStatus'], '')),
          lastSyncAt: new Date(),
        };
        if (existing) await existing.update(payload as any);
        else await SmartMeterDevice.create(payload as any);
        counts.devices++;
      }
    } else if (r.error) console.log('[SmartMeter] devices err:', r.error);
  }

  // 2) 租币/租户
  if (cfg.endpoints.tenants) {
    const r = await platformRequest(cfg.endpoints.tenants, { token });
    if (r.tokenInvalid) return { ok: false, tokenInvalid: true, error: r.error };
    if (r.ok) {
      for (const row of toRows(r.data)) {
        const platformId = String(pick(row, ['id', 'userId', 'tenantId'], ''));
        const phone = String(pick(row, ['telephone', 'phone', 'mobile'], ''));
        if (!platformId && !phone) continue;
        const existing = await SmartMeterTenant.findOne({ where: { [Op.or]: [{ platformId }, { phone }] } });
        const payload = {
          platformId: platformId || phone,
          name: String(pick(row, ['name', 'userName', 'tenantName'], '')),
          phone,
          balance: Number(pick(row, ['balance', 'money', 'amount'], 0)) || 0,
          deviceCount: Number(pick(row, ['deviceCount', 'meterCount', 'count'], 0)) || 0,
          status: String(pick(row, ['status', 'state'], '')),
          lastSyncAt: new Date(),
        };
        if (existing) await existing.update(payload as any);
        else await SmartMeterTenant.create(payload as any);
        counts.tenants++;
      }
    } else if (r.error) console.log('[SmartMeter] tenants err:', r.error);
  }

  // 3) 充值记录
  if (cfg.endpoints.recharges) {
    const r = await platformRequest(cfg.endpoints.recharges, { token });
    if (r.tokenInvalid) return { ok: false, tokenInvalid: true, error: r.error };
    if (r.ok) {
      for (const row of toRows(r.data)) {
        const orderNo = String(pick(row, ['orderNo', 'orderNum', 'payOrderNo', 'id'], ''));
        if (!orderNo) continue;
        const existing = await SmartMeterRecharge.findOne({ where: { orderNo } });
        const payload = {
          orderNo,
          tenantName: String(pick(row, ['tenantName', 'userName', 'name'], '')),
          tenantPhone: String(pick(row, ['tenantPhone', 'telephone', 'phone'], '')),
          amount: Number(pick(row, ['amount', 'money', 'rechargeAmount'], 0)) || 0,
          channel: String(pick(row, ['channel', 'payType', 'method'], '')),
          rechargeTime: String(pick(row, ['rechargeTime', 'payTime', 'createTime', 'time'], '')),
          status: String(pick(row, ['status', 'state'], '')),
          lastSyncAt: new Date(),
        };
        if (existing) await existing.update(payload as any);
        else await SmartMeterRecharge.create(payload as any);
        counts.recharges++;
      }
    } else if (r.error) console.log('[SmartMeter] recharges err:', r.error);
  }

  // 4) 回填本地仪表（表号匹配）
  counts.linked = await linkToLocalMeters(token);
  counts.pending = await SmartMeterDevice.count({ where: { lastSyncAt: { [Op.gte]: new Date(Date.now() - 3600000) } } });
  counts.readings = counts.linked;

  return { ok: true, counts, message: '同步完成' };
}

// 把平台设备按 meterNo 关联到本地 Meter，并回填 Meter + MeterReading（当前期间，幂等）
export async function linkToLocalMeters(token: string): Promise<number> {
  const devices = await SmartMeterDevice.findAll({ raw: true });
  let linked = 0;
  const period = dayjs().format('YYYY-MM');
  for (const d of devices) {
    const meterNo = (d as any).meterNo;
    if (!meterNo) continue;
    const meter = await Meter.findOne({ where: { meterNo } });
    const link = await MeterPlatformLink.findOne({ where: { platformDeviceId: (d as any).platformId } });
    if (meter) {
      const newReading = Number((d as any).currentReading) || 0;
      const prevReading = typeof meter.lastReading === 'number' ? meter.lastReading : Number(meter.lastReading || 0);
      if (link) await link.update({ meterId: meter.id, linkStatus: 'linked', platformReading: newReading, syncedAt: new Date(), mappedBy: null } as any);
      else await MeterPlatformLink.create({ platformDeviceId: (d as any).platformId, meterNo, meterId: meter.id, linkStatus: 'linked', platformReading: newReading, syncedAt: new Date() } as any);
      // 更新仪表最新读数
      await meter.update({ lastReading: newReading, lastReadingDate: new Date() } as any);
      // 写入/更新该期间抄表记录（幂等：按 meterId+period）
      const existing = await MeterReading.findOne({ where: { meterId: meter.id, period } });
      const usage = Math.max(0, round2(newReading - prevReading));
      const amount = round2(usage * Number(meter.pricePerUnit || 0));
      if (existing) await existing.update({ currentReading: newReading, usage, amount, readDate: new Date() } as any);
      else await MeterReading.create({ meterId: meter.id, propertyId: (meter as any).propertyId, tenantId: (meter as any).tenantId, type: (meter as any).type, period, previousReading: prevReading, currentReading: newReading, usage, pricePerUnit: Number(meter.pricePerUnit || 0), amount, reader: '平台同步', readDate: new Date(), billed: '未生成' } as any);
      linked++;
    } else {
      if (link) await link.update({ linkStatus: 'pending', syncedAt: new Date() } as any);
      // 不存在的仪表：不自动创建（缺 propertyId/tenantId），保留待关联
    }
  }
  return linked;
}

// 统计概览
export async function getOverview() {
  const [devices, tenants, rechargesToday, online] = await Promise.all([
    SmartMeterDevice.count(),
    SmartMeterTenant.count(),
    SmartMeterRecharge.count({ where: { rechargeTime: { [Op.like]: dayjs().format('YYYY-MM') + '%' } } }),
    SmartMeterDevice.count({ where: { status: { [Op.notIn]: ['离线', '故障', 'offline'] } } }),
  ]);
  const balanceRow: any = await SmartMeterTenant.sum('balance');
  return {
    devices, tenants, rechargesToday,
    totalBalance: Number(balanceRow || 0),
    onlineRate: devices ? Math.round((online / devices) * 1000) / 10 : 0,
  };
}

function round2(n: number): number { return Math.round(n * 100) / 100; }

