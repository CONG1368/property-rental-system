import { toChineseAmount, formatDate } from '@/utils/print-service';

interface ReceiptPrintData {
  receiptNo: string;
  tenantName: string;
  propertyName: string;
  amount: number;
  paymentChannel: string;
  paidAt: string;
  period: string;
  transactionNo: string;
  /** 注意：这里**没有** companyName —— 票面不打印甲方公司名（见文件头第 6 条） */
  companyLogo?: string;
  companySeal?: string;
}

/** 转义业务字段，避免租客名/房源名里的尖括号破坏版式或注入标记 */
function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * 80mm 热敏小票模板（203dpi 二值打印优化）
 *
 * 热敏机是 1 位设备（每个点只有黑/白），浏览器吐出的却是带抗锯齿的 8 位灰度位图，
 * 驱动必须再做一次二值化。于是任何「浅色」都会被拆成稀疏网点：小字糊成一团、
 * 橙色金额被打成空心点阵甚至整片消失。本模板的写法都围绕这一条：
 *   1. 只用纯黑 #000。层级只用字号表达（不靠字重），不用灰度、不用彩色；
 *   2. 正文 13px 且**不加粗**（用户 2026-09-13 实机要求）：加粗在热敏纸上笔画互相挤压、容易糊成一片，
 *      去掉加粗反而更清爽。笔画宽度只靠字号保证——13px 在 203dpi 下字高约 27 个点，
 *      正常字重的横画约 2 个点，二值化后仍不断笔；某台机器若显淡，优先调大字号，不要恢复加粗；
 *   3. 内容宽 60mm。**不要调宽**：用户 80mm 实机在 68mm 时右侧被裁字（收据号/日期/
 *      交易号尾字符被切掉）——Chromium 的页面盒原点与纸边不重合，或驱动的「默认页边距」
 *      覆盖了 @page{margin:0}，会把内容整体右推约 6mm；68mm 正好顶到纸边，60mm 才留出余量。
 *      配套：原生打印路径显式传 margins:{marginType:'none'}（见 electron/main.ts）；
 *   4. 模板只声明 @page margin:0，纸张尺寸交给打印驱动——实测用户的 80mm 驱动纸张
 *      本来就是对的，强行指定反而可能让它按 297mm 长页走纸；导出 PDF 的纸张尺寸
 *      由 print-service 的 withPaperSize() 注入（见那里的注释）；
 *   5. 分隔线用 1px 实线，虚线在二值化后会碎成一行断点；
 *   6. 票面抬头只保留 Logo + 「收款凭证」标题，**不打印甲方（出租方）公司名**——用户 2026-09-13
 *      要求去掉（该名称属内部凭据冗余信息，且占掉票面顶部最显眼的一行）。
 */
export function buildReceiptHTML(data: ReceiptPrintData): string {
  const logoHtml = data.companyLogo
    ? `<img class="logo" src="${esc(data.companyLogo)}" alt="" />`
    : '';

  const sealHtml = data.companySeal
    ? `<img class="seal" src="${esc(data.companySeal)}" alt="" />`
    : '<p class="line">收款人：_______________</p>';

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>收款凭证</title>
<style>
  @page { margin: 0; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body {
    font-family: "Microsoft YaHei", "SimHei", sans-serif;
    color: #000;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .rcpt {
    width: 60mm; margin: 0 auto; padding: 3mm 0 6mm;
    /* 不加粗（用户 2026-09-13 要求）：热敏机上粗体笔画互相挤压易糊版，层级改用字号表达 */
    font-size: 13px; font-weight: 400; line-height: 1.45;
  }
  .rcpt .c { text-align: center; }
  .rcpt .hr { border-top: 1px solid #000; margin: 6px 0; }
  .rcpt table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  .rcpt td { padding: 1px 0; vertical-align: top; word-break: break-all; }
  .rcpt td.k { width: 4.8em; white-space: nowrap; padding-right: 6px; }
  .rcpt td.v { text-align: right; }
  /* 长单号独占整行并允许折行：放进右对齐的窄列会折出「-09-」这种孤零零的尾巴 */
  .rcpt td.no { white-space: normal; word-break: break-all; }
  .rcpt .t2 { font-size: 17px; letter-spacing: 4px; margin: 3px 0; }
  .rcpt .lbl { font-size: 12px; margin: 0; }
  .rcpt .amt { font-size: 27px; letter-spacing: 1px; margin: 4px 0; }
  .rcpt .line { font-size: 13px; margin: 3px 0; }
  .rcpt .sm { font-size: 11px; margin: 2px 0; }
  .rcpt .logo { display: block; max-width: 46mm; max-height: 40px; margin: 0 auto 4px; filter: grayscale(1) contrast(1.4); }
  .rcpt .seal { display: block; max-width: 22mm; max-height: 80px; margin: 4px auto 0; filter: grayscale(1) contrast(1.4); }
</style>
</head>
<body>
<div class="rcpt">
  <div class="c">
    ${logoHtml}
    <div class="t2">收款凭证</div>
  </div>
  <div class="hr"></div>
  <table>
    <tr><td class="no" colspan="2">收据号：${esc(data.receiptNo || '-')}</td></tr>
    <tr><td class="no" colspan="2">日期：${esc(formatDate(data.paidAt || new Date(), 'YYYY-MM-DD HH:mm'))}</td></tr>
    <tr><td class="no" colspan="2">交易号：${esc(data.transactionNo || '-')}</td></tr>
  </table>
  <div class="hr"></div>
  <table>
    <tr><td class="k">租客：</td><td>${esc(data.tenantName || '-')}</td></tr>
    <tr><td class="k">房源：</td><td>${esc(data.propertyName || '-')}</td></tr>
    <tr><td class="k">周期：</td><td>${esc(data.period || '-')}</td></tr>
    <tr><td class="k">方式：</td><td>${esc(data.paymentChannel || '-')}</td></tr>
  </table>
  <div class="hr"></div>
  <div class="c">
    <p class="lbl">收款金额</p>
    <p class="amt">¥${Number(data.amount || 0).toFixed(2)}</p>
    <p class="line">大写：${esc(toChineseAmount(Number(data.amount || 0)))}</p>
  </div>
  <div class="hr"></div>
  <div class="c">${sealHtml}</div>
  <div class="hr"></div>
  <div class="c">
    <p class="sm">本凭证由物业租赁综合管理系统生成</p>
    <p class="sm">打印时间：${esc(formatDate(new Date(), 'YYYY-MM-DD HH:mm:ss'))}</p>
  </div>
</div>
</body>
</html>`;
}
