/**
 * 零覆盖模块 API 回归（需先启动 dev 后端）
 *   node scripts/verify-uncovered-api.js
 *
 * 覆盖此前全链路回归中「一次都没被触达」的 10 个路由模块：
 *   door-locks / id-card-readers / notifications / approval-requests / briefing-reports
 *   export / tenant-auth / ocr / analytics / property-automation
 *
 * 数据卫生（遵守 CLAUDE.md 测试数据约定）：
 *   1. 门锁增删只发生在**本用例创建的临时锁**上（sn 带时间戳），用例内删除；
 *   2. 对种子门锁只做**净零操作**：建密码→删密码、钥匙借出→归还，状态回到原点；
 *   3. 日志类表（门锁日志/读卡日志/通知）按产品语义只追加，不做删除。
 */
const BASE = 'http://localhost:3001/api';
let token = '';

async function j(method, url, body) {
  const res = await fetch(BASE + url, {
    method,
    headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
    body: body ? JSON.stringify(body) : undefined,
  });
  const txt = await res.text();
  let data; try { data = JSON.parse(txt); } catch (e) { data = txt; }
  return { status: res.status, body: data };
}

const results = [];
function check(name, cond, detail) {
  results.push({ name: name, ok: !!cond });
  console.log((cond ? 'PASS: ' : 'FAIL: ') + name + (detail ? '  => ' + detail : ''));
}

