const { chromium } = require('@playwright/test');
const path = require('path'); const fs = require('fs');
const OUT = path.resolve(__dirname, '../test-results/new-modules'); if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
const PAGES = [
  ['租客征信','#/rent/tenant-credit'],['押金台账','#/rent/deposits'],['退租管理','#/rent/checkouts'],['招租线索','#/rent/leads'],['入住交接','#/rent/move-ins'],['租金定价','#/rent/pricing'],
  ['运营看板','#/property/ops-dashboard'],['租户服务','#/property/tenant-portal'],['项目管理','#/property/projects'],['经营简报','#/property/business-briefing'],['月度简报','#/property/briefing-archive'],['装修管理','#/property/decorations'],['维保计划','#/property/maintenance-plans'],['排班质检','#/property/property-tasks'],['巡更管理','#/property/patrols'],['访客管理','#/property/visitors'],['特种设备','#/property/equipment-certifications'],['报修工单','#/property/work-orders'],['设施设备','#/property/facilities'],['抄表计费','#/property/meters'],['停车管理','#/property/parking'],['投诉建议','#/property/complaints'],['住户档案','#/property/residents'],['公告发布','#/property/announcements'],['公共收益','#/property/common-revenues'],['外包供应商','#/property/vendors'],['仓库物料','#/property/inventory'],
  ['固定资产','#/finance/fixed-assets'],['银行对账','#/finance/bank-reconciliation'],['成本分摊','#/finance/cost-allocation'],['发票管理','#/finance/invoices'],
  ['审批流程','#/system/approval-flows'],['全局检索','#/search'],['审批中心','#/approval-center'],
];
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await (await browser.newContext({ locale: 'zh-CN', viewport: { width: 1920, height: 1080 } })).newPage();
  let errors = [];
  page.on('pageerror', e => errors.push(String(e).slice(0,80)));
  // 登录（可重复调用）：dev 模式 Vite 发现新依赖会整页 reload，
  // 而 main.ts 启动时清空 token，会把用例踢回登录页，故需自动重登兜底
  const login = async () => {
    await page.goto('http://localhost:5173/#/login', { waitUntil: 'networkidle' });
    await page.fill('input[placeholder="请输入用户名"]', 'admin');
    await page.fill('input[placeholder="请输入密码"]', 'admin123');
    await page.click('button:has-text("登 录")');
    await page.waitForTimeout(2500);
  };
  await login();
  let pass = 0, fail = 0; const failed = [];
  for (const [name, hash] of PAGES) {
    errors = [];
    await page.evaluate(h => { window.location.hash = h; }, hash);
    await page.waitForTimeout(1700);
    if (page.url().includes('/login')) {   // 被 reload 踢回登录页 → 重登后重试
      await login();
      await page.evaluate(h => { window.location.hash = h; }, hash);
      await page.waitForTimeout(1700);
    }
    let bad = await page.locator('vite-error-overlay').count();
    let hasContent = (await page.locator('body').innerText()).length > 40;
    // dev 模式下首次访问某路由要等 Vite 现编译，偶发超时；失败先重试一次再判定，
    // 真坏的页面两次都会坏，只有编译延迟会被这次重试吸收
    if (bad || !hasContent || errors.length) {
      errors.length = 0;
      await page.evaluate(h => { window.location.hash = '#/dashboard'; }, hash);
      await page.waitForTimeout(500);
      await page.evaluate(h => { window.location.hash = h; }, hash);
      await page.waitForTimeout(3000);
      bad = await page.locator('vite-error-overlay').count();
      hasContent = (await page.locator('body').innerText()).length > 40;
    }
    if (!bad && hasContent && errors.length === 0) { pass++; }
    else { fail++; failed.push(name + (bad?'(overlay)':'') + (errors.length?'(err:'+errors[0]+')':'')); }
  }
  console.log('新增模块回归: 通过', pass, '失败', fail);
  if (failed.length) console.log('失败页:', failed.join(', '));
  await browser.close();
  process.exit(fail > 0 ? 1 : 0);
})();