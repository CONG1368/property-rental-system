import { formatDate } from '@/utils/print-service';

interface TenantPrintData {
  name: string;
  idType: string;
  idNumber: string;
  phone: string;
  email: string;
  wechat: string;
  contactPerson: string;
  creditScore: number | null;
  creditGrade: string;
  status: string;
  notes: string;
  contracts: Array<{
    contractNo: string;
    rentAmount: number;
    startDate: string;
    endDate: string;
    status: string;
  }>;
  companyName: string;
  companyLogo?: string;
}

export function buildTenantInfoHTML(data: TenantPrintData): string {
  const logoHtml = data.companyLogo
    ? `<img src="${data.companyLogo}" style="max-width:200px;max-height:60px;margin-bottom:8px" crossorigin="anonymous" />`
    : '';

  const contractRows = data.contracts.length > 0
    ? data.contracts.map(c => `
      <tr>
        <td style="padding:4px 8px;border:1px solid #e0e0e0">${c.contractNo}</td>
        <td style="padding:4px 8px;border:1px solid #e0e0e0;text-align:right">¥${c.rentAmount.toFixed(2)}</td>
        <td style="padding:4px 8px;border:1px solid #e0e0e0">${formatDate(c.startDate)}</td>
        <td style="padding:4px 8px;border:1px solid #e0e0e0">${formatDate(c.endDate)}</td>
        <td style="padding:4px 8px;border:1px solid #e0e0e0">${c.status}</td>
      </tr>`).join('')
    : `<tr><td colspan="5" style="padding:12px;text-align:center;color:#999">暂无关联合同</td></tr>`;

  return `<div style="max-width:700px;margin:0 auto;line-height:2">
    <div style="text-align:center;margin-bottom:20px">
      ${logoHtml}
      <h1 style="margin:8px 0 4px;font-size:20px;color:#0A3D62">租客信息表</h1>
      <p style="font-size:12px;color:#909399">打印日期：${formatDate(new Date())}</p>
    </div>

    <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:20px">
      <tr><td style="padding:6px 10px;border:1px solid #e0e0e0;background:#f9fafb;width:120px">姓名</td>
          <td style="padding:6px 10px;border:1px solid #e0e0e0;width:230px">${data.name}</td>
          <td style="padding:6px 10px;border:1px solid #e0e0e0;background:#f9fafb;width:120px">状态</td>
          <td style="padding:6px 10px;border:1px solid #e0e0e0">${data.status}</td></tr>
      <tr><td style="padding:6px 10px;border:1px solid #e0e0e0;background:#f9fafb">证件类型</td>
          <td style="padding:6px 10px;border:1px solid #e0e0e0">${data.idType}</td>
          <td style="padding:6px 10px;border:1px solid #e0e0e0;background:#f9fafb">证件号码</td>
          <td style="padding:6px 10px;border:1px solid #e0e0e0">${data.idNumber}</td></tr>
      <tr><td style="padding:6px 10px;border:1px solid #e0e0e0;background:#f9fafb">电话</td>
          <td style="padding:6px 10px;border:1px solid #e0e0e0">${data.phone}</td>
          <td style="padding:6px 10px;border:1px solid #e0e0e0;background:#f9fafb">邮箱</td>
          <td style="padding:6px 10px;border:1px solid #e0e0e0">${data.email || '-'}</td></tr>
      <tr><td style="padding:6px 10px;border:1px solid #e0e0e0;background:#f9fafb">微信</td>
          <td style="padding:6px 10px;border:1px solid #e0e0e0">${data.wechat || '-'}</td>
          <td style="padding:6px 10px;border:1px solid #e0e0e0;background:#f9fafb">紧急联系人</td>
          <td style="padding:6px 10px;border:1px solid #e0e0e0">${data.contactPerson || '-'}</td></tr>
      <tr><td style="padding:6px 10px;border:1px solid #e0e0e0;background:#f9fafb">信用评分</td>
          <td style="padding:6px 10px;border:1px solid #e0e0e0">${data.creditScore != null ? data.creditScore + ' 分' : '-'}</td>
          <td style="padding:6px 10px;border:1px solid #e0e0e0;background:#f9fafb">信用等级</td>
          <td style="padding:6px 10px;border:1px solid #e0e0e0">${data.creditGrade || '-'}</td></tr>
    </table>

    ${data.notes ? `<p style="font-size:13px;margin:8px 0 16px"><b>备注：</b>${data.notes}</p>` : ''}

    <h3 style="font-size:14px;margin:16px 0 8px;color:#0A3D62">关联合同</h3>
    <table style="width:100%;border-collapse:collapse;font-size:12px">
      <tr style="background:#f9fafb">
        <th style="padding:6px 8px;border:1px solid #e0e0e0;text-align:left">合同编号</th>
        <th style="padding:6px 8px;border:1px solid #e0e0e0;text-align:right">月租金</th>
        <th style="padding:6px 8px;border:1px solid #e0e0e0;text-align:left">开始日期</th>
        <th style="padding:6px 8px;border:1px solid #e0e0e0;text-align:left">结束日期</th>
        <th style="padding:6px 8px;border:1px solid #e0e0e0;text-align:left">状态</th>
      </tr>
      ${contractRows}
    </table>

    <p style="text-align:center;font-size:11px;color:#999;margin-top:30px">本文件由 ${data.companyName} 通过物业租赁综合管理系统生成</p>
  </div>`;
}