(async () => {
  const stamp = Date.now();

  // ---------- 登录 ----------
  const login = await j('POST', '/auth/login', { username: 'admin', password: 'admin123' });
  token = login.body && login.body.data ? login.body.data.accessToken : '';
  check('登录取得 token', !!token);
  if (!token) { console.log('无法登录，终止'); process.exit(2); }

  // ==========================================================
  // 1. door-locks（17 端点，此前 0 覆盖）
  // ==========================================================
  const lockList = await j('GET', '/door-locks?page=1&pageSize=50');
  const ld = lockList.body && lockList.body.data ? lockList.body.data : {};
  check('door-locks 列表返回 total/list', typeof ld.total === 'number' && Array.isArray(ld.list), 'total=' + ld.total);

  const smartList = await j('GET', '/door-locks?category=' + encodeURIComponent('智能门锁'));
  const smartRows = (smartList.body.data && smartList.body.data.list) || [];
  check('door-locks 按品类过滤只返回智能门锁', smartRows.length > 0 && smartRows.every((x) => x.category === '智能门锁'), 'n=' + smartRows.length);

  const tradList = await j('GET', '/door-locks?category=' + encodeURIComponent('传统门锁'));
  const tradRows = (tradList.body.data && tradList.body.data.list) || [];
  check('door-locks 传统门锁存在（种子数据）', tradRows.length > 0, 'n=' + tradRows.length);

  // 取一个房源做外键
  const props = await j('GET', '/properties?page=1&pageSize=1');
  const propId = props.body.data && props.body.data.list && props.body.data.list[0] ? props.body.data.list[0].id : null;
  check('取到房源 id 供门锁外键使用', !!propId, 'propertyId=' + propId);

  // 临时锁：完整增删改查生命周期（无子记录，可安全删除）
  const created = await j('POST', '/door-locks', {
    propertyId: propId, name: '回归临时锁-' + stamp, category: '智能门锁',
    lockType: '密码锁', manufacturer: '回归测试', model: 'RG-1',
    sn: 'RG-SN-' + stamp, deviceId: 'RG-DEV-' + stamp, status: '在线', battery: 88,
  });
  const tmpId = created.body.data ? created.body.data.id : null;
  check('POST /door-locks 创建临时锁', created.body.code === 200 && !!tmpId, 'id=' + tmpId);

  const detail = await j('GET', '/door-locks/' + tmpId);
  const dd = detail.body.data || {};
  check('GET /door-locks/:id 详情带 property/passwords/keys 关联',
    dd.id === tmpId && 'property' in dd && Array.isArray(dd.passwords) && Array.isArray(dd.keys),
    'keys=' + JSON.stringify(Object.keys(dd)).slice(0, 60));

  const upd = await j('PUT', '/door-locks/' + tmpId, { notes: '回归备注-' + stamp });
  check('PUT /door-locks/:id 更新生效', upd.body.code === 200 && upd.body.data.notes === '回归备注-' + stamp);

  const del = await j('DELETE', '/door-locks/' + tmpId);
  check('DELETE /door-locks/:id 删除临时锁', del.body.code === 200);
  const gone = await j('GET', '/door-locks/' + tmpId);
  check('删除后 GET 返回 404', gone.status === 404, 'status=' + gone.status);

  // 智能锁操作：状态 / 密码 CRUD / 远程开锁 / 日志（在种子锁上做净零操作）
  const smartId = smartRows[0].id;
  const st = await j('GET', '/door-locks/' + smartId + '/status');
  const sd = st.body.data || {};
  check('GET /:id/status 返回在线状态与电量', st.body.code === 200 && 'online' in sd && 'battery' in sd,
    'online=' + sd.online + ' battery=' + sd.battery);

  const pwdCreate = await j('POST', '/door-locks/' + smartId + '/passwords', {
    password: String(stamp).slice(-6), passwordType: '临时', purpose: '保洁',
    maxUseCount: 3, notes: '回归用例-' + stamp,
  });
  const pwdId = pwdCreate.body.data ? pwdCreate.body.data.id : null;
  check('POST /:id/passwords 创建临时密码', pwdCreate.body.code === 200 && !!pwdId, 'pwdId=' + pwdId);

  const pwdList = await j('GET', '/door-locks/' + smartId + '/passwords');
  const pwdRows = pwdList.body.data || [];
  check('GET /:id/passwords 含刚创建的密码', pwdRows.some((p) => p.id === pwdId), 'n=' + pwdRows.length);

  const pwdOff = await j('PUT', '/door-locks/' + smartId + '/passwords/' + pwdId, { isActive: false });
  check('PUT 密码停用 isActive=false', pwdOff.body.code === 200 && pwdOff.body.data.isActive === false);

  const pwdDel = await j('DELETE', '/door-locks/' + smartId + '/passwords/' + pwdId);
  check('DELETE 密码（恢复净零）', pwdDel.body.code === 200);
  const pwdList2 = await j('GET', '/door-locks/' + smartId + '/passwords');
  check('删除后密码列表不再包含该密码', !(pwdList2.body.data || []).some((p) => p.id === pwdId));

  const open = await j('POST', '/door-locks/' + smartId + '/remote-open');
  check('POST /:id/remote-open 远程开锁成功', open.body.code === 200 && open.body.data && open.body.data.success === true,
    'msg=' + (open.body.message || '').slice(0, 30));

  const logs = await j('GET', '/door-locks/' + smartId + '/logs?page=1&pageSize=5');
  const logRows = (logs.body.data && logs.body.data.list) || [];
  check('GET /:id/logs 最新一条为远程开锁', logRows.length > 0 && logRows[0].operationType === '远程开锁',
    'first=' + (logRows[0] ? logRows[0].operationType : 'none'));

  // 传统锁：钥匙借还闭环（借出→归还，状态回到在库）
  const tradId = tradRows[0].id;
  const keys = await j('GET', '/door-locks/' + tradId + '/keys');
  const keyRows = keys.body.data || [];
  check('GET /:id/keys 返回钥匙列表', Array.isArray(keyRows) && keyRows.length > 0, 'n=' + keyRows.length);

  let keyId = null;
  const idle = keyRows.filter((k) => k.keyStatus === '在库')[0];
  if (idle) keyId = idle.id;
  else if (keyRows[0]) { // 没有在库钥匙时先归位，保证用例可重复运行
    keyId = keyRows[0].id;
    await j('PUT', '/door-locks/' + tradId + '/keys/' + keyId, { keyStatus: '在库' });
  }
  check('找到可借出的在库钥匙', !!keyId, 'keyId=' + keyId);

  const lend = await j('POST', '/door-locks/' + tradId + '/keys/' + keyId + '/lend', {
    holderType: '维修', holderName: '回归测试员', holderPhone: '13800000000', lendReason: '自动化回归',
  });
  check('POST 钥匙借出 → 状态变借出', lend.body.code === 200 && lend.body.data.keyStatus === '借出');

  const lendAgain = await j('POST', '/door-locks/' + tradId + '/keys/' + keyId + '/lend', {
    holderType: '维修', holderName: '重复借出', 
  });
  check('已借出的钥匙不可重复借出（业务规则生效）', lendAgain.status >= 400 || lendAgain.body.code !== 200,
    'status=' + lendAgain.status);

  const back = await j('POST', '/door-locks/' + tradId + '/keys/' + keyId + '/return');
  check('POST 钥匙归还 → 状态回到在库', back.body.code === 200 && back.body.data.keyStatus === '在库');

  const tradLogs = await j('GET', '/door-locks/' + tradId + '/logs?page=1&pageSize=5');
  const tRows = (tradLogs.body.data && tradLogs.body.data.list) || [];
  check('传统锁日志记录了借出/归还', tRows.some((l) => l.operationType === '钥匙归还') && tRows.some((l) => l.operationType === '钥匙借出'),
    'types=' + tRows.map((l) => l.operationType).join(','));

  // 品类互斥规则
  const badOpen = await j('POST', '/door-locks/' + tradId + '/remote-open');
  check('传统锁远程开锁被拒绝', badOpen.status >= 400 || badOpen.body.code !== 200, 'status=' + badOpen.status);
  const badKey = await j('POST', '/door-locks/' + smartId + '/keys', { keyCode: 'RG-' + stamp });
  check('智能锁登记钥匙被拒绝', badKey.status >= 400 || badKey.body.code !== 200, 'status=' + badKey.status);

  // ==========================================================
  // 2. id-card-readers（7 端点）
  // ==========================================================
  const readers = await j('GET', '/id-card-readers?page=1&pageSize=10');
  const rRows = (readers.body.data && readers.body.data.list) || [];
  check('id-card-readers 列表返回设备', readers.body.code === 200 && rRows.length > 0, 'n=' + rRows.length);

  const rlogs = await j('GET', '/id-card-readers/logs?page=1&pageSize=5');
  check('id-card-readers/logs 固定路径未被 /:id 吞噬', rlogs.body.code === 200 && Array.isArray(rlogs.body.data.list),
    'total=' + (rlogs.body.data ? rlogs.body.data.total : 'N/A'));

  if (rRows.length) {
    const rid = rRows[0].id;
    const rst = await j('GET', '/id-card-readers/' + rid + '/status');
    check('读卡器状态查询', rst.body.code === 200 && rst.body.data && 'online' in rst.body.data,
      'online=' + (rst.body.data || {}).online);

    const read = await j('POST', '/id-card-readers/' + rid + '/read');
    const okRead = read.body.code === 200 && read.body.data && read.body.data.idNumber;
    check('触发读卡返回身份证信息', !!okRead, 'name=' + ((read.body.data || {}).name || read.body.message));
    if (okRead) {
      // 接口本身必须返回完整号码（前端要回填租客表单），脱敏只发生在审计日志侧
      check('读卡响应返回完整 18 位身份证号', /^\d{17}[\dXx]$/.test(String(read.body.data.idNumber)),
        'len=' + String(read.body.data.idNumber).length);
      const after = await j('GET', '/id-card-readers/logs?page=1&pageSize=1');
      const top = ((after.body.data || {}).list || [])[0];
      check('读卡审计日志中的身份证号已脱敏', !!top && /\*{3,}/.test(String(top.idNumber || '')),
        'log=' + (top ? top.idNumber : 'none'));
    }
  }

  // ==========================================================
  // 3. notifications（6 端点）
  // ==========================================================
  const notis = await j('GET', '/notifications?page=1&pageSize=5');
  check('notifications 列表', notis.body.code === 200 && Array.isArray(notis.body.data.list),
    'total=' + (notis.body.data || {}).total);
  const unread = await j('GET', '/notifications/unread-count');
  check('notifications 未读计数为数字', unread.body.code === 200 && typeof unread.body.data.count === 'number',
    'count=' + (unread.body.data || {}).count);
  const tenants = await j('GET', '/tenants?page=1&pageSize=1');
  const tenantId = tenants.body.data && tenants.body.data.list && tenants.body.data.list[0] ? tenants.body.data.list[0].id : null;
  const badSend = await j('POST', '/notifications/send-to-tenant', { channel: '站内信' });
  check('send-to-tenant 缺参数返回 400', badSend.status === 400, 'status=' + badSend.status);
  if (tenantId) {
    const tnotis = await j('GET', '/notifications/tenant/' + tenantId);
    check('按租户查询通知', tnotis.body.code === 200, 'code=' + tnotis.body.code);
  }

  // ==========================================================
  // 4. approval-requests（6 端点）
  // ==========================================================
  const pending = await j('GET', '/approval-requests/pending');
  check('approval-requests/pending 可访问', pending.body.code === 200, 'code=' + pending.body.code);
  const mine = await j('GET', '/approval-requests/my');
  check('approval-requests/my 可访问', mine.body.code === 200, 'code=' + mine.body.code);
  const allReq = await j('GET', '/approval-requests');
  check('approval-requests 列表可访问', allReq.body.code === 200, 'code=' + allReq.body.code);

  // ==========================================================
  // 5. briefing-reports / export
  // ==========================================================
  const briefs = await j('GET', '/briefing-reports/list');
  check('briefing-reports/list 返回归档列表', briefs.body.code === 200 && Array.isArray(briefs.body.data.list),
    'n=' + ((briefs.body.data || {}).list || []).length);
  const badDl = await j('GET', '/briefing-reports/download/notexist.txt');
  check('简报下载拒绝非 pdf 文件名', badDl.status === 400, 'status=' + badDl.status);

  const repList = await j('GET', '/export/report-list');
  check('export/report-list 返回 10 个报表键',
    repList.body.code === 200 && Array.isArray(repList.body.data.keys) && repList.body.data.keys.length === 10,
    'n=' + ((repList.body.data || {}).keys || []).length);
  const preview = await j('GET', '/export/preview?key=collection-rate');
  check('export/preview 可预览报表数据', preview.body.code === 200, 'code=' + preview.body.code);

  // ==========================================================
  // 6. tenant-auth / ocr / analytics / property-automation
  // ==========================================================
  const taEmpty = await j('POST', '/tenant-auth/login', {});
  check('tenant-auth 缺参数 400', taEmpty.status === 400, 'status=' + taEmpty.status);
  const taBad = await j('POST', '/tenant-auth/login', { phone: '19900000000', pin: 'wrong-pin' });
  check('tenant-auth 错误口令 401', taBad.status === 401, 'status=' + taBad.status);

  const ocrNoFile = await j('POST', '/ocr/recognize', { docType: 'id-card' });
  check('ocr 未传图片返回 400', ocrNoFile.status === 400, 'status=' + ocrNoFile.status);

  const askEmpty = await j('POST', '/analytics/ask', { question: '' });
  check('analytics 空问题 400', askEmpty.status === 400, 'status=' + askEmpty.status);
  const ask = await j('POST', '/analytics/ask', { question: '本月收缴率是多少' });
  const ad = ask.body.data || {};
  check('analytics 收缴率问句命中 collection 指标',
    ask.body.code === 200 && ad.metric === 'collection' && typeof ad.answer === 'string' && ad.answer.length > 0,
    'metric=' + ad.metric);
  const ask2 = await j('POST', '/analytics/ask', { question: '空置房源有多少' });
  check('analytics 空置问句命中 vacancy 指标', (ask2.body.data || {}).metric === 'vacancy',
    'metric=' + (ask2.body.data || {}).metric);

  const auto = await j('POST', '/property-automation/run');
  const au = auto.body.data || {};
  check('property-automation/run 返回各项计数',
    auto.body.code === 200 && typeof au.escalatedOrders === 'number' && typeof au.expiringContracts === 'number',
    'escalated=' + au.escalatedOrders + ' contracts=' + au.expiringContracts);

  // ---------- 汇总 ----------
  const failed = results.filter((r) => !r.ok);
  console.log('');
  console.log('SUMMARY: ' + (results.length - failed.length) + '/' + results.length + ' passed');
  if (failed.length) { console.log('FAILED: ' + failed.map((f) => f.name).join(' | ')); process.exit(1); }
})().catch((e) => { console.error('ERR:', e); process.exit(2); });
