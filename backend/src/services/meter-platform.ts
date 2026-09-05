import SystemConfig from '../models/SystemConfig.js';
import Meter from '../models/Meter.js';
import MeterReading from '../models/MeterReading.js';
import MeterPlatformLink from '../models/MeterPlatformLink.js';
import SmartMeterDevice from '../models/SmartMeterDevice.js';
import SmartMeterTenant from '../models/SmartMeterTenant.js';
import SmartMeterRecharge from '../models/SmartMeterRecharge.js';
import { encryptMeterBody, encryptMeterKey, decryptMeterData, genMeterAesKey } from './meter-platform-crypto.js';
import { Op } from 'sequelize';
import dayjs from 'dayjs';

/**
 * 智能水电表（bzp.iyunmu.com 预付费管理平台）会话内全量同步。
 *
 * 协议（已逆向实测，见 meter-platform-crypto.ts）：
 *  - 平台要求每个业务请求都带「加密封包」：x-enc-key(RSA:随机AES key) + x-enc-data(AES-ECB:body)。
 *  - 响应 enc_data 用与请求相同的 AES key 解密→zlib→JSON。
 *  - 无论 token 多新鲜，平台还要求会话 sessionid/csrftoken cookie（认证在 cookie），
 *    跨客户端/无 cookie 一律返回 code:400「系统更新,请清缓存」。
 *  - 因此 token+cookie 必须由桌面版从同机会话捕获，随每次同步请求传入；后端仅作只读拉取。
 */

const CFG = {
  url: 'meter_platform_url',
  username: 'meter_platform_username',
  interval: 'meter_platform_interval_min',
  endpoints: 'meter_platform_endpoints',
  pagination: 'meter_platform_pagination',
};

// 实测校准的默认端点（均已验证 200 + 可解密）
export const METER_ENDPOINTS_DEFAULT = {
  devices: '/web/device/',
  tenants: '/web/device/',           // 租币=各设备剩余(备用额度)；平台无独立租户列表，用设备表聚合
  recharges: '/web/report/',
  stats: '/web/electricity/',
  org: '/web/org/',
  groups: '/web/get_group_options/',
};

// 分页：平台返回 total 字段，page/pageSize 不封顶（实测 pageSize=1000 返回全部）
export const METER_PAGINATION_DEFAULT = {
  pageParam: 'page',
  sizeParam: 'pageSize',
  pageSize: 500,   // 500 一条能拿全部常见规模；平台有 total 兜底可再翻页
  maxPages: 20,
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
    { key: CFG.username, value: '18688001234', desc: '平台登录账号（token+cookie 由桌面版从同机会话获取）' },
    { key: CFG.interval, value: '10', desc: '会话窗口内补同步间隔（分钟，默认 10）' },
    { key: CFG.endpoints, value: JSON.stringify(METER_ENDPOINTS_DEFAULT), desc: '平台各业务接口路径（JSON：devices/tenants/recharges/stats/org/groups），已按实测校准' },
    { key: CFG.pagination, value: JSON.stringify(METER_PAGINATION_DEFAULT), desc: '平台分页参数（JSON：pageParam/sizeParam/pageSize/maxPages），已按实测校准' },
  ];
  for (const c of items) {
    const row = await SystemConfig.findOne({ where: { configKey: c.key } });
    if (!row) await SystemConfig.create({ configKey: c.key, configValue: c.value, description: c.desc, configGroup: '外部系统', valueType: (c.key === CFG.endpoints || c.key === CFG.pagination) ? 'json' : 'string', isSensitive: false, builtIn: true } as any);
  }
}

export async function getPlatformConfig() {
  const base = await getCfg(CFG.url, 'https://bzp.iyunmu.com/prepaidBack');
  const interval = Number(await getCfg(CFG.interval, '10')) || 10;
  let endpoints: any = null;
  try { endpoints = JSON.parse(await getCfg(CFG.endpoints, '')) || null; } catch { endpoints = null; }
  let pagination: any = null;
  try { pagination = JSON.parse(await getCfg(CFG.pagination, '')) || null; } catch { pagination = null; }
  return { base, interval, endpoints, pagination };
}

/**
 * 平台加密请求：生成随机 AES key，加密 body，RSA 加密 key，带 cookie/token 发请求；
 * 返回数据统一走「data」（已解密的原始数据），并识别 token/cookie 失效。
 */
