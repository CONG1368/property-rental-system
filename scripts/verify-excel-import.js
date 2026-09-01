/**
 * Excel 导入/导出链路回归（需先启动 dev 后端）
 *   node scripts/verify-excel-import.js
 *
 * 背景：后端已从 xlsx(SheetJS) 全量迁到 exceljs（xlsx npm 包停更且有未修补 high 漏洞）。
 * 迁移改写了「读工作表 → 首行表头 → 每行对象」的解析实现，这里用真实 .xlsx 文件跑通
 * 房源导入 / 条款导入 / 服务端多表导出三条链路，并验证 .xls 被明确拒绝。
 *
 * 数据卫生：导入的房源名带时间戳，用例结束后逐条删除。
 */
const ExcelJS = require('../backend/node_modules/exceljs');
const fs = require('fs');
const path = require('path');
const os = require('os');

const BASE = 'http://localhost:3001/api';
let token = '';
const results = [];
function check(name, cond, detail) {
  results.push({ name, ok: !!cond });
  console.log((cond ? 'PASS: ' : 'FAIL: ') + name + (detail ? '  => ' + detail : ''));
}

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

async function upload(url, filePath, field) {
  const fd = new FormData();
  const buf = fs.readFileSync(filePath);
  fd.append(field, new Blob([buf]), path.basename(filePath));
  const res = await fetch(BASE + url, { method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: fd });
  const txt = await res.text();
  let data; try { data = JSON.parse(txt); } catch (e) { data = txt; }
  return { status: res.status, body: data };
}

async function makeXlsx(filePath, sheetName, header, rows) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName);
  ws.addRow(header);
  rows.forEach((r) => ws.addRow(r));
  await wb.xlsx.writeFile(filePath);
}

(async () => {
  const stamp = Date.now();
  const tmp = os.tmpdir();

  const login = await j('POST', '/auth/login', { username: 'admin', password: 'admin123' });
  token = login.body && login.body.data ? login.body.data.accessToken : '';
  check('登录取得 token', !!token);
  if (!token) process.exit(2);

  // ---------- 1. 房源导入 ----------
  const propFile = path.join(tmp, 'rg-props-' + stamp + '.xlsx');
  const names = ['回归导入房源A-' + stamp, '回归导入房源B-' + stamp];
  await makeXlsx(propFile, '房源', ['名称', '类型', '面积', '地址', '楼栋', '房号'], [
    [names[0], '公寓', 88.5, '回归测试路1号', '回归楼', '101'],
    [names[1], '商铺', 120, '回归测试路2号', '回归楼', '102'],
  ]);
  const impRes = await upload('/properties/import', propFile, 'file');
  check('房源导入 .xlsx 成功', impRes.body.code === 200, JSON.stringify(impRes.body.data || impRes.body.message).slice(0, 80));
  check('导入条数为 2', (impRes.body.data || {}).imported === 2, 'imported=' + (impRes.body.data || {}).imported);

  // 校验中文表头、数字与文本都被正确解析（而不是全空字符串）
  const listed = await j('GET', '/properties?pageSize=200&keyword=' + encodeURIComponent('回归导入房源'));
  const found = ((listed.body.data || {}).list || []).filter((p) => names.indexOf(p.name) >= 0);
  check('导入的房源可查到 2 条', found.length === 2, 'n=' + found.length);
  const a = found.filter((p) => p.name === names[0])[0];
  check('数字列解析正确（面积 88.5）', !!a && Number(a.area) === 88.5, 'area=' + (a && a.area));
  check('中文枚举列解析正确（类型=公寓）', !!a && a.type === '公寓', 'type=' + (a && a.type));
  check('文本列解析正确（楼栋/房号）', !!a && a.buildingName === '回归楼' && a.roomNumber === '101',
    (a && a.buildingName) + '/' + (a && a.roomNumber));

  // 清理导入数据
  let deleted = 0;
  for (const p of found) { const d = await j('DELETE', '/properties/' + p.id); if (d.body.code === 200) deleted++; }
  check('清理导入的房源', deleted === found.length, deleted + '/' + found.length);

  // ---------- 2. 旧版 .xls 必须被拒绝（exceljs 不支持 BIFF） ----------
  const xlsFile = path.join(tmp, 'rg-legacy-' + stamp + '.xls');
  fs.writeFileSync(xlsFile, 'legacy binary placeholder');
  const xlsRes = await upload('/properties/import', xlsFile, 'file');
  check('.xls 被拒绝并提示另存为 xlsx',
    xlsRes.status >= 400 && /xlsx/i.test(JSON.stringify(xlsRes.body)),
    'status=' + xlsRes.status + ' msg=' + String(xlsRes.body.message || '').slice(0, 40));

  // ---------- 3. 条款导入 ----------
  const clauseFile = path.join(tmp, 'rg-clauses-' + stamp + '.xlsx');
  await makeXlsx(clauseFile, '条款', ['租客姓名', '条款标题', '条款内容', '排序'], [
    ['不存在的租客-' + stamp, '回归条款', '这是回归用例写入的条款内容。', 1],
  ]);
  const clauseRes = await upload('/contracts/import-clauses', clauseFile, 'file');
  check('条款导入接口解析成功（total=1）',
    clauseRes.body.code === 200 && (clauseRes.body.data || {}).total === 1,
    JSON.stringify(clauseRes.body.data || clauseRes.body.message).slice(0, 90));

  // ---------- 4. 服务端多表导出 ----------
  const expRes = await fetch(BASE + '/export/excel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ reportKeys: ['collection-rate', 'rent-summary'] }),
  });
  const buf = Buffer.from(await expRes.arrayBuffer());
  check('导出返回 xlsx 二进制（PK 魔数）', expRes.status === 200 && buf.length > 1000 && buf[0] === 0x50 && buf[1] === 0x4b,
    'status=' + expRes.status + ' bytes=' + buf.length);
  // 用 exceljs 反向读回，确认生成的工作簿结构正确
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  check('导出的工作簿至少含 1 个工作表且有表头',
    wb.worksheets.length >= 1 && wb.worksheets[0].getRow(1).cellCount > 0,
    'sheets=' + wb.worksheets.map((w) => w.name).join(','));

  [propFile, xlsFile, clauseFile].forEach((f) => { try { fs.unlinkSync(f); } catch (e) { /* 忽略 */ } });

  const failed = results.filter((r) => !r.ok);
  console.log('');
  console.log('SUMMARY: ' + (results.length - failed.length) + '/' + results.length + ' passed');
  if (failed.length) { console.log('FAILED: ' + failed.map((f) => f.name).join(' | ')); process.exit(1); }
})().catch((e) => { console.error('ERR:', e); process.exit(2); });
