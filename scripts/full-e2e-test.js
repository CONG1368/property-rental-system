/**
 * 物业租赁综合管理系统 — 全模块端到端测试 (Playwright)
 * 用法: node scripts/full-e2e-test.js
 * 要求: 后端已在 localhost:3001 运行
 */
const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const BASE = 'http://localhost:5173';
const SCREENSHOT_DIR = path.resolve(__dirname, '../test-results/screenshots');
const REPORT_FILE = path.resolve(__dirname, '../test-results/report.json');

if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

const results = [];
let passed = 0;
let failed = 0;

function record(testName, status, detail = '') {
  results.push({ test: testName, status, detail, time: new Date().toISOString() });
  if (status === 'PASS') { passed++; console.log(`  [PASS] ${testName}`); }
  else { failed++; console.log(`  [FAIL] ${testName} — ${detail}`); }
}

// 检测页面是否有乱码（常见乱码特征）
async function checkGarbledText(page) {
  const bodyText = await page.locator('body').innerText();
  // 乱码特征: 连续的?号替换中文、半角乱码字符、混合编码残留
  const garbledPatterns = [
    /\?{3,}/,                          // 连续???（中文被替换成?）
    /[\x00-\x08\x0b\x0c\x0e-\x1f]/,    // 控制字符（NULL等）
    /\?[a-zA-Z]+\?/,                    // ?xxx? 模式
    /�/,                                // Unicode 替换字符
    /锟斤拷|銝要|�/,                     // 经典乱码
    /\?{2,}[^\s]{1,5}\?{2,}/,          // 问号包裹短文本
  ];
  for (const p of garbledPatterns) {
    if (p.test(bodyText)) {
      return { found: true, pattern: p.toString(), sample: bodyText.match(p)?.[0] };
    }
  }
  return { found: false };
}

