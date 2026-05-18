import { toChineseAmount, formatDate } from '@/utils/print-service';

interface FeeItem { name: string; amount: number; unit: string; }

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
  status: string;
  notes: string;
  feeItems?: FeeItem[];
  companyName: string;
  companyLogo?: string;
  companySeal?: string;
  clauses?: { title: string; content: string; sortOrder: number }[];
}

// 付款周期 → 月数映射
const CYCLE_MONTHS: Record<string, number> = {
  '月': 1, '季': 3, '半年': 6, '年': 12, '两年': 24, '三年': 36, '五年': 60,
};

const CYCLE_LABEL: Record<string, string> = {
  '月': '按月支付', '季': '按季度支付', '半年': '按半年度支付',
  '年': '按年度支付', '两年': '每两年支付', '三年': '每三年支付', '五年': '每五年支付',
};

const CYCLE_TERM: Record<string, string> = {
  '月': '每月', '季': '每季度', '半年': '每半年',
  '年': '每年', '两年': '每两年', '三年': '每三年', '五年': '每五年',
};

export function buildContractHTML(data: ContractPrintData): string {
  const months = CYCLE_MONTHS[data.paymentCycle] || 1;
  const periodRent = data.rentAmount * months;
  const paymentCycleText = CYCLE_LABEL[data.paymentCycle] || data.paymentCycle;
  const cycleTerm = CYCLE_TERM[data.paymentCycle] || '每期';

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

  const feeItems = data.feeItems || [];

  // 构建费用明细表格行
  let feeRows = '';
  if (feeItems.length > 0) {
    feeRows = feeItems.map(fi => `<tr>
      <td style="padding:4px 8px;border:1px solid #e0e0e0;background:#f9fafb">${fi.name}</td>
      <td style="padding:4px 8px;border:1px solid #e0e0e0">¥${Number(fi.amount).toFixed(2)} ${fi.unit || ''}</td>
    </tr>`).join('');
  }

  // 计算周期费用合计（含租金）
  const periodicFeeTotal = feeItems.reduce((sum, fi) => {
    // 按周期乘月数的费用项（元/月、元/吨、元/度 等按月度计价的）
    if (fi.unit === '元/月' || fi.unit === '元/吨' || fi.unit === '元/度' || fi.unit === '元/㎡/月') {
      return sum + Number(fi.amount) * months;
    }
    return sum + Number(fi.amount);
  }, 0);

  const periodTotal = periodRent + periodicFeeTotal;

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
        <tr><td style="padding:4px 8px;border:1px solid #e0e0e0;background:#f9fafb">付款周期</td>
          <td style="padding:4px 8px;border:1px solid #e0e0e0">${paymentCycleText}</td></tr>
        <tr style="font-weight:bold"><td style="padding:4px 8px;border:1px solid #e0e0e0;background:#e6f0fa;color:#0A3D62">${cycleTerm}应交租金</td>
          <td style="padding:4px 8px;border:1px solid #e0e0e0;background:#e6f0fa;color:#0A3D62">¥${periodRent.toFixed(2)}（大写：${toChineseAmount(periodRent)}）</td></tr>
        <tr><td style="padding:4px 8px;border:1px solid #e0e0e0;background:#f9fafb">押金</td>
          <td style="padding:4px 8px;border:1px solid #e0e0e0">¥${data.depositAmount.toFixed(2)}（大写：${toChineseAmount(data.depositAmount)}）</td></tr>
        ${feeRows}
        ${feeItems.length > 0 ? `<tr style="font-weight:bold"><td style="padding:4px 8px;border:1px solid #e0e0e0;background:#fff7e6;color:#e67e22">${cycleTerm}费用合计</td>
          <td style="padding:4px 8px;border:1px solid #e0e0e0;background:#fff7e6;color:#e67e22">¥${periodTotal.toFixed(2)}（大写：${toChineseAmount(periodTotal)}）</td></tr>` : ''}
      </table>
    </div>

    ${data.notes ? `
    <div style="font-size:13px;margin:16px 0">
      <h3 style="font-size:14px;margin:12px 0 8px;color:#0A3D62">四、其他约定</h3>
      <p>${data.notes}</p>
    </div>` : ''}

    ${data.clauses && Array.isArray(data.clauses) && data.clauses.length > 0 ? `
    <div style="font-size:13px;margin:16px 0">
      <h3 style="font-size:14px;margin:12px 0 8px;color:#0A3D62">五、合同条款</h3>
      ${[...data.clauses].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)).map((c, i) => `<p style="margin:6px 0"><b>${i + 1}. ${c.title}</b></p><p style="margin:6px 0 12px 16px;color:#555">${c.content}</p>`).join('')}
    </div>` : `
    <div style="font-size:13px;margin:24px 0">
      <h3 style="font-size:14px;margin:12px 0 8px;color:#0A3D62">五、其他条款</h3>
      <p>1. 乙方应按约定时间及时缴纳租金及相关费用，逾期甲方有权按合同约定收取滞纳金。</p>
      <p>2. 乙方不得擅自改变房屋用途或转租，如需变更应征得甲方书面同意。</p>
      <p>3. 租赁期满，乙方如需续租应提前30日书面通知甲方。</p>
      <p>4. 本合同一式两份，甲乙双方各执一份，具有同等法律效力。</p>
      <p>5. 本合同自双方签章之日起生效。</p>
    </div>`}

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
