// 首页概览运行时回归验证（P0 + P1 + P2）
// 需先启动 dev 后端：npm run dev:backend
const BASE = 'http://localhost:3001/api';
let token = '';
async function j(method, url, body) {
  const res = await fetch(BASE + url, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const txt = await res.text(); let data; try { data = JSON.parse(txt); } catch { data = txt; }
  return { status: res.status, body: data };
}
const results = [];
function check(name, cond, detail) { results.push({ name, ok: !!cond, detail }); console.log((cond ? 'PASS:' : 'FAIL:') + ' ' + name + (detail ? '  => ' + detail : '')); }
(async () => {
  const login = await j('POST', '/auth/login', { username: 'admin', password: 'admin123' });
  check('login', login.body?.code === 200, 'code=' + login.body?.code);
  token = login.body?.data?.accessToken;
  check('token', !!token, token ? 'len=' + token.length : 'none');

  // P0 overview（collectionRate 改为金额口径）
  const ov = await j('GET', '/dashboard/overview');
  const od = ov.body?.data || {};
  check('overview.occupiedProperties', typeof od.occupiedProperties === 'number', '=' + od.occupiedProperties);
  check('overview.totalContracts', typeof od.totalContracts === 'number', '=' + od.totalContracts);
  check('overview.occupancyRate', typeof od.occupancyRate === 'number', '=' + od.occupancyRate);
  check('overview.version=1.0.3', od.version === '1.0.3', '=' + od.version);
  // collectionRate 金额口径 = monthlyCollected/monthlyDue*100
  const expectCr = od.monthlyDue > 0 ? parseFloat((od.monthlyCollected / od.monthlyDue * 100).toFixed(1)) : 0;
  check('overview.collectionRate(金额口径)', od.collectionRate === expectCr, 'rate=' + od.collectionRate + ' expect=' + expectCr + ' col=' + od.monthlyCollected + ' due=' + od.monthlyDue);

  // P1 todo-summary
  const ts = await j('GET', '/dashboard/todo-summary');
  const td = ts.body?.data || {};
  check('todo-summary.list 数组', Array.isArray(td.list), 'len=' + (td.list?.length ?? 'N/A'));
  check('todo-summary.total', typeof td.total === 'number', '=' + td.total);
  const listKeys = ['key','type','module','title','count','severity','link'];
  check('todo-item 字段齐全', !td.list || td.list.every((x) => listKeys.every((k) => k in x)), 'first=' + JSON.stringify(td.list?.[0] || {}).slice(0,80));
  check('todo-list 已按严重度排序', !td.list || td.list.every((x,i,a) => i===0 || (['high','mid','low'].indexOf(a[i-1].severity) <= ['high','mid','low'].indexOf(x.severity))), 'order=' + (td.list||[]).map(x=>x.severity).join(','));

  // P2 模块接口
  const rs = await j('GET', '/properties/rooms/stats');
  const rd = rs.body?.data || {};
  check('rooms/stats.total', typeof rd.total === 'number', '=' + rd.total);
  check('rooms/stats.statusCounts(9键)', typeof rd.statusCounts === 'object' && Object.keys(rd.statusCounts).length === 9, 'keys=' + Object.keys(rd.statusCounts).join('/'));
  const pa = await j('GET', '/property-analytics/dashboard');
  check('prop-analytics.trends', !!pa.body?.data?.trends, 'has trends');
  const fs = await j('GET', '/fire-safety/dashboard');
  check('fire-safety/dashboard.totalEquipment', typeof fs.body?.data?.totalEquipment === 'number', '=' + fs.body?.data?.totalEquipment);
  check('fire 裸路径应404', (await j('GET','/fire-safety')).status === 404, 'status=' + (await j('GET','/fire-safety')).status);

  const fail = results.filter(r => !r.ok);
  console.log('');
  console.log('SUMMARY: ' + results.filter(r => r.ok).length + '/' + results.length + ' passed');
  if (fail.length > 0) { console.log('FAILED: ' + fail.map(f => f.name).join(', ')); process.exit(1); }
})().catch(e => { console.error('ERR:', e); process.exit(2); });
