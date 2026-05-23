import { toChineseAmount, formatDate } from '@/utils/print-service';

interface BillPrintData {
  billNo: string;
  period: string;
  tenantName: string;
  propertyName: string;
  rentAmount: number;
  waterFee: number;
  electricFee: number;
  utilityAmount: number;
  propertyFee: number;
  otherAmount: number;
  lateFee: number;
  totalAmount: number;
  dueDate: string;
  status: string;
  paidDate: string | null;
  paymentChannel: string | null;
  companyName: string;
  companyLogo?: string;
}

export function buildBillHTML(data: BillPrintData): string {
  const logoHtml = data.companyLogo
    ? `<img src="${data.companyLogo}" style="max-width:200px;max-height:60px;margin-bottom:8px" crossorigin="anonymous" />`
    : '';

  const items = [
    { label: '房租', amount: data.rentAmount },
    { label: '水费', amount: data.waterFee },
    { label: '电费', amount: data.electricFee },
    { label: '物业费', amount: data.propertyFee },
    { label: '其他费用', amount: data.otherAmount },
    { label: '滞纳金', amount: data.lateFee },
  ].filter(item => item.amount > 0 || item.label === '房租');

  const rows = items.map(item => `
    <tr>
      <td style="padding:6px 10px;border:1px solid #e0e0e0">${item.label}</td>
      <td style="padding:6px 10px;border:1px solid #e0e0e0;text-align:right">¥${item.amount.toFixed(2)}</td>
    </tr>`).join('');

  return `<div style="max-width:700px;margin:0 auto;line-height:2">
    <div style="text-align:center;margin-bottom:20px">
      ${logoHtml}
      <h1 style="margin:8px 0 4px;font-size:20px;color:#0A3D62">账单明细</h1>
      <p style="font-size:12px;color:#909399">账单编号：${data.billNo} &nbsp;|&nbsp; 账单周期：${data.period}</p>
    </div>

    <div style="font-size:13px;margin:12px 0;padding:10px 12px;background:#f5f7fa;border-radius:4px">
      <span style="margin-right:24px"><b>租客：</b>${data.tenantName}</span>
      <span style="margin-right:24px"><b>房源：</b>${data.propertyName}</span>
      <span><b>到期日：</b>${formatDate(data.dueDate)}</span>
    </div>

    <table style="width:100%;border-collapse:collapse;font-size:13px;margin:16px 0">
      <tr style="background:#f9fafb">
        <th style="padding:6px 10px;border:1px solid #e0e0e0;text-align:left">费用项目</th>
        <th style="padding:6px 10px;border:1px solid #e0e0e0;text-align:right;width:140px">金额</th>
      </tr>
      ${rows}
      <tr style="font-weight:bold;background:#f0f5ff">
        <td style="padding:8px 10px;border:1px solid #e0e0e0">合计（大写：${toChineseAmount(data.totalAmount)}）</td>
        <td style="padding:8px 10px;border:1px solid #e0e0e0;text-align:right;font-size:14px;color:#E6A23C">¥${data.totalAmount.toFixed(2)}</td>
      </tr>
    </table>

    <div style="font-size:13px;margin:16px 0">
      <p><b>缴纳状态：</b>${data.status}</p>
      ${data.paidDate ? `<p><b>缴纳日期：</b>${formatDate(data.paidDate)}</p>` : ''}
      ${data.paymentChannel ? `<p><b>缴纳方式：</b>${data.paymentChannel}</p>` : ''}
    </div>

    <div style="font-size:12px;color:#909399;margin-top:20px;padding-top:12px;border-top:1px dashed #e0e0e0">
      <p>备注：请在到期日前完成缴纳，逾期将按合同约定收取滞纳金。如有疑问请联系${data.companyName}。</p>
    </div>

    <p style="text-align:center;font-size:11px;color:#999;margin-top:20px">打印日期：${formatDate(new Date())} &nbsp;|&nbsp; ${data.companyName}</p>
  </div>`;
}
