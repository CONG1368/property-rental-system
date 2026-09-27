/**
 * 使用说明书截图采集（需先启动 npm run dev）
 *   node scripts/capture-manual-screenshots.js
 *   node scripts/capture-manual-screenshots.js dashboard properties   # 只补拍指定截图
 *
 * 产物写入 docs/screenshots/<key>.png，供 scripts/generate-manual-pdf.js 内嵌为 base64。
 * 与 e2e 脚本一致：main.ts 启动时会清空 token，dev 模式整页 reload 会被踢回登录页，
 * 因此每页导航前都做一次 ensureLoggedIn()。
 */
const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const BASE = 'http://localhost:5173';
const OUT_DIR = path.resolve(__dirname, '../docs/screenshots');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

// [文件名(无扩展), hash 路由, 等待毫秒(图表页给足渲染时间)]
const SHOTS = [
  ['dashboard', '#/dashboard', 3000],
  // 收租管理
  ['properties', '#/rent/properties', 2000],
  ['room-kanban', '#/rent/room-kanban', 2500],
  ['room-dashboard', '#/rent/room-kanban/dashboard', 4000],
  ['tenants', '#/rent/tenants', 2000],
  ['tenant-credit', '#/rent/tenant-credit', 2000],
  ['deposits', '#/rent/deposits', 2000],
  ['checkouts', '#/rent/checkouts', 2000],
  ['bills', '#/rent/bills', 2000],
  ['bills-calendar', '#/rent/bills/calendar', 2500],
  ['dunning', '#/rent/dunning', 2000],
  ['door-locks', '#/rent/locks', 2000],
  ['rent-dashboard', '#/rent/dashboard', 4000],
  // 物业管理
  ['ops-dashboard', '#/property/ops-dashboard', 4000],
  ['work-orders', '#/property/work-orders', 2000],
  ['facilities', '#/property/facilities', 2000],
  ['meters', '#/property/meters', 2000],
  ['smart-meter', '#/property/smart-meter', 2500],
  ['parking', '#/property/parking', 2000],
  ['announcements', '#/property/announcements', 2000],
  ['tenant-portal', '#/property/tenant-portal', 2500],
  // 合同管理
  ['contracts', '#/contract/list', 2000],
  ['contract-draft', '#/contract/draft', 2500],
  ['contract-approval', '#/contract/approval', 2000],
  ['contract-kanban', '#/contract/kanban', 4000],
  ['clause-import', '#/contract/clause-import', 2000],
  // 消防管理
  ['fire-dashboard', '#/fire/dashboard', 3000],
  ['fire-inspections', '#/fire/inspections', 2000],
  ['fire-equipment', '#/fire/equipment', 2000],
  ['fire-violations', '#/fire/violations', 2000],
  ['fire-drills', '#/fire/drills', 2000],
  // 财务报表
  ['finance-vouchers', '#/finance/vouchers', 2000],
  ['finance-invoices', '#/finance/invoices', 2000],
  ['finance-fixed-assets', '#/finance/fixed-assets', 2000],
  ['reports', '#/finance/reports', 2500],
  ['finance-dashboard', '#/finance/dashboard', 4000],
  // 系统设置
  ['settings', '#/system/users', 2000],
  ['permissions', '#/system/permissions', 2500],
  ['audit-logs', '#/system/audit-logs', 2000],
  ['system-params', '#/system/params', 2000],
  ['system-ops', '#/system/ops', 2500],
  ['print-settings', '#/system/print-settings', 2000],
  // 全局
  ['search', '#/search', 2000],
  ['approval-center', '#/approval-center', 2000],
];

const only = process.argv.slice(2);
const targets = only.length ? SHOTS.filter((s) => only.includes(s[0])) : SHOTS;

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    locale: 'zh-CN',
    viewport: { width: 1600, height: 980 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  page.on('pageerror', () => {});

  async function login() {
    await page.goto(BASE + '/#/login', { waitUntil: 'networkidle', timeout: 60000 });
    await page.fill('input[placeholder="请输入用户名"]', 'admin');
    await page.fill('input[placeholder="请输入密码"]', 'admin123');
    await page.click('button:has-text("登 录")');
    const deadline = Date.now() + 30000;
    while (Date.now() < deadline && page.url().indexOf('/dashboard') < 0) await page.waitForTimeout(800);
  }
  async function ensureLoggedIn() {
    if (page.url().indexOf('/login') >= 0) await login();
  }

  // 1) 登录页单独拍（未登录态）
  if (!only.length || only.includes('login')) {
    await page.goto(BASE + '/#/login', { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(OUT_DIR, 'login.png') });
    console.log('OK  login.png');
  }

  await login();

  let ok = 0;
  const failed = [];
  for (const [key, hash, wait] of targets) {
    try {
      await page.goto(BASE + '/' + hash, { waitUntil: 'networkidle', timeout: 60000 });
      await ensureLoggedIn();
      if (page.url().indexOf(hash.slice(1)) < 0) {
        await page.goto(BASE + '/' + hash, { waitUntil: 'networkidle', timeout: 60000 });
      }
      await page.waitForTimeout(wait);
      // 关掉可能遮挡内容的错误提示
      await page.evaluate(() => {
        document.querySelectorAll('.el-message, .el-notification').forEach((el) => el.remove());
      });
      await page.screenshot({ path: path.join(OUT_DIR, key + '.png') });
      ok++;
      console.log('OK  ' + key + '.png');
    } catch (e) {
      failed.push(key + ' => ' + String(e.message || e).slice(0, 100));
      console.log('FAIL ' + key + ' => ' + String(e.message || e).slice(0, 100));
    }
  }

  await browser.close();
  console.log('\n采集完成: ' + ok + '/' + targets.length);
  if (failed.length) { failed.forEach((f) => console.log('  - ' + f)); process.exit(1); }
})();
