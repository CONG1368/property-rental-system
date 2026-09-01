const { chromium } = require('@playwright/test');
const fs = require('fs'); const path = require('path');
const OUT = path.resolve(__dirname, '../test-results/new-modules');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
const PAGES = [['16-银行对账', '#/finance/bank-reconciliation'], ['17-成本分摊', '#/finance/cost-allocation']];
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await (await browser.newContext({ locale: 'zh-CN', viewport: { width: 1920, height: 1080 } })).newPage();
  await page.goto('http://localhost:5173/#/login', { waitUntil: 'networkidle' });
  await page.fill('input[placeholder="请输入用户名"]', 'admin');
  await page.fill('input[placeholder="请输入密码"]', 'admin123');
  await page.click('button:has-text("登 录")');
  await page.waitForTimeout(2500);
  for (const [name, hash] of PAGES) {
    await page.evaluate(h => { window.location.hash = h; }, hash);
    await page.waitForTimeout(2200);
    const snapshot = await page.evaluate(() => ({ rows: document.querySelectorAll('.el-table__body-wrapper tbody tr').length, body: document.body.innerText.slice(0, 300).replace(/\n+/g,'|') }));
    await page.screenshot({ path: path.join(OUT, name + '.png'), fullPage: true });
    console.log('[OK]', name, 'rows=', snapshot.rows, '| body:', snapshot.body);
  }
  await browser.close();
})();