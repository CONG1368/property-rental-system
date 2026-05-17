import { formatDate } from '@/utils/print-service';

interface BatchContractItem {
  contractNo: string;
  tenantName: string;
  propertyName: string;
  rentAmount: number;
  depositAmount: number;
  startDate: string;
  endDate: string;
  status: string;
}

interface BatchPrintData {
  contracts: BatchContractItem[];
  companyName: string;
  companyLogo?: string;
}

export function buildBatchContractHTML(data: BatchPrintData): string {
  const logoHtml = data.companyLogo
    ? `<img src="${data.companyLogo}" style="max-width:200px;max-height:60px;margin-bottom:8px" crossorigin="anonymous" />`
    : '';

  const rows = data.contracts.map(c => `
    <tr>
      <td style="padding:5px 8px;border:1px solid #e0e0e0">${c.contractNo}</td>
      <td style="padding:5px 8px;border:1px solid #e0e0e0">${c.tenantName}</td>
      <td style="padding:5px 8px;border:1px solid #e0e0e0">${c.propertyName}</td>
      <td style="padding:5px 8px;border:1px solid #e0e0e0;text-align:right">¥${c.rentAmount.toFixed(2)}</td>
      <td style="padding:5px 8px;border:1px solid #e0e0e0;text-align:right">¥${c.depositAmount.toFixed(2)}</td>
      <td style="padding:5px 8px;border:1px solid #e0e0e0">${formatDate(c.startDate)}</td>
      <td style="padding:5px 8px;border:1px solid #e0e0e0">${formatDate(c.endDate)}</td>
      <td style="padding:5px 8px;border:1px solid #e0e0e0">${c.status}</td>
    </tr>`).join('');

  return `<div style="max-width:700px;margin:0 auto;line-height:2">
    <div style="text-align:center;margin-bottom:20px">
      ${logoHtml}
      <h1 style="margin:8px 0 4px;font-size:20px;color:#0A3D62">合同汇总表</h1>
      <p style="font-size:12px;color:#909399">共 ${data.contracts.length} 份合同 &nbsp;|&nbsp; 打印日期：${formatDate(new Date())}</p>
    </div>

    <table style="width:100%;border-collapse:collapse;font-size:11px">
      <tr style="background:#f9fafb">
        <th style="padding:6px 8px;border:1px solid #e0e0e0;text-align:left">合同编号</th>
        <th style="padding:6px 8px;border:1px solid #e0e0e0;text-align:left">租客</th>
        <th style="padding:6px 8px;border:1px solid #e0e0e0;text-align:left">房源</th>
        <th style="padding:6px 8px;border:1px solid #e0e0e0;text-align:right">月租金</th>
        <th style="padding:6px 8px;border:1px solid #e0e0e0;text-align:right">押金</th>
        <th style="padding:6px 8px;border:1px solid #e0e0e0;text-align:left">开始</th>
        <th style="padding:6px 8px;border:1px solid #e0e0e0;text-align:left">到期</th>
        <th style="padding:6px 8px;border:1px solid #e0e0e0;text-align:left">状态</th>
      </tr>
      ${rows}
    </table>

    <p style="text-align:center;font-size:11px;color:#999;margin-top:30px">${data.companyName} &nbsp;|&nbsp; 本文件由物业租赁综合管理系统生成</p>
  </div>`;
}
