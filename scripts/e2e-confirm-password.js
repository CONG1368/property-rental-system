const { chromium } = require('@playwright/test');
const base = 'http://localhost:5173';
const API = 'http://localhost:3001/api';

async function apiLogin() {
  const r = await fetch(API + '/auth/login', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ username:'admin', password:'admin123' }) });
  const j = await r.json(); return j.data.accessToken;
}
async function apiCall(method, path, token, body) {
  const r = await fetch(API + path, { method, headers: token ? {'Content-Type':'application/json','Authorization':'Bearer '+token}:{'Content-Type':'application/json'}, body: body?JSON.stringify(body):undefined });
  const t = await r.text(); return { s:r.status, b:t };
}

async function run() {
  const token = await apiLogin();
  const H = {'Content-Type':'application/json','Authorization':'Bearer '+token};
  // 造一张"已开票"发票用于红冲测试(或待开票用于作废)
  const mk = await apiCall('POST','/invoices',token,{title:'E2E确认测试',buyerName:'x',amount:100});
  const invId = JSON.parse(mk.b).data?.id;
  console.log('prepared invoice id:', invId, 'status:', JSON.parse(mk.b).data?.status);

  const browser = await chromium.launch({ headless: true });
  const page = await (await browser.newContext({ locale:'zh-CN', viewport:{width:1920,height:1080} })).newPage();
  const results = [];
  const ok = (n,c,e='')=>results.push((c?'PASS':'FAIL')+' '+n+(e?' — '+e:''));

  await page.goto(base+'/#/login',{waitUntil:'networkidle'});
  await page.fill('input[placeholder="请输入用户名"]','admin');
  await page.fill('input[placeholder="请输入密码"]','admin123');
  await page.click('button[type="submit"], .el-button--primary');
  await page.waitForTimeout(1500);
  await page.goto(base+'/#/finance/invoices',{waitUntil:'networkidle'});
  await page.waitForTimeout(1000);

  // 找到测试发票行(按 title)，点击作废按钮
  // 作废按钮 label "作废"。用行内文本定位
  const row = page.locator('tr', { hasText: 'E2E确认测试' }).first();
  const rowVisible = await row.isVisible().catch(()=>false);
  ok('找到测试发票行', rowVisible);

  if (rowVisible) {
    await row.locator('button:has-text("作废"), .el-button:has-text("作废")').click();
    await page.waitForTimeout(800);
    // 二次确认弹窗应出现(ElMessageBox prompt → .el-message-box)
    const mbVisible = await page.locator('.el-message-box').isVisible().catch(()=>false);
    ok('点击作废弹出二次确认(密码)弹窗', mbVisible);
    if (mbVisible) {
      const hasPwdInput = await page.locator('.el-message-box input[type="password"]').count();
      ok('二次确认弹窗含密码输入框', hasPwdInput > 0);
      // 取消
      await page.locator('.el-message-box__btns button:has-text("取消")').click();
      await page.waitForTimeout(500);
      // 确认取消后仍为待开票
      const afterCancel = await apiCall('GET','/invoices/'+invId,token);
      ok('取消后发票状态未变', JSON.parse(afterCancel.b).data?.status === '待开票');
      // 再次作废并输入正确密码
      await row.locator('button:has-text("作废"), .el-button:has-text("作废")').click();
      await page.waitForTimeout(800);
      await page.locator('.el-message-box input[type="password"]').fill('admin123');
      await page.locator('.el-message-box__btns button:has-text("确认")').click();
      await page.waitForTimeout(1000);
      const afterVoid = await apiCall('GET','/invoices/'+invId,token);
      ok('输入正确密码后作废成功', JSON.parse(afterVoid.b).data?.status === '已作废', JSON.parse(afterVoid.b).data?.status);
    }
  }

  // 清理
  await apiCall('DELETE','/invoices/'+invId,token,{confirmPassword:'admin123'});
  console.log(results.join('\n'));
  const fails = results.filter(r=>r.startsWith('FAIL'));
  await browser.close();
  process.exit(fails.length?1:0);
}
run().catch(e=>{console.error('RUN ERROR:', e.message); process.exit(1);});
