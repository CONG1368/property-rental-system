
// 系统设置模块运行时回归脚本（需后端已启动，node scripts/verify-system-settings.js）
const BASE = 'http://localhost:3001/api';
let pass = 0, fail = 0;
function ok(name, cond, extra) { if (cond) { pass++; console.log('[OK] ' + name + (extra?(' '+extra):'')); } else { fail++; console.log('[FAIL] ' + name + (extra?(' '+extra):'')); } }
async function req(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  let json = null; try { json = await res.json(); } catch {}
  return { status: res.status, json };
}

(async () => {
  // 1 管理员登录
  const login = await req('POST', '/auth/login', { username: 'admin', password: 'admin123' });
  ok('管理员登录', login.status === 200 && !!login.json?.data?.accessToken);
  const adminToken = login.json?.data?.accessToken;

  // 2 GET /system-configs/keys（管理员，只读放行）
  const keys = await req('GET', '/system-configs/keys?keys=company_name_for_print,company_logo,audit_enabled', null, adminToken);
  ok('admin GET /keys 返回数据', keys.status === 200 && Array.isArray(keys.json?.data));

  // 3 PUT 无 confirmPassword -> 403
  const putNo = await req('PUT', '/system-configs/company_name_for_print', { configValue: 'XX测试' }, adminToken);
  ok('PUT 无确认返回403', putNo.status === 403, 'HTTP ' + putNo.status);

  // 4 PUT 带正确 confirmPassword -> 200
  const putOk = await req('PUT', '/system-configs/company_name_for_print', { configValue: '测试公司', confirmPassword: 'admin123' }, adminToken);
  ok('PUT 带确认成功', putOk.status === 200 && putOk.json?.code === 200, 'HTTP ' + putOk.status);

  // 5 非管理员（收租员）只读放行
  const t = await req('POST', '/auth/login', { username: 't_rent', password: '123456' });
  if (t.json?.data?.accessToken) {
    const tToken = t.json.data.accessToken;
    const k2 = await req('GET', '/system-configs/keys?keys=company_name_for_print', null, tToken);
    ok('收租员 GET /keys 只读放行', k2.status === 200 && Array.isArray(k2.json?.data));
    const tPut = await req('PUT', '/system-configs/company_name_for_print', { configValue: 'x' }, tToken);
    ok('收租员 PUT 返回403', tPut.status === 403, 'HTTP ' + tPut.status);
  } else {
    console.log('[WARN] t_rent 不存在，跳过非管理员测试');
  }

  // 6 审计日志筛选
  const audit = await req('GET', '/audit-logs?status=success&page=1&pageSize=5', null, adminToken);
  ok('审计筛选返回', audit.status === 200 && audit.json?.data?.total !== undefined);

  // 7 字典类型
  const dict = await req('GET', '/dicts/types', null, adminToken);
  ok('字典类型返回', dict.status === 200 && Array.isArray(dict.json?.data?.list));

  // 8 系统运维
  const info = await req('GET', '/system-ops/info', null, adminToken);
  ok('system-ops/info 返回', info.status === 200 && !!info.json?.data?.version, 'v=' + info.json?.data?.version + ' db=' + info.json?.data?.dbDialect);

  console.log('\n=== 结果: ' + pass + ' 通过, ' + fail + ' 失败 ===');
  process.exit(fail ? 1 : 0);
})();