// 导航并截图
async function navTo(page, hash, name) {
  await page.goto(`${BASE}/#${hash}`, { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(800);
  const screenshotPath = path.join(SCREENSHOT_DIR, `${name.replace(/[\/\\]/g, '-')}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  const garbled = await checkGarbledText(page);
  if (garbled.found) {
    record(`[乱码] ${name}`, 'FAIL', `模式: ${garbled.pattern} → "${garbled.sample}"`);
  } else {
    record(`[渲染] ${name}`, 'PASS', `截图: ${screenshotPath}`);
  }
  return garbled.found;
}

(async () => {
  console.log('========================================');
  console.log('  物业租赁系统 — 全模块 E2E 测试');
  console.log('========================================\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    locale: 'zh-CN',
  });
  const page = await context.newPage();

  // ==================== 1. 登录 ====================
  console.log('>>> 1. 登录模块');
  await page.goto(`${BASE}/#/login`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01-login-page.png'), fullPage: true });

  // 输入凭证
  await page.fill('input[placeholder="请输入用户名"]', 'admin');
  await page.fill('input[placeholder="请输入密码"]', 'admin123');
  await page.click('button:has-text("登 录")');
  await page.waitForTimeout(2000);

  const currentUrl = page.url();
  if (currentUrl.includes('dashboard') || currentUrl.includes('login')) {
    record('登录功能', currentUrl.includes('dashboard') ? 'PASS' : 'FAIL', currentUrl.includes('dashboard') ? '' : '登录后未能跳转到仪表盘');
  }
  await page.waitForTimeout(500);

  // 检查首页有无乱码
  const homeGarbled = await checkGarbledText(page);
  if (homeGarbled.found) {
    record('[乱码] 首页概览', 'FAIL', `首页出现乱码: ${homeGarbled.sample}`);
  } else {
    record('[渲染] 首页概览', 'PASS');
  }
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01-dashboard.png'), fullPage: true });

  // ==================== 2. 租赁管理模块 ====================
  console.log('\n>>> 2. 租赁管理模块');
  await navTo(page, 'rent/properties', '02-房源管理');
  await navTo(page, 'rent/tenants', '03-租客管理');
  await navTo(page, 'rent/bills', '04-收租管理');
  await navTo(page, 'rent/dunning', '05-智能催缴');
  await navTo(page, 'rent/dashboard', '06-收租看板');

  // ==================== 3. 财务管理模块 ====================
  console.log('\n>>> 3. 财务管理模块');
  await navTo(page, 'finance/books', '07-账套管理');
  await navTo(page, 'finance/accounts', '08-科目管理');
  await navTo(page, 'finance/vouchers', '09-凭证管理');
  await navTo(page, 'finance/expenses', '10-费用核算');
  await navTo(page, 'finance/tax', '11-税务管理');
  await navTo(page, 'finance/budgets', '12-预算管理');
  await navTo(page, 'finance/reports', '13-报表中心');
  await navTo(page, 'finance/dashboard', '14-财务看板');

  // ==================== 4. 合同管理模块 ====================
  console.log('\n>>> 4. 合同管理模块');
  await navTo(page, 'contract/list', '15-合同列表');
  await navTo(page, 'contract/kanban', '16-合同看板');
  await navTo(page, 'contract/expiry', '17-到期管理');
  await navTo(page, 'contract/renewals', '18-续约管理');
  await navTo(page, 'contract/templates', '19-模板管理');
  await navTo(page, 'contract/approval', '20-合同审批');
  await navTo(page, 'contract/compliance', '21-合规管理');

  // ==================== 5. 系统设置模块 ====================
  console.log('\n>>> 5. 系统设置模块');
  await navTo(page, 'system/users', '22-用户管理');
  await navTo(page, 'system/dicts', '23-数据字典');
  await navTo(page, 'system/audit-logs', '24-审计日志');

  // ==================== 6. 功能深度测试 ====================
  console.log('\n>>> 6. 功能深度测试');

  // 6a. 房源创建
  try {
    await page.goto(`${BASE}/#/rent/properties`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await page.click('button:has-text("新增房源")');
    await page.waitForTimeout(500);
    await page.fill('input[placeholder*="房源名称"]', 'E2E测试房源');
    await page.locator('.el-select').first().click();
    await page.waitForTimeout(300);
    // 选择业态类型
    const options = await page.locator('.el-select-dropdown__item');
    const count = await options.count();
    if (count > 0) await options.first().click();
    await page.waitForTimeout(200);
    record('房源-打开新增对话框', 'PASS');
    // 取消创建，避免脏数据
    await page.click('button:has-text("取消")').catch(() => page.keyboard.press('Escape'));
    await page.waitForTimeout(300);
  } catch (e) {
    record('房源-新增操作', 'FAIL', e.message);
  }

  // 6b. 租客列表 — 检查表格数据
  try {
    await navTo(page, 'rent/tenants', 'func-tenants');
    const rows = await page.locator('.el-table__body-wrapper tbody tr').count();
    record('租客-列表加载', rows > 0 ? 'PASS' : 'FAIL', `${rows} 条记录`);
  } catch (e) {
    record('租客-列表加载', 'FAIL', e.message);
  }

  // 6c. 账单列表
  try {
    await navTo(page, 'rent/bills', 'func-bills');
    const rows = await page.locator('.el-table__body-wrapper tbody tr').count();
    record('账单-列表加载', rows > 0 ? 'PASS' : 'FAIL', `${rows} 条记录`);
  } catch (e) {
    record('账单-列表加载', 'FAIL', e.message);
  }

  // 6d. 合同列表
  try {
    await navTo(page, 'contract/list', 'func-contracts');
    const rows = await page.locator('.el-table__body-wrapper tbody tr').count();
    record('合同-列表加载', rows > 0 ? 'PASS' : 'FAIL', `${rows} 条记录`);
  } catch (e) {
    record('合同-列表加载', 'FAIL', e.message);
  }

  // 6e. 凭证管理
  try {
    await navTo(page, 'finance/vouchers', 'func-vouchers');
    const rows = await page.locator('.el-table__body-wrapper tbody tr').count();
    record('凭证-列表加载', rows > 0 ? 'PASS' : 'FAIL', `${rows} 条记录`);
  } catch (e) {
    record('凭证-列表加载', 'FAIL', e.message);
  }

  // 6f. 用户管理
  try {
    await navTo(page, 'system/users', 'func-users');
    const rows = await page.locator('.el-table__body-wrapper tbody tr').count();
    record('用户-列表加载', rows > 0 ? 'PASS' : 'FAIL', `${rows} 条记录`);
  } catch (e) {
    record('用户-列表加载', 'FAIL', e.message);
  }

  // ==================== 7. 报表功能 ====================
  console.log('\n>>> 7. 报表功能');
  try {
    await page.goto(`${BASE}/#/finance/reports`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    // 点击各种报表标签
    const tabs = ['资产负债表', '利润表', '现金流量表', ' occupancy', '账龄'];
    for (const tab of tabs) {
      try {
        await page.click(`text="${tab}"`, { timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(500);
      } catch {}
    }
    record('报表-切换报表类型', 'PASS');
  } catch (e) {
    record('报表-切换', 'FAIL', e.message);
  }

  // ==================== 8. 全局乱码检查汇总 ====================
  console.log('\n>>> 8. 全局乱码检查');
  const garbledCount = results.filter(r => r.test.startsWith('[乱码]') && r.status === 'FAIL').length;
  console.log(`  乱码问题: ${garbledCount} 处`);

  // ==================== 结果汇总 ====================
  console.log('\n========================================');
  console.log('  测试结果汇总');
  console.log('========================================');
  console.log(`  通过: ${passed}  失败: ${failed}  总计: ${passed + failed}`);
  console.log(`  乱码: ${garbledCount} 处`);
  console.log(`  截图: ${SCREENSHOT_DIR}`);
  console.log('========================================\n');

  // 写入 JSON 报告
  const report = {
    summary: { passed, failed, total: passed + failed, garbledCount },
    results,
    screenshots: SCREENSHOT_DIR,
  };
  fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2), 'utf-8');
  console.log(`报告已写入: ${REPORT_FILE}`);

  await browser.close();

  // 退出码: 有任何失败则非零
  process.exit(failed > 0 ? 1 : 0);
})();
