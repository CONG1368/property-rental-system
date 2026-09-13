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
  companyName: string;
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
 *   1. 只用纯黑 #000。层级靠字号 + 字重表达，不用灰度、不用彩色；
 *   2. 正文 13px 且加粗，笔画在 203dpi 下 ≥2 个点，二值化后不断笔；
 *   3. 内容宽 68mm，小于 80mm 机型的 72mm 可打印区，避免驱动缩放或裁边；
 *   4. 模板只声明 @page margin:0，纸张尺寸交给打印驱动——实测用户的 80mm 驱动纸张
 *      本来就是对的，强行指定反而可能让它按 297mm 长页走纸；导出 PDF 的纸张尺寸
 *      由 print-service 的 withPaperSize() 注入（见那里的注释）；
 *   5. 分隔线用 1px 实线，虚线在二值化后会碎成一行断点。
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
    width: 68mm; margin: 0 auto; padding: 3mm 0 6mm;
    font-size: 13px; font-weight: 700; line-height: 1.45;
  }
  .rcpt .c { text-align: center; }
  .rcpt .hr { border-top: 1px solid #000; margin: 6px 0; }
  .rcpt table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  .rcpt td { padding: 1px 0; vertical-align: top; word-break: break-all; }
  .rcpt td.k { width: 4.8em; white-space: nowrap; padding-right: 6px; }
  .rcpt td.v { text-align: right; }
  .rcpt .t1 { font-size: 15px; letter-spacing: 1px; margin: 3px 0; }
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
    <div class="t1">${esc(data.companyName || '物业租赁管理公司')}</div>
    <div class="t2">收款凭证</div>
  </div>
  <div class="hr"></div>
  <table>
    <tr><td class="k">收据号：</td><td class="v">${esc(data.receiptNo || '-')}</td></tr>
    <tr><td class="k">日期：</td><td class="v">${esc(formatDate(data.paidAt || new Date(), 'YYYY-MM-DD HH:mm'))}</td></tr>
    <tr><td class="k">交易号：</td><td class="v">${esc(data.transactionNo || '-')}</td></tr>
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
