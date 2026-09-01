/**
 * WebSocket 实时广播回归（需先启动 dev）
 *   node scripts/verify-websocket.js
 *
 * 覆盖此前完全没有自动化验证的实时链路：房态变更 → 后端 broadcast → 客户端收到事件。
 * 房态看板/首页概览都依赖它做静默刷新，广播断了页面不会报错、只会「数据不动」，最难发现。
 *
 * 数据卫生：只对一个「空置」房源做 空置→已锁定→空置 的净零流转（两步都合法），用例结束状态回到原点。
 */
const WebSocket = require('../backend/node_modules/ws');

const API = 'http://localhost:3001/api';
const WS_URL = 'ws://localhost:3001/ws';
let token = '';
const results = [];
const check = (name, cond, extra) => {
  results.push({ name, ok: !!cond });
  console.log((cond ? 'PASS: ' : 'FAIL: ') + name + (extra ? '  => ' + extra : ''));
};

async function j(method, url, body) {
  const res = await fetch(API + url, {
    method,
    headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
    body: body ? JSON.stringify(body) : undefined,
  });
  const txt = await res.text();
  let data; try { data = JSON.parse(txt); } catch (e) { data = txt; }
  return { status: res.status, body: data };
}

/** 等待某个事件到达（超时返回 null） */
function waitEvent(received, event, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve) => {
    const timer = setInterval(() => {
      const hit = received.find((m) => m.event === event);
      if (hit) { clearInterval(timer); resolve(hit); }
      else if (Date.now() > deadline) { clearInterval(timer); resolve(null); }
    }, 100);
  });
}

(async () => {
  const login = await j('POST', '/auth/login', { username: 'admin', password: 'admin123' });
  token = login.body?.data?.accessToken || '';
  check('登录取得 token', !!token);
  if (!token) process.exit(2);

  // 建立 WS 连接
  const ws = new WebSocket(WS_URL);
  const received = [];
  const opened = await new Promise((resolve) => {
    const t = setTimeout(() => resolve(false), 8000);
    ws.on('open', () => { clearTimeout(t); resolve(true); });
    ws.on('error', () => { clearTimeout(t); resolve(false); });
  });
  check('WebSocket 连接建立（/ws 路径）', opened);
  if (!opened) { console.log('无法连接 WS，终止'); process.exit(1); }
  ws.on('message', (raw) => {
    try { received.push(JSON.parse(String(raw))); } catch (e) { /* 容错：非 JSON 忽略 */ }
  });

  // 找一个空置房源
  const list = await j('GET', '/properties?pageSize=200');
  const vacant = ((list.body.data || {}).list || []).find((p) => p.status === '空置');
  check('找到一个空置房源用于净零流转', !!vacant, vacant ? vacant.name : '无');
  if (!vacant) { ws.close(); process.exit(1); }

  // 1) 单个房态变更广播
  received.length = 0;
  const lock = await j('PATCH', '/properties/' + vacant.id + '/status', { status: '已锁定', notes: 'WS 回归用例' });
  check('房态变更接口返回成功', lock.body.code === 200, lock.body.message);

  const evt = await waitEvent(received, 'room:status-changed', 6000);
  check('收到 room:status-changed 广播', !!evt, evt ? 'delay ok' : '6s 内未收到');
  if (evt) {
    check('广播消息结构为 { event, data, timestamp }',
      'event' in evt && 'data' in evt && 'timestamp' in evt,
      Object.keys(evt).join(','));
    check('广播载荷含房源 id 与新旧状态',
      evt.data && Number(evt.data.propertyId) === Number(vacant.id) &&
      evt.data.oldStatus === '空置' && evt.data.newStatus === '已锁定',
      JSON.stringify(evt.data).slice(0, 110));
  }

  // 2) 批量房态变更广播（同时把状态改回空置，恢复净零）
  received.length = 0;
  const batch = await j('PATCH', '/properties/rooms/batch-status', {
    ids: [vacant.id], newStatus: '空置', notes: 'WS 回归用例还原',
  });
  check('批量房态接口返回成功', batch.body.code === 200, batch.body.message);
  const batchEvt = await waitEvent(received, 'room:batch-status-changed', 6000);
  check('收到 room:batch-status-changed 广播', !!batchEvt, batchEvt ? 'ok' : '6s 内未收到');

  // 3) 状态确实回到原点
  const after = await j('GET', '/properties/' + vacant.id);
  check('房源状态已还原为空置（净零）', (after.body.data || {}).status === '空置',
    'status=' + (after.body.data || {}).status);

  // 4) 断开后服务端不应崩溃：关闭连接再打一次接口
  ws.close();
  await new Promise((r) => setTimeout(r, 500));
  const health = await j('GET', '/health');
  check('客户端断开后服务端仍健康', health.body.code === 200 || health.body.data?.status === 'ok');

  const failed = results.filter((r) => !r.ok);
  console.log('');
  console.log('SUMMARY: ' + (results.length - failed.length) + '/' + results.length + ' passed');
  if (failed.length) { console.log('FAILED: ' + failed.map((f) => f.name).join(' | ')); process.exit(1); }
  process.exit(0);
})().catch((e) => { console.error('ERR:', e); process.exit(2); });
