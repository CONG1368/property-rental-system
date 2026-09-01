
// UX 交互态验收：骨架屏 / 空态 / 头像图标化弹窗（需先启动 npm run dev）
const { chromium } = require('playwright');
const OUT = 'E:/物业租赁综合管理系统/_preview_shots/';
let pass = 0, fail = 0;
const ok = (n, c, extra) => { c ? (pass++, console.log('PASS: ' + n + (extra ? '  => ' + extra : ''))) : (fail++, console.log('FAIL: ' + n + (extra ? '  => ' + extra : ''))); };

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5 });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message.slice(0, 160)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); });

  // 单一账单接口拦截器，用 mode 切换行为：normal / delay / empty
  let mode = 'normal';
  await page.route('**/api/bills**', async route => {
    if (mode === 'delay') { await new Promise(r => setTimeout(r, 6000)); }
    if (mode === 'empty') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ code: 200, data: { list: [], total: 0 }, message: 'ok' }) });
    }
    return route.continue();
  });

  // 登录
  await page.goto('http://localhost:5173/#/login', { waitUntil: 'networkidle', timeout: 60000 });
  await page.fill('input[placeholder="请输入用户名"]', 'admin');
  await page.fill('input[type="password"]', 'admin123');
  await page.click('.login-btn');
  await page.waitForTimeout(2500);
  ok('登录成功', page.url().includes('/dashboard'), page.url().split('#')[1]);

  // 1) 骨架屏
  mode = 'delay';
  await page.goto('http://localhost:5173/#/rent/bills');
  // 等待页面挂载（dev 模式首次进入需编译该路由 chunk），随后立刻检查首屏骨架
  await page.waitForSelector('.table-skeleton .sk-row', { timeout: 40000 }).catch(() => {});
  const skRows = await page.locator('.table-skeleton .sk-row').count();
  const skCells = await page.locator('.table-skeleton .sk-cell').count();
  ok('账单页首屏显示骨架屏', skRows > 0, 'rows=' + skRows + ' cells=' + skCells);
  await page.screenshot({ path: OUT + 'ux-skeleton.png' });
  await page.waitForSelector('.el-table__body tr', { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(400);
  const skAfter = await page.locator('.table-skeleton .sk-row').count();
  const rowsAfter = await page.locator('.el-table__body tr').count();
  ok('数据到达后骨架消失、表格出数据', skAfter === 0 && rowsAfter > 0, 'skeleton=' + skAfter + ' tableRows=' + rowsAfter);

  // 2) 空态
  mode = 'empty';
  await page.goto('http://localhost:5173/#/dashboard');
  await page.waitForTimeout(700);
  await page.goto('http://localhost:5173/#/rent/bills');
  await page.waitForSelector('.empty-state', { timeout: 30000 }).catch(() => {});
  const emptyCount = await page.locator('.empty-state').count();
  const emptyTitle = (await page.locator('.empty-state .empty-title').first().textContent().catch(() => '') || '').trim();
  const emptyDesc = (await page.locator('.empty-state .empty-desc').first().textContent().catch(() => '') || '').trim();
  const emptyIcon = await page.locator('.empty-state .empty-icon svg').count();
  ok('空数据时显示统一空态', emptyCount > 0 && emptyTitle.length > 0, 'title=' + emptyTitle);
  ok('空态含图标与引导说明', emptyIcon > 0 && emptyDesc.length > 0, 'icon=' + emptyIcon + ' desc=' + emptyDesc.slice(0, 24));
  await page.screenshot({ path: OUT + 'ux-empty.png' });
  mode = 'normal';

  // 3) 头像图标化
  await page.goto('http://localhost:5173/#/dashboard', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await page.click('.user-info');
  await page.waitForTimeout(700);
  await page.locator('.el-dropdown-menu__item', { hasText: '个人设置' }).first().click();
  await page.waitForTimeout(1200);
  const dialogVisible = await page.locator('.el-dialog').first().isVisible().catch(() => false);
  const optionCount = await page.locator('.avatar-option').count();
  const svgCount = await page.locator('.avatar-option svg').count();
  const optText = ((await page.locator('.avatar-picker').first().innerText().catch(() => '')) || '').trim();
  const hasEmoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(optText);
  ok('个人设置弹窗打开', dialogVisible);
  ok('头像选择器 20 个选项', optionCount === 20, 'count=' + optionCount);
  ok('头像全部渲染为 SVG 图标', svgCount >= optionCount && optionCount > 0, 'svg=' + svgCount);
  ok('头像选择器无 emoji 残留', !hasEmoji, 'text=' + JSON.stringify(optText.slice(0, 16)));
  await page.screenshot({ path: OUT + 'ux-avatar.png' });

  ok('运行期无控制台错误', errors.length === 0, 'errors=' + errors.length + (errors[0] ? ' first=' + errors[0] : ''));
  console.log('SUMMARY: ' + pass + '/' + (pass + fail) + ' passed');
  await browser.close();
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error('ERR ' + e.message); process.exit(1); });