export async function platformRequest(path: string, opts: { token: string; cookie?: string; method?: string; params?: Record<string, any>; body?: any }): Promise<{ ok: boolean; data?: any; raw?: any; tokenInvalid?: boolean; error?: string; endpoint?: string }> {
  const { base } = await getPlatformConfig();
  const method = opts.method || 'GET';
  let url = base + path;
  if (method === 'GET' && opts.params) {
    // 保留空串参数（平台某些端点把缺参视为 None 报错，必须显式传空），仅过滤 null/undefined
    const qs = Object.entries(opts.params).filter(([, v]) => v !== null && v !== undefined)
      .map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(String(v))).join('&');
    if (qs) url += (url.includes('?') ? '&' : '?') + qs;
  }
  const aesKey = genMeterAesKey();
  const encData = encryptMeterBody(opts.body ?? {}, aesKey);
  const encKey = encryptMeterKey(aesKey);
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json;charset=utf-8',
        'Authorization': 'Bearer ' + opts.token,
        'x-enc-key': encKey,
        'x-enc-data': encData,
        'Origin': 'https://bzp.iyunmu.com',
        'Referer': 'https://bzp.iyunmu.com/devManager/index',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
        'Accept': 'application/json',
        ...(opts.cookie ? { 'Cookie': opts.cookie } : {}),
      } as any,
      body: (method === 'POST' || method === 'PUT') ? JSON.stringify(opts.body ?? {}) : undefined,
    });
  } catch (e) {
    return { ok: false, error: '平台请求失败：' + (e as Error).message, endpoint: path };
  }
  let json: any = null;
  try { json = await res.json(); } catch { json = null; }
  let data: any = json;
  if (json && json.enc_data) {
    try { data = decryptMeterData(json.enc_data, aesKey); }
    catch (e) { return { ok: false, error: '平台响应解密失败：' + (e as Error).message, endpoint: path }; }
  }
  const code = data?.code ?? res.status;
  const msg = data?.msg || data?.message || '';
  if (code === 400 || code === 401 || code === 449 || res.status === 401) {
    if (/系统更新|浏览器缓存|未登录|Token已过期|重新登录/i.test(msg) || code !== 200) {
      return { ok: false, tokenInvalid: true, error: '平台会话已失效或需重新登录' + (msg ? '（' + msg + '）' : ''), endpoint: path };
    }
  }
  if (json && code !== 200) {
    return { ok: false, error: '平台返回 ' + code + '：' + msg, endpoint: path };
  }
  return { ok: true, data, raw: json, endpoint: path };
}

// 取数组通用
function toRows(data: any): any[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (typeof data === 'object') {
    for (const k of ['data', 'list', 'records', 'rows', 'items', 'content']) {
      if (Array.isArray(data[k])) return data[k];
    }
  }
  return [];
}

function pick(arr: any, keys: string[], def: any): any {
  for (const k of keys) { if (arr && arr[k] !== undefined && arr[k] !== null) return arr[k]; }
  return def;
}

// 全量分页拉取
async function fetchAllPages(path: string, token: string, cookie: string, pageCfg: any, extraParams: Record<string, any>): Promise<{ ok: boolean; rows: any[]; tokenInvalid?: boolean; error?: string; total?: number; pages?: number }> {
  const pageParam = (pageCfg?.pageParam as string) || 'page';
  const sizeParam = (pageCfg?.sizeParam as string) || 'pageSize';
  const pageSize = Number(pageCfg?.pageSize) || 500;
  const maxPages = Number(pageCfg?.maxPages) || 20;
  const all: any[] = [];
  const seen = new Set<string>();
  let total: number | undefined;
  let pages = 0;
  for (let p = 1; p <= maxPages; p++) {
    const r = await platformRequest(path, { token, cookie, params: { ...extraParams, [pageParam]: p, [sizeParam]: pageSize } });
    if (r.tokenInvalid) return { ok: false, rows: all, tokenInvalid: true, error: r.error };
    if (!r.ok) return { ok: false, rows: all, error: r.error };
    const d = r.data;
    const rows = toRows(d && d.data ? d.data : d);
    if (typeof (d?.total) === 'number') total = d.total;
    else if (typeof (d?.data?.total) === 'number') total = d.data.total;
    for (const row of rows) {
      const sig = JSON.stringify(row);
      if (seen.has(sig)) continue;
      seen.add(sig); all.push(row);
    }
    pages++;
    if (!rows.length) break;
    if (typeof total === 'number' && total > 0 && all.length >= total) break;
    if (rows.length < pageSize) break;
  }
  return { ok: true, rows: all, total, pages };
}

