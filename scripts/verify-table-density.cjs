// 第 5 周门槛：同一表格在「密/标/松」三档下无布局破损。
// 需先启动 dev（npm run dev）。用法：node scripts/verify-table-density.cjs
const { chromium } = require('@playwright/test');

const BASE = 'http://localhost:5173';
const TARGET = '/rent/bills';   // 一个带九列 + 固定右列 + 金额/日期/状态内置列的真实列表页
let pass = 0; let fail = 0; const failures = [];
function check(name, cond, detail) {
  if (cond) { pass++; console.log('PASS: ' + name + (detail ? '  => ' + detail : '')); }
  else { fail++; failures.push(name); console.log('FAIL: ' + name + (detail ? '  => ' + detail : '')); }
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ locale: 'zh-CN', viewport: { width: 1600, height: 1000 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message || e).slice(0, 120)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 120)); });

  async function login() {
    await page.goto(BASE + '/#/login', { waitUntil: 'networkidle', timeout: 60000 });
    await page.fill('input[placeholder="请输入用户名"]', 'admin');
    await page.fill('input[placeholder="请输入密码"]', 'admin123');
    await page.click('button:has-text("登 录")');
    await page.waitForTimeout(2500);
  }
  async function ensureLoggedIn() {
    if (page.url().indexOf('/login') >= 0) await login();
  }

  await login();
  await ensureLoggedIn();

  const heights = {};
  const levels = [['compact', '密'], ['default', '标'], ['loose', '松']];
  for (const pair of levels) {
    const d = pair[0];
    // 切密度：写入偏好后重载，useDensity 在模块初始化时读取
    await page.evaluate((v) => localStorage.setItem('ui-density', v), d);
    await page.reload({ waitUntil: 'networkidle' });
    await ensureLoggedIn();
    await page.evaluate((h) => { window.location.hash = h; }, TARGET);
    await page.waitForSelector('.data-table .el-table__row', { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(600);

    const m = await page.evaluate(() => {
      const root = document.querySelector('.data-table');
      const row = document.querySelector('.data-table .el-table__row');
      const wrap = document.querySelector('.data-table .el-table__body-wrapper');
      const doc = document.documentElement;
      return {
        cls: root ? root.className : '',
        rowH: row ? Math.round(row.getBoundingClientRect().height) : 0,
        rows: document.querySelectorAll('.data-table .el-table__row').length,
        overflowX: doc.scrollWidth - doc.clientWidth,
        tableOverflow: wrap ? wrap.scrollWidth - wrap.clientWidth : 0,
      };
    });
    heights[d] = m.rowH;
    check('密度「' + pair[1] + '」已生效', m.cls.indexOf('density-' + d) >= 0, 'class=' + m.cls);
    check('密度「' + pair[1] + '」渲染出行', m.rows > 0, 'rows=' + m.rows + ' rowH=' + m.rowH);
    check('密度「' + pair[1] + '」无页面横向溢出', m.overflowX <= 1, 'overflowX=' + m.overflowX + 'px');
    check('密度「' + pair[1] + '」表格无内容截断', m.tableOverflow <= 1, 'tableOverflow=' + m.tableOverflow + 'px');
  }

  check('三档行高递增（密 < 标 < 松）', heights.compact < heights.default && heights.default < heights.loose,
    'compact=' + heights.compact + ' default=' + heights.default + ' loose=' + heights.loose);
  check('全程无 JS 报错', errors.length === 0, errors.slice(0, 3).join(' | '));

  await browser.close();
  console.log('');
  console.log('SUMMARY: ' + pass + '/' + (pass + fail) + ' passed');
  if (fail) console.log('FAILED: ' + failures.join(', '));
  process.exit(fail ? 1 : 0);
})();
