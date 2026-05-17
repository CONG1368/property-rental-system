import { toChineseAmount, formatDate } from '@/utils/print-service';

interface ContractPrintData {
  contractNo: string;
  propertyName: string;
  propertyAddress: string;
  propertyArea: number;
  tenantName: string;
  tenantIdType: string;
  tenantIdNumber: string;
  tenantPhone: string;
  startDate: string;
  endDate: string;
  rentAmount: number;
  depositAmount: number;
  paymentCycle: string;
  waterFee: number;
  electricFee: number;
  propertyFee: number;
  status: string;
  notes: string;
  companyName: string;
  companyLogo?: string;
  companySeal?: string;
}

export function buildContractHTML(data: ContractPrintData): string {
  const sealBlock = (label: string, imgSrc?: string) => {
    if (imgSrc) {
      return `<div style="text-align:center;margin-top:10px">
        <img src="${imgSrc}" style="max-width:160px;max-height:160px" crossorigin="anonymous" />
        <p style="margin:4px 0 0;font-size:12px;color:#666">(${label})</p>
      </div>`;
    }
    return `<div style="text-align:center;margin-top:10px">
      <p style="font-size:14px;color:#333;margin:20px 0">${label}：_______________</p>
      <p style="font-size:12px;color:#666">日期：____年____月____日</p>
    </div>`;
  };

  const logoHtml = data.companyLogo
    ? `<img src="${data.companyLogo}" style="max-width:200px;max-height:60px;margin-bottom:8px" crossorigin="anonymous" />`
    : '';

  return `<div style="max-width:700px;margin:0 auto;line-height:2">
    <div style="text-align:center;margin-bottom:20px">
      ${logoHtml}
      <h1 style="margin:8px 0 4px;font-size:22px;color:#0A3D62;letter-spacing:4px">物业租赁合同</h1>
      <p style="font-size:12px;color:#909399">合同编号：${data.contractNo} &nbsp;|&nbsp; 状态：${data.status}</p>
    </div>

    <div style="font-size:13px;margin:16px 0;padding:12px;background:#f5f7fa;border-radius:4px">
      <p><b>出租方（甲方）：</b>${data.companyName}</p>
      <p><b>承租方（乙方）：</b>${data.tenantName}</p>
      <p><b>证件类型/号码：</b>${data.tenantIdType} / ${data.tenantIdNumber}</p>
      <p><b>联系电话：</b>${data.tenantPhone}</p>
    </div>

    <div style="font-size:13px;margin:16px 0">
      <h3 style="font-size:14px;margin:12px 0 8px;color:#0A3D62">一、租赁物业</h3>
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <tr><td style="padding:4px 8px;border:1px solid #e0e0e0;background:#f9fafb;width:100px">房源名称</td>
          <td style="padding:4px 8px;border:1px solid #e0e0e0">${data.propertyName}</td></tr>
        <tr><td style="padding:4px 8px;border:1px solid #e0e0e0;background:#f9fafb">地址</td>
          <td style="padding:4px 8px;border:1px solid #e0e0e0">${data.propertyAddress}</td></tr>
        <tr><td style="padding:4px 8px;border:1px solid #e0e0e0;background:#f9fafb">面积</td>
          <td style="padding:4px 8px;border:1px solid #e0e0e0">${data.propertyArea} ㎡</td></tr>
      </table>
    </div>

    <div style="font-size:13px;margin:16px 0">
      <h3 style="font-size:14px;margin:12px 0 8px;color:#0A3D62">二、租赁期限</h3>
      <p>租赁期限自 <b>${formatDate(data.startDate)}</b> 至 <b>${formatDate(data.endDate)}</b>。</p>
    </div>

    <div style="font-size:13px;margin:16px 0">
      <h3 style="font-size:14px;margin:12px 0 8px;color:#0A3D62">三、租金及费用</h3>
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <tr><td style="padding:4px 8px;border:1px solid #e0e0e0;background:#f9fafb;width:120px">月租金</td>
          <td style="padding:4px 8px;border:1px solid #e0e0e0">¥${data.rentAmount.toFixed(2)}（大写：${toChineseAmount(data.rentAmount)}）</td></tr>
        <tr><td style="padding:4px 8px;border:1px solid #e0e0e0;background:#f9fafb">押金</td>
          <td style="padding:4px 8px;border:1px solid #e0e0e0">¥${data.depositAmount.toFixed(2)}（大写：${toChineseAmount(data.depositAmount)}）</td></tr>
        <tr><td style="padding:4px 8px;border:1px solid #e0e0e0;background:#f9fafb">付款周期</td>
          <td style="padding:4px 8px;border:1px solid #e0e0e0">${data.paymentCycle}</td></tr>
        <tr><td style="padding:4px 8px;border:1px solid #e0e0e0;background:#f9fafb">水费</td>
          <td style="padding:4px 8px;border:1px solid #e0e0e0">${data.waterFee} 元/吨</td></tr>
        <tr><td style="padding:4px 8px;border:1px solid #e0e0e0;background:#f9fafb">电费</td>
          <td style="padding:4px 8px;border:1px solid #e0e0e0">${data.electricFee} 元/度</td></tr>
        <tr><td style="padding:4px 8px;border:1px solid #e0e0e0;background:#f9fafb">物业费</td>
          <td style="padding:4px 8px;border:1px solid #e0e0e0">${data.propertyFee} 元/㎡</td></tr>
      </table>
    </div>

    ${data.notes ? `
    <div style="font-size:13px;margin:16px 0">
      <h3 style="font-size:14px;margin:12px 0 8px;color:#0A3D62">四、其他约定</h3>
      <p>${data.notes}</p>
    </div>` : ''}

    <div style="font-size:13px;margin:24px 0">
      <h3 style="font-size:14px;margin:12px 0 8px;color:#0A3D62">五、其他条款</h3>
      <p>1. 乙方应按约定时间及时缴纳租金及相关费用，逾期甲方有权按合同约定收取滞纳金。</p>
      <p>2. 乙方不得擅自改变房屋用途或转租，如需变更应征得甲方书面同意。</p>
      <p>3. 租赁期满，乙方如需续租应提前30日书面通知甲方。</p>
      <p>4. 本合同一式两份，甲乙双方各执一份，具有同等法律效力。</p>
      <p>5. 本合同自双方签章之日起生效。</p>
    </div>

    <div style="display:flex;margin-top:40px;font-size:13px">
      <div style="flex:1;padding:0 20px;text-align:center">
        ${sealBlock('甲方（出租方）签章', data.companySeal)}
      </div>
      <div style="flex:1;padding:0 20px;text-align:center">
        ${sealBlock('乙方（承租方）签章')}
      </div>
    </div>

    <p style="text-align:center;font-size:11px;color:#999;margin-top:30px">打印日期：${formatDate(new Date())} &nbsp;|&nbsp; 本文件由物业租赁综合管理系统生成</p>
  </div>`;
}