export async function syncNow(token: string, cookie?: string): Promise<{ ok: boolean; counts?: Record<string, number>; tokenInvalid?: boolean; error?: string; message?: string }> {
  const cfg = await getPlatformConfig();
  if (!cfg.endpoints) return { ok: false, error: '未配置 meter_platform_endpoints' };
  if (!token) return { ok: false, error: '缺少 token' };
  const counts: Record<string, number> = { devices: 0, tenants: 0, recharges: 0, linked: 0, pending: 0, readings: 0 };
  const pageCfg = cfg.pagination || METER_PAGINATION_DEFAULT;

  // 1) 设备表（全量；product=电表/水表 合并去重）
  if (cfg.endpoints.devices) {
    const seenDev = new Set<string>();
    const allDev: any[] = [];
    for (const product of ['电表', '水表']) {
      const pr = await fetchAllPages(cfg.endpoints.devices, token, cookie || '', pageCfg, { dev_type: '', switchState: '', keyword: '', product });
      if (pr.tokenInvalid) return { ok: false, tokenInvalid: true, error: pr.error };
      if (pr.ok) { for (const row of pr.rows) { const s = JSON.stringify(row); if (!seenDev.has(s)) { seenDev.add(s); allDev.push(row); } } }
      else if (pr.error) console.log('[SmartMeter] devices err:', pr.error);
    }
    for (const row of allDev) {
      const platformId = String(pick(row, ['id', 'sn'], ''));
      const meterNo = String(pick(row, ['sn', 'id'], ''));
      if (!platformId && !meterNo) continue;
      const existing = await SmartMeterDevice.findOne({ where: { [Op.or]: [{ platformId }, { meterNo }] } });
      const product = String(pick(row, ['product', 'dev_type', 'type'], '电'));
      const switchState = pick(row, ['switchState'], '');
      const onlineStatus = pick(row, ['onlineStatus'], '');
      const status = (switchState === false) ? '拉闸' : (onlineStatus === false ? '离线' : '合闸');
      const payload = {
        platformId: platformId || meterNo,
        meterNo,
        name: String(pick(row, ['name', 'installAddr', 'address'], '')),
        area: String(pick(row, ['orgTree', 'group', 'area'], '')),
        meterType: ((/水|water/i.test(product)) ? '水' : '电') as any,
        currentReading: Number(pick(row, ['spareElec', 'wallet', 'remaining', 'balance'], 0)) || 0,
        totalUsage: Number(pick(row, ['totalElec', 'total', 'used', 'usage'], 0)) || 0,
        status,
        lastSyncAt: new Date(),
      } as any;
      if (existing) await existing.update(payload as any);
      else await SmartMeterDevice.create(payload as any);
      counts.devices++;
    }
  }

  // 2) 租币/租户：平台无独立租户列表，用设备表的「安装位置 name」聚合各位置租币存量
  if (cfg.endpoints.tenants) {
    const devices = await SmartMeterDevice.findAll({ raw: true });
    const byKey: Record<string, any> = {};
    for (const d of devices) {
      const nm = ((d as any).name || '未命名').trim();
      const pid = 'tenant-' + Buffer.from(nm).toString('base64url').slice(0, 56);
      const cur = byKey[nm] || { platformId: pid, name: nm, phone: '', balance: 0, deviceCount: 0, status: '在用', lastSyncAt: new Date() };
      cur.balance += Number((d as any).currentReading || 0); cur.deviceCount++;
      byKey[nm] = cur;
    }
    for (const t of Object.values(byKey) as any[]) {
      const existing = await SmartMeterTenant.findOne({ where: { [Op.or]: [{ platformId: t.platformId }, { name: t.name }] } });
      if (existing) await existing.update(t as any); else await SmartMeterTenant.create(t as any);
      counts.tenants++;
    }
  }

  // 3) 充值记录（平台报表每次查询区间上限 31 天：按 31 天窗口从今天往回分段拉取，窗口交叠防漏）
  if (cfg.endpoints.recharges) {
    const seenOrder = new Set<string>();
    const dayCap = 31;
    let windowEnd = dayjs();
    const floor = dayjs().startOf('year'); // 当前先取当年（平台最多支持近一年的报表）
    let guard = 0;
    while (windowEnd.isAfter(floor) && guard < 40) {
      const ws = windowEnd.subtract(dayCap - 1, 'day');
      const winStart = ws.isBefore(floor) ? floor : ws;
      const pr = await fetchAllPages(cfg.endpoints.recharges, token, cookie || '', pageCfg, { 'timeRange[0]': winStart.format('YYYY-MM-DD'), 'timeRange[1]': windowEnd.format('YYYY-MM-DD'), keyword: '', group: '' });
      if (pr.tokenInvalid) return { ok: false, tokenInvalid: true, error: pr.error };
      if (pr.ok) {
        for (const row of pr.rows) {
          const orderNo = String(pick(row, ['payId', 'orderNo', 'orderNum', 'id'], ''));
          if (!orderNo || seenOrder.has(orderNo)) continue;
          seenOrder.add(orderNo);
          const existing = await SmartMeterRecharge.findOne({ where: { orderNo } });
          const payload = {
            orderNo,
            tenantName: String(pick(row, ['name', 'userName', 'nickName'], '')),
            tenantPhone: String(pick(row, ['phone', 'telephone'], '')),
            amount: Number(pick(row, ['actual_amount', 'amount', 'money'], 0)) || 0,
            channel: String(pick(row, ['payType', 'channel', 'method'], '')),
            rechargeTime: String(pick(row, ['payTime', 'rechargeTime', 'createTime'], '')),
            status: String(pick(row, ['paymentStatus', 'status', 'state'], '')),
            lastSyncAt: new Date(),
          } as any;
          if (existing) await existing.update(payload as any); else await SmartMeterRecharge.create(payload as any);
          counts.recharges++;
        }
      } else if (pr.error) console.log('[SmartMeter] recharges err:', pr.error);
      // 交叠 1 天推进，防止 31 天边界漏单
      windowEnd = windowEnd.subtract(dayCap - 2, 'day');
      guard++;
    }
  }

  // 4) 回填本地仪表（表号匹配）
  counts.linked = await linkToLocalMeters();
  counts.pending = await SmartMeterDevice.count({ where: { lastSyncAt: { [Op.gte]: new Date(Date.now() - 3600000) } } });
  counts.readings = counts.linked;

  return { ok: true, counts, message: '同步完成' };
}

