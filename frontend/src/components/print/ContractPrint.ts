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
  companyIdType?: string;
  companyIdNumber?: string;
  companyPhone?: string;
  paymentMethod?: string;
  bankName?: string;
  bankAccountNumber?: string;
  bankAccountName?: string;
  taxType?: string;
  taxRate?: number;
  invoiceType?: string;
  lateFeeRate?: number;
  depositTerms?: string;
  maintenanceParty?: string;
  terminationNotice?: number;
  renewalNotice?: number;
  subletAllowed?: boolean;
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

function deduplicateClauses(clauses: { title: string; content: string; sortOrder: number }[]): { title: string; content: string; sortOrder: number }[] {
  const seen = new Set<string>();
  return clauses.filter(c => {
    const key = `${c.title}|||${c.content}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

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
      <td style="padding:5px 10px;border:1px solid #ddd;background:#f9fafb">${fi.name}</td>
      <td style="padding:5px 10px;border:1px solid #ddd">¥${Number(fi.amount).toFixed(2)} ${fi.unit || ''}</td>
    </tr>`).join('');
  }

  // 计算周期费用合计（含租金）
  const periodicFeeTotal = feeItems.reduce((sum, fi) => {
    if (fi.unit === '元/月' || fi.unit === '元/吨' || fi.unit === '元/度' || fi.unit === '元/㎡/月') {
      return sum + Number(fi.amount) * months;
    }
    return sum + Number(fi.amount);
  }, 0);

  const periodTotal = periodRent + periodicFeeTotal;

  // 甲方证件信息行
  const lessorIdInfo = [];
  if (data.companyIdType) lessorIdInfo.push(`证件类型：${data.companyIdType}`);
  if (data.companyIdNumber) lessorIdInfo.push(`证件号码：${data.companyIdNumber}`);
  const lessorIdLine = lessorIdInfo.length > 0 ? `<p style="margin:3px 0 3px 24px;font-size:12px;color:#555">${lessorIdInfo.join(' &nbsp;|&nbsp; ')}</p>` : '';
  const lessorPhoneLine = data.companyPhone ? `<p style="margin:3px 0 3px 24px;font-size:12px;color:#555">联系电话：${data.companyPhone}</p>` : '';

  // 收款方式
  const paymentMethodText = data.paymentMethod || '';
  let paymentInfoHtml = '';
  if (paymentMethodText) {
    paymentInfoHtml = `<tr><td style="padding:5px 10px;border:1px solid #ddd;background:#f9fafb;width:120px">收款方式</td>
      <td style="padding:5px 10px;border:1px solid #ddd">${paymentMethodText}</td></tr>`;
    if (paymentMethodText === '银行汇款' && (data.bankName || data.bankAccountNumber)) {
      paymentInfoHtml += `<tr><td style="padding:5px 10px;border:1px solid #ddd;background:#f9fafb">开户银行</td>
        <td style="padding:5px 10px;border:1px solid #ddd">${data.bankName || '--'}</td></tr>`;
      paymentInfoHtml += `<tr><td style="padding:5px 10px;border:1px solid #ddd;background:#f9fafb">银行账号</td>
        <td style="padding:5px 10px;border:1px solid #ddd">${data.bankAccountNumber || '--'}</td></tr>`;
      paymentInfoHtml += `<tr><td style="padding:5px 10px;border:1px solid #ddd;background:#f9fafb">收款户名</td>
        <td style="padding:5px 10px;border:1px solid #ddd">${data.bankAccountName || '--'}</td></tr>`;
    }
  }

  // 条款去重
  const rawClauses = data.clauses && Array.isArray(data.clauses) ? data.clauses : [];
  const uniqueClauses = deduplicateClauses(rawClauses);

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; }
  body { font-family: "SimSun", "宋体", serif; font-size: 13px; line-height: 1.8; color: #333; margin: 0; padding: 0; }
  .page { max-width: 680px; margin: 0 auto; padding: 30px 20px 40px; }
  h3 { font-size: 14px; margin: 18px 0 10px; color: #0A3D62; border-bottom: 1px solid #e8e8e8; padding-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  .section { margin: 20px 0; page-break-inside: avoid; }
  .header-row { page-break-inside: avoid; }
  .sign-area { display: flex; margin-top: 50px; font-size: 13px; page-break-inside: avoid; }
  .sign-col { flex: 1; padding: 0 20px; text-align: center; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .page { padding: 20px 16px 30px; }
  }
  @page { margin: 18mm 15mm 22mm 15mm; }
</style>
</head>
<body>
<div class="page">

  <div class="header-row" style="text-align:center;margin-bottom:24px">
    ${logoHtml}
    <h1 style="margin:8px 0 6px;font-size:22px;color:#0A3D62;letter-spacing:4px">物业租赁合同</h1>
    <p style="font-size:12px;color:#909399;margin:0">合同编号：${data.contractNo} &nbsp;|&nbsp; 状态：${data.status}</p>
  </div>

  <div class="section" style="font-size:13px;padding:14px 16px;background:#f8f9fb;border-radius:4px;border:1px solid #e8ecf1">
    <p style="margin:4px 0"><b>出租方（甲方）：</b>${data.companyName}</p>
    ${lessorIdLine}
    ${lessorPhoneLine}
    <p style="margin:4px 0"><b>承租方（乙方）：</b>${data.tenantName}</p>
    <p style="margin:3px 0 3px 24px;font-size:12px;color:#555">证件类型/号码：${data.tenantIdType || '--'} / ${data.tenantIdNumber || '--'}</p>
    <p style="margin:3px 0 3px 24px;font-size:12px;color:#555">联系电话：${data.tenantPhone || '--'}</p>
  </div>

  <div class="section">
    <h3>一、租赁物业</h3>
    <table>
      <tr><td style="padding:5px 10px;border:1px solid #ddd;background:#f9fafb;width:100px">房源名称</td>
        <td style="padding:5px 10px;border:1px solid #ddd">${data.propertyName}</td></tr>
      <tr><td style="padding:5px 10px;border:1px solid #ddd;background:#f9fafb">地址</td>
        <td style="padding:5px 10px;border:1px solid #ddd">${data.propertyAddress}</td></tr>
      <tr><td style="padding:5px 10px;border:1px solid #ddd;background:#f9fafb">面积</td>
        <td style="padding:5px 10px;border:1px solid #ddd">${data.propertyArea} ㎡</td></tr>
    </table>
  </div>

  <div class="section">
    <h3>二、租赁期限</h3>
    <p style="margin:6px 0">租赁期限自 <b>${formatDate(data.startDate)}</b> 至 <b>${formatDate(data.endDate)}</b>。</p>
  </div>

  <div class="section">
    <h3>三、租金及费用</h3>
    <table>
      <tr><td style="padding:5px 10px;border:1px solid #ddd;background:#f9fafb;width:120px">月租金</td>
        <td style="padding:5px 10px;border:1px solid #ddd">¥${data.rentAmount.toFixed(2)}（大写：${toChineseAmount(data.rentAmount)}）${data.taxType === '不含税' ? ` <span style="background:#fef0f0;color:#e74c3c;padding:1px 6px;border-radius:3px;font-size:11px">不含税</span>` : ` <span style="background:#f0f9eb;color:#27ae60;padding:1px 6px;border-radius:3px;font-size:11px">含税</span>`}</td></tr>
      <tr><td style="padding:5px 10px;border:1px solid #ddd;background:#f9fafb">付款周期</td>
        <td style="padding:5px 10px;border:1px solid #ddd">${paymentCycleText}</td></tr>
      <tr style="font-weight:bold"><td style="padding:5px 10px;border:1px solid #ddd;background:#e6f0fa;color:#0A3D62">${cycleTerm}应交租金</td>
        <td style="padding:5px 10px;border:1px solid #ddd;background:#e6f0fa;color:#0A3D62">¥${periodRent.toFixed(2)}（大写：${toChineseAmount(periodRent)}）</td></tr>
      <tr><td style="padding:5px 10px;border:1px solid #ddd;background:#f9fafb">押金</td>
        <td style="padding:5px 10px;border:1px solid #ddd">¥${data.depositAmount.toFixed(2)}（大写：${toChineseAmount(data.depositAmount)}）</td></tr>
      ${data.taxType === '不含税' && data.taxRate ? `<tr><td style="padding:5px 10px;border:1px solid #ddd;background:#fef0f0;color:#e74c3c">增值税额（${data.taxRate}%）</td>
        <td style="padding:5px 10px;border:1px solid #ddd;background:#fef0f0;color:#e74c3c">¥${(data.rentAmount * months * (data.taxRate || 0) / 100).toFixed(2)}（大写：${toChineseAmount(data.rentAmount * months * (data.taxRate || 0) / 100)}）<span style="font-size:11px;color:#999;margin-left:4px">（由承租方另行支付）</span></td></tr>` : ''}
      ${feeRows}
      ${feeItems.length > 0 ? `<tr style="font-weight:bold"><td style="padding:5px 10px;border:1px solid #ddd;background:#fff7e6;color:#e67e22">${cycleTerm}费用合计</td>
        <td style="padding:5px 10px;border:1px solid #ddd;background:#fff7e6;color:#e67e22">¥${periodTotal.toFixed(2)}（大写：${toChineseAmount(periodTotal)}）</td></tr>` : ''}
      ${paymentInfoHtml}
      ${data.invoiceType && data.invoiceType !== '不开票' ? `<tr><td style="padding:5px 10px;border:1px solid #ddd;background:#f9fafb;width:120px">发票类型</td>
        <td style="padding:5px 10px;border:1px solid #ddd">${data.invoiceType}</td></tr>` : ''}
      </table>
    </div>

    ${data.notes ? `
    <div class="section">
      <h3>四、其他约定</h3>
      <p style="margin:6px 0;line-height:1.8">${data.notes}</p>
    </div>` : ''}

    <div class="section">
      <h3>${data.notes ? '五' : '四'}、合同细则</h3>
      <table>
        <tr><td style="padding:5px 10px;border:1px solid #ddd;background:#f9fafb;width:140px">滞纳金</td>
          <td style="padding:5px 10px;border:1px solid #ddd">逾期未缴租金按 ${((data.lateFeeRate ?? 0.05) * 100).toFixed(1)}% / 月 计收滞纳金</td></tr>
        ${data.depositTerms ? `<tr><td style="padding:5px 10px;border:1px solid #ddd;background:#f9fafb">押金退还</td>
          <td style="padding:5px 10px;border:1px solid #ddd">${data.depositTerms}</td></tr>` : `<tr><td style="padding:5px 10px;border:1px solid #ddd;background:#f9fafb">押金退还</td>
          <td style="padding:5px 10px;border:1px solid #ddd">租赁期满且无违约欠费，押金全额无息退还</td></tr>`}
        <tr><td style="padding:5px 10px;border:1px solid #ddd;background:#f9fafb">日常维修</td>
          <td style="padding:5px 10px;border:1px solid #ddd">${data.maintenanceParty === '乙方' ? '乙方负责租赁期间的日常维修' : data.maintenanceParty === '按约定' ? '双方按约定承担维修责任' : '甲方负责房屋主体及设施的自然损耗维修'}</td></tr>
        <tr><td style="padding:5px 10px;border:1px solid #ddd;background:#f9fafb">转租</td>
          <td style="padding:5px 10px;border:1px solid #ddd">${data.subletAllowed ? '经甲方书面同意，乙方可将房屋转租' : '乙方不得将房屋转租给第三方'}</td></tr>
        <tr><td style="padding:5px 10px;border:1px solid #ddd;background:#f9fafb">提前解约</td>
          <td style="padding:5px 10px;border:1px solid #ddd">任何一方提前解约需提前 ${data.terminationNotice ?? 30} 日书面通知对方</td></tr>
        <tr><td style="padding:5px 10px;border:1px solid #ddd;background:#f9fafb">续约</td>
          <td style="padding:5px 10px;border:1px solid #ddd">租赁期满如需续租，乙方应提前 ${data.renewalNotice ?? 30} 日书面通知甲方</td></tr>
      </table>
    </div>

    ${uniqueClauses.length > 0 ? `
    <div class="section">
      <h3>${data.notes ? '六' : '五'}、合同条款</h3>
      ${[...uniqueClauses].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)).map((c, i) => `
      <div style="margin:8px 0 16px;page-break-inside:avoid">
        <p style="margin:0 0 4px;font-weight:bold">${i + 1}. ${c.title}</p>
        <p style="margin:0 0 0 12px;color:#555;line-height:1.7">${c.content}</p>
      </div>`).join('')}
    </div>` : `
    <div class="section">
      <h3>${data.notes ? '六' : '五'}、其他条款</h3>
      <div style="margin:4px 0">
        <p style="margin:6px 0">1. 乙方应按约定时间及时缴纳租金及相关费用，逾期甲方有权按合同约定收取滞纳金。</p>
        <p style="margin:6px 0">2. 乙方不得擅自改变房屋用途或转租，如需变更应征得甲方书面同意。</p>
        <p style="margin:6px 0">3. 租赁期满，乙方如需续租应提前${data.renewalNotice ?? 30}日书面通知甲方。</p>
        <p style="margin:6px 0">4. 本合同一式两份，甲乙双方各执一份，具有同等法律效力。</p>
        <p style="margin:6px 0">5. 本合同自双方签章之日起生效。</p>
      </div>
    </div>`}


  <div class="sign-area">
    <div class="sign-col">
      ${sealBlock('甲方（出租方）签章', data.companySeal)}
    </div>
    <div class="sign-col">
      ${sealBlock('乙方（承租方）签章')}
    </div>
  </div>


</div>
</body>
</html>`;
}