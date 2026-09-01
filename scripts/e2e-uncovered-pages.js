/**
 * 零覆盖页面 E2E 渲染回归（需先启动 npm run dev）
 *   node scripts/e2e-uncovered-pages.js
 *
 * 覆盖此前所有 E2E 脚本都没访问过的 18 个页面：
 *   消防 5 页 / 房态看板 3 页 / 门锁 / 合同起草 / 条款导入 / 房源导入 / 收租日历
 *   打印设置 / 读卡器设置 / 系统参数 / 系统运维 / 租户门户
 *
 * 每页断言：主内容区关键文案存在 + 无 vite 错误遮罩 + 无 JS 异常
 *           + 无接口错误提示(.el-message--error) + 无乱码；
 *           有种子数据的列表页额外断言表格有数据行。
 */
const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const BASE = 'http://localhost:5173';
const SHOT_DIR = path.resolve(__dirname, '../test-results/uncovered-pages');
if (!fs.existsSync(SHOT_DIR)) fs.mkdirSync(SHOT_DIR, { recursive: true });

// [名称, hash, 主内容区必须出现的文案, 期望最少表格行数(0=不校验), 是否无 el-main 布局]
const PAGES = [
  ['房源批量导入', '#/rent/properties/import', '批量导入房源', 0, false],
  ['收租日历', '#/rent/bills/calendar', '收租日历', 0, false],
  ['房态看板', '#/rent/room-kanban', '入住率', 0, false],
  ['房态数据大屏', '#/rent/room-kanban/dashboard', '房态分布', 0, false],
  ['批量生成房间', '#/rent/room-kanban/batch-gen', '批量生成房间', 0, false],
  ['门锁管理', '#/rent/locks', '门锁总数', 1, false],
  ['消防看板', '#/fire/dashboard', '器材总数', 0, false],
  ['消防检查记录', '#/fire/inspections', '消防检查记录', 1, false],
  ['消防器材台账', '#/fire/equipment', '消防器材台账', 1, false],
  ['消防违规记录', '#/fire/violations', '消防违规记录', 1, false],
  ['消防演练记录', '#/fire/drills', '消防演练记录', 1, false],
  ['合同起草', '#/contract/draft', '合同编号', 0, false],
  ['条款批量导入', '#/contract/clause-import', '条款批量导入', 0, false],
  ['打印设置', '#/system/print-settings', '打印设置', 0, false],
  ['身份证读卡器', '#/system/id-card-readers', '身份证读卡器管理', 1, false],
  ['系统参数中心', '#/system/params', '系统参数中心', 1, false],
  ['系统运维', '#/system/ops', '系统运维', 0, false],
  ['租户自助门户', '#/portal', '租户自助服务', 0, true],
];

// 乱码特征（与 full-e2e-test.js 保持一致）
const GARBLED = [/\?{3,}/, /[\x00-\x08\x0b\x0c\x0e-\x1f]/, /\uFFFD/, /锟斤拷/];

let pass = 0;
const failures = [];
function check(name, cond, detail) {
  if (cond) { pass++; console.log('PASS: ' + name + (detail ? '  => ' + detail : '')); }
  else { failures.push(name); console.log('FAIL: ' + name + (detail ? '  => ' + detail : '')); }
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ locale: 'zh-CN', viewport: { width: 1600, height: 1000 } });
  const page = await context.newPage();

  let jsErrors = [];
  page.on('pageerror', (e) => jsErrors.push(String(e.message || e).slice(0, 120)));
  page.on('console', (m) => { if (m.type() === 'error') jsErrors.push(m.text().slice(0, 120)); });

  await page.goto(BASE + '/#/login', { waitUntil: 'networkidle', timeout: 60000 });
  await page.fill('input[placeholder="请输入用户名"]', 'admin');
  await page.fill('input[placeholder="请输入密码"]', 'admin123');
  await page.click('button:has-text("登 录")');
  await page.waitForTimeout(2500);
  check('登录进入系统', page.url().indexOf('/dashboard') >= 0, page.url().split('#')[1]);

  for (let i = 0; i < PAGES.length; i++) {
    const name = PAGES[i][0], hash = PAGES[i][1], keyword = PAGES[i][2];
    const minRows = PAGES[i][3], noMain = PAGES[i][4];
    jsErrors = [];

    await page.evaluate((h) => { window.location.hash = h; }, hash);
    await page.waitForTimeout(2200);

    const scope = (!noMain && (await page.locator('.el-main').count()) > 0)
      ? page.locator('.el-main').first() : page.locator('body');
    const text = await scope.innerText();

    await page.screenshot({ path: path.join(SHOT_DIR, String(i + 1).padStart(2, '0') + '-' + name + '.png') });

    const overlay = await page.locator('vite-error-overlay').count();
    const errToast = await page.locator('.el-message--error').count();
    const garbled = GARBLED.filter((re) => re.test(text));

    check(name + ' 渲染出关键内容「' + keyword + '」', text.indexOf(keyword) >= 0, 'len=' + text.length);
    check(name + ' 无编译/运行时错误', overlay === 0 && jsErrors.length === 0,
      overlay ? 'vite-overlay' : (jsErrors[0] || 'ok'));
    check(name + ' 无接口错误提示', errToast === 0, 'errToast=' + errToast);
    check(name + ' 无乱码', garbled.length === 0, garbled.length ? String(garbled[0]) : 'ok');

    if (minRows > 0) {
      const rows = await page.locator('.el-table__body tr').count();
      check(name + ' 表格有数据行(>=' + minRows + ')', rows >= minRows, 'rows=' + rows);
    }
  }

  await browser.close();
  const total = pass + failures.length;
  console.log('');
  console.log('SUMMARY: ' + pass + '/' + total + ' passed （截图: test-results/uncovered-pages）');
  if (failures.length) { console.log('FAILED: ' + failures.join(' | ')); process.exit(1); }
})().catch((e) => { console.error('ERR:', e); process.exit(2); });
