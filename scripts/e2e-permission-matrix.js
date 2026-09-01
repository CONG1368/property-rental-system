const { chromium } = require('@playwright/test');
const base = 'http://localhost:5173';

// 通过 API 重置权限到默认（清理测试产物）
async function apiReset() {
  try {
    const login = await fetch(base.replace('5173','3001') + '/api/auth/login', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ username:'admin', password:'admin123' }) });
    const j = await login.json();
    const token = j.data.accessToken;
    await fetch('http://localhost:3001/api/permissions/reset', { method:'POST', headers:{ 'Content-Type':'application/json', 'Authorization':'Bearer '+token }, body: JSON.stringify({ confirmPassword:'admin123' }) });
  } catch (e) {}
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await (await browser.newContext({ locale: 'zh-CN', viewport: { width: 1920, height: 1080 } })).newPage();
  const results = [];
  const ok = (name, cond, extra='') => results.push((cond?'PASS':'FAIL') + ' ' + name + (extra?' — '+extra:''));

  await page.goto(base + '/#/login', { waitUntil: 'networkidle' });
  await page.fill('input[placeholder="请输入用户名"]', 'admin');
  await page.fill('input[placeholder="请输入密码"]', 'admin123');
  await page.click('button[type="submit"], .el-button--primary');
  await page.waitForTimeout(1500);

  await page.goto(base + '/#/system/permissions', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // 1. role select + alert
  await page.click('.toolbar .el-select');
  await page.waitForTimeout(400);
  await page.locator('.el-select-dropdown__item', { hasText: '管理员' }).first().click();
  await page.waitForTimeout(600);
  const alertTxt = await page.textContent('.el-alert');
  ok('1. 角色选择后显示告警', !!(alertTxt && alertTxt.includes('管理员')));

  // 2. search by english code
  await page.fill('input[placeholder="搜索模块（名称/编码）"]', 'rent');
  await page.waitForTimeout(400);
  let n = await page.locator('.el-table__body tr').count();
  ok('2. 模块编码搜索过滤', n > 0 && n < 18, 'rows=' + n);
  // 3. search by chinese name
  await page.fill('input[placeholder="搜索模块（名称/编码）"]', '租客');
  await page.waitForTimeout(400);
  n = await page.locator('.el-table__body tr').count();
  ok('3. 中文模块名搜索', n === 1, 'rows=' + n);
  await page.fill('input[placeholder="搜索模块（名称/编码）"]', '');
  await page.waitForTimeout(400);

  // 4. batch selection
  const rentRow = page.locator('tr', { hasText: 'rent' }).first();
  await rentRow.locator('td').nth(0).locator('.el-checkbox').click();
  await page.waitForTimeout(300);
  const selCount = await page.locator('.batch-bar b').first().textContent();
  ok('4. 批量条显示已选数量', !!(selCount && parseInt(selCount) >= 1), '已选=' + selCount);

  // 5. cause a change (toggle 新增 on rent row)
  await rentRow.locator('td').nth(2).locator('.el-checkbox').click();
  await page.waitForTimeout(300);

  // 6. save -> confirm dialog + diff
  await page.click('text=保存当前角色权限');
  await page.waitForTimeout(600);
  ok('6a. 保存触发二次确认弹窗', await page.locator('.el-dialog').isVisible());
  const diffTxt = await page.textContent('.el-dialog .diff-summary').catch(()=>'');
  ok('6b. 确认弹窗展示差异清单', !!(diffTxt && diffTxt.includes('权限变更')), diffTxt);

  // 7. wrong password rejected
  await page.fill('.el-dialog input[type="password"]', 'wrongpwd');
  await page.click('text=确认执行');
  await page.waitForTimeout(900);
  const errToast = await page.locator('.el-message').last().textContent().catch(()=>'');
  ok('7. 错误密码被拒绝(二次确认)且弹窗未关', !!(errToast && errToast.includes('二次确认')) && (await page.locator('.el-dialog').isVisible()), errToast);

  // 8. correct password -> save success (read LAST message)
  await page.fill('.el-dialog input[type="password"]', 'admin123');
  await page.click('text=确认执行');
  await page.waitForTimeout(1200);
  const msgs = await page.locator('.el-message').allTextContents();
  const lastMsg = msgs[msgs.length-1] || '';
  ok('8. 正确密码完成保存', lastMsg.includes('保存'), lastMsg);

  // cleanup: reset permissions to default
  await apiReset();

  console.log(results.join('\n'));
  const fails = results.filter(r => r.startsWith('FAIL'));
  await browser.close();
  process.exit(fails.length ? 1 : 0);
}
run().catch(e => { console.error('RUN ERROR:', e.message); process.exit(1); });
