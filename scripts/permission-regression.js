const base = 'http://localhost:3001/api';
async function login(username, password) {
  const r = await fetch(base + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
  const j = await r.json(); return j.data?.accessToken;
}
async function call(method, path, token, body) {
  const r = await fetch(base + path, { method, headers: token ? { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token } : { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  return r.status;
}
const ROLES = [
  ['admin', 'admin123'], ['收租员', '123456'], ['收租主管', '123456'], ['会计', '123456'],
  ['财务主管', '123456'], ['出纳', '123456'], ['维修工', '123456'], ['总经理', '123456'], ['合同主管', '123456'],
];
const USER_MAP = { '收租员': 't_rent', '收租主管': 't_renthead', '会计': 't_acct', '财务主管': 't_fin', '出纳': 't_csh', '维修工': 't_worker', '总经理': 't_gm', '合同主管': 't_ct' };
function bodyFor(method, path, cnt, password) {
  const confirm = (extra = {}) => ({ ...extra, confirmPassword: password });
  if (method === 'POST' && path === '/tenants') return { name: '权限测试', phone: '1380000111' + (cnt % 10), idType: '身份证', idNumber: '32010219900101' + String(1000 + cnt), gender: '男' };
  if (method === 'POST' && path === '/work-orders') return { title: '权限测试工单' + cnt, type: '报修' };
  if (method === 'POST' && path === '/invoices') return { title: '权限测试发票', buyerName: '测试', amount: 100 };
  if (method === 'POST' && path === '/fixed-assets') return { name: '权限测试资产', category: '设备', originalValue: 100, accumulatedDepreciation: 0, status: '使用中', purchaseDate: '2024-01-01', bookId: 1, usefulMonths: 12, startDate: '2024-01-01' };
  if (method === 'POST' && path === '/tax/calculate') return confirm({ period: '2024-01' });
  if (method === 'POST' && (path.endsWith('/void') || path.endsWith('/redflush') || path.endsWith('/issue'))) return confirm({});
  if (method === 'DELETE' && path.includes('/fixed-assets/')) return confirm({});
  if (method === 'POST' && path.endsWith('/depreciate')) return confirm({});
  if (method === 'PUT' && path.endsWith('/status')) return confirm({ status: '已过账' });
  return undefined;
}
(async () => {
  const adminTok = await login('admin', 'admin123');
  for (const [role] of ROLES) {
    const uname = USER_MAP[role]; if (!uname) continue;
    await call('POST', '/users', adminTok, { username: uname, password: '123456', displayName: role + '-T', role });
  }
  const M = {
    'admin': [['GET','/tenants',true],['GET','/vouchers',true],['POST','/tenants',true],['POST','/invoices',true]],
    '收租员': [['GET','/tenants',true],['POST','/tenants',true],['DELETE','/tenants/999999',false],['GET','/vouchers',false]],
    '收租主管': [['GET','/tenants',true],['POST','/tenants',true],['DELETE','/tenants/999999',true]],
    '会计': [['GET','/vouchers',true],['GET','/tenants',false],['POST','/fixed-assets',true],['DELETE','/fixed-assets/999999',false],['POST','/invoices/999999/void',false]],
    '财务主管': [['GET','/vouchers',true],['POST','/tenants',false],['POST','/invoices/999999/void',true],['POST','/tax/calculate',true]],
    '出纳': [['GET','/invoices',true],['POST','/invoices',false],['POST','/invoices/999999/issue',false],['POST','/invoices/999999/void',false],['POST','/invoices/999999/redflush',false],['DELETE','/fixed-assets/999999',false],['POST','/fixed-assets/depreciate',false]],
    '维修工': [['POST','/work-orders',true],['GET','/vouchers',false]],
    '总经理': [['GET','/tenants',true],['POST','/tenants',false]],
    '合同主管': [['GET','/contracts',true],['POST','/tenants',false]],
  };
  let pass = 0, fail = 0; const failed = [];
  let cnt = 0;
  for (const [role, cases] of Object.entries(M)) {
    const uname = role === 'admin' ? 'admin' : USER_MAP[role];
    const pwd = role === 'admin' ? 'admin123' : '123456';
    const tok = await login(uname, pwd);
    for (const [method, path, allowed] of cases) {
      cnt++;
      const status = await call(method, path, tok, bodyFor(method, path, cnt, pwd));
      const ok = allowed ? (status !== 401 && status !== 403) : (status === 403);
      if (ok) pass++; else { fail++; failed.push(role + ' ' + method + ' ' + path + ' → ' + status + (allowed ? '(应放行)' : '(应403)')); }
    }
  }
  console.log('权限回归: 通过', pass, '失败', fail);
  if (failed.length) console.log('失败项:', failed.join(' | '));
  process.exit(fail ? 1 : 0);
})();