// 把平台设备按 meterNo 关联到本地 Meter，并回填 Meter + MeterReading（当前期间，幂等）
export async function linkToLocalMeters(): Promise<number> {
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
      await meter.update({ lastReading: newReading, lastReadingDate: new Date() } as any);
      const existing = await MeterReading.findOne({ where: { meterId: meter.id, period } });
      const usage = Math.max(0, round2(newReading - prevReading));
      const amount = round2(usage * Number(meter.pricePerUnit || 0));
      if (existing) await existing.update({ currentReading: newReading, usage, amount, readDate: new Date() } as any);
      else await MeterReading.create({ meterId: meter.id, propertyId: (meter as any).propertyId, tenantId: (meter as any).tenantId, type: (meter as any).type, period, previousReading: prevReading, currentReading: newReading, usage, pricePerUnit: Number(meter.pricePerUnit || 0), amount, reader: '平台同步', readDate: new Date(), billed: '未生成' } as any);
      linked++;
    } else {
      if (link) await link.update({ linkStatus: 'pending', syncedAt: new Date() } as any);
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
    SmartMeterDevice.count({ where: { status: { [Op.notIn]: ['离线', '故障', 'offline', '拉闸'] } } }),
  ]);
  const balanceRow: any = await SmartMeterTenant.sum('balance');
  return {
    devices, tenants, rechargesToday,
    totalBalance: Number(balanceRow || 0),
    onlineRate: devices ? Math.round((online / devices) * 1000) / 10 : 0,
  };
}

function round2(n: number): number { return Math.round(n * 100) / 100; }
