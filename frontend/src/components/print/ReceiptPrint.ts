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

export function buildReceiptHTML(data: ReceiptPrintData): string {
  const logoHtml = data.companyLogo
    ? `<img src="${data.companyLogo}" style="max-width:160px;max-height:48px;margin:0 auto 6px;display:block" crossorigin="anonymous" />`
    : '';

  const sealHtml = data.companySeal
    ? `<img src="${data.companySeal}" style="max-width:80px;max-height:80px;margin-top:8px" crossorigin="anonymous" />`
    : '<p style="font-size:12px;color:#999;margin-top:16px">收款人：_______________</p>';

  return `<div style="width:270px;margin:0 auto;font-size:11px;line-height:1.8;font-family:'Microsoft YaHei','SimHei',sans-serif">
    <div style="text-align:center;margin-bottom:12px">
      ${logoHtml}
      <h2 style="margin:4px 0;font-size:16px;color:#333;letter-spacing:2px">${data.companyName}</h2>
      <h3 style="margin:2px 0;font-size:14px;color:#0A3D62;letter-spacing:2px">收款凭证</h3>
    </div>

    <div style="border-top:1px dashed #999;border-bottom:1px dashed #999;padding:10px 0;margin:8px 0">
      <table style="width:100%;font-size:11px">
        <tr><td style="padding:2px 0">收据号：</td><td style="text-align:right">${data.receiptNo}</td></tr>
        <tr><td style="padding:2px 0">日期：</td><td style="text-align:right">${formatDate(data.paidAt || new Date(), 'YYYY-MM-DD HH:mm')}</td></tr>
        <tr><td style="padding:2px 0">交易号：</td><td style="text-align:right;font-size:10px">${data.transactionNo}</td></tr>
      </table>
    </div>

    <table style="width:100%;font-size:11px;margin:8px 0">
      <tr><td style="padding:2px 0;width:50px">租客：</td><td>${data.tenantName}</td></tr>
      <tr><td style="padding:2px 0">房源：</td><td>${data.propertyName}</td></tr>
      <tr><td style="padding:2px 0">周期：</td><td>${data.period}</td></tr>
      <tr><td style="padding:2px 0">方式：</td><td>${data.paymentChannel}</td></tr>
    </table>

    <div style="text-align:center;margin:12px 0;padding:8px 0;border-top:1px solid #ddd;border-bottom:1px solid #ddd">
      <p style="font-size:10px;color:#999;margin:0">收款金额</p>
      <p style="font-size:24px;font-weight:bold;color:#E6A23C;margin:4px 0;letter-spacing:2px">¥${data.amount.toFixed(2)}</p>
      <p style="font-size:11px;color:#666;margin:2px 0">大写：${toChineseAmount(data.amount)}</p>
    </div>

    <div style="text-align:center;margin-top:16px">
      ${sealHtml}
    </div>

    <div style="border-top:1px dashed #999;margin-top:12px;padding-top:6px;text-align:center">
      <p style="font-size:9px;color:#999;margin:2px 0">本凭证由物业租赁综合管理系统生成</p>
      <p style="font-size:9px;color:#999;margin:2px 0">打印时间：${formatDate(new Date(), 'YYYY-MM-DD HH:mm:ss')}</p>
    </div>
  </div>`;
}
