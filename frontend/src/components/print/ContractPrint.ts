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
  fireSafety?: {
    clauses?: { title: string; content: string }[];
    restrictions?: string[];
    equipment?: string[];
    responsibilityParty?: string;
    inspectionFrequency?: string;
    violationPenalty?: string;
  };
}

const CYCLE_MONTHS: Record<string, number> = {
  '月': 1, '季': 3, '半年': 6, '年': 12, '两年': 24, '三年': 36, '五年': 60,
};

const CYCLE_LABEL: Record<string, string> = {
  '月': '按月支付', '季': '按季度支付', '半年': '按半年度支付',
  '年': '按年度支付', '两年': '每两年支付', '三年': '每三年支付', '五年': '每五年支付',
};

const CYCLE_TERM: Record<string, string> = {
  '月': '首月', '季': '首季度', '半年': '首半年',
  '年': '首年', '两年': '首两年', '三年': '首三年', '五年': '首五年',
};

function normLines(text: string): string[] {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(p => p.trim());
}
function wrapTextAsParagraphs(text: string, extraStyle = ''): string {
  const lines = normLines(text);
  if (lines.length === 0) return '';
  return lines.map((p: string) => `<p style="text-indent:2em;margin:2px 0;${extraStyle}">${p}</p>`).join('');
}

function deduplicateClauses(clauses: { title: string; content: string; sortOrder: number }[]): { title: string; content: string; sortOrder: number }[] {
  const seen = new Set<string>();
  return clauses.filter(c => {
    const key = `${c.title}|||${c.content}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function td(label: string, value: string, opts?: { labelW?: number; highlight?: boolean }): string {
  const w = opts?.labelW || 110;
  const hc = opts?.highlight ? 'font-weight:bold;color:#c00' : '';
  const v = normLines(value).join('<br>') || value;
  return `<tr>
    <td style="width:${w}px;padding:6px 8px;border:1px solid #999;background:#f7f7f7;font-size:12px;text-align:right">${label}</td>
    <td style="padding:6px 10px;border:1px solid #999;font-size:13px;${hc}">${v}</td>
  </tr>`;
}

function buildFireSafetyHTML(data: ContractPrintData): string {
  const fs = data.fireSafety;
  if (!fs) return '';

  let html = '<div class="section"><h3>消防安全约定</h3>';
  html += '<table>';

  if (fs.responsibilityParty) {
    html += td('消防责任方', fs.responsibilityParty);
  }
  if (fs.inspectionFrequency) {
    html += td('检查频率', fs.inspectionFrequency);
  }
  if (fs.violationPenalty) {
    html += td('违规处罚', fs.violationPenalty);
  }

  if (fs.equipment && fs.equipment.length > 0) {
    html += `<tr><td style="padding:6px 8px;border:1px solid #999;background:#f7f7f7;font-size:12px;text-align:right">配备器材</td>
      <td style="padding:6px 10px;border:1px solid #999;font-size:13px">${fs.equipment.join('；')}</td></tr>`;
  }

  if (fs.restrictions && fs.restrictions.length > 0) {
    html += `<tr><td style="padding:6px 8px;border:1px solid #999;background:#f7f7f7;font-size:12px;text-align:right">禁止事项</td>
      <td style="padding:6px 10px;border:1px solid #999;font-size:13px">${fs.restrictions.map((r, i) => `${i + 1}. ${r}`).join('<br>')}</td></tr>`;
  }

  html += '</table>';

  if (fs.clauses && fs.clauses.length > 0) {
    for (let i = 0; i < fs.clauses.length; i++) {
      const c = fs.clauses[i];
      html += `<p style="margin:8px 0 2px;font-weight:bold">${i + 1}. ${c.title}</p>`;
      html += wrapTextAsParagraphs(c.content, 'margin-left:16px;color:#333');
    }
  }

  html += '</div>';
  return html;
}

export function buildContractHTML(data: ContractPrintData): string {
  const months = CYCLE_MONTHS[data.paymentCycle] || 1;
  const periodRent = data.rentAmount * months;
  const paymentCycleText = CYCLE_LABEL[data.paymentCycle] || data.paymentCycle;
  const cycleTerm = CYCLE_TERM[data.paymentCycle] || '首期';

  // === 双方当事人信息（两列对比） ===
  const lessorDetail: string[] = [];
  if (data.companyIdType) lessorDetail.push(`证件类型：${data.companyIdType}`);
  if (data.companyIdNumber) lessorDetail.push(`证件号码：${data.companyIdNumber}`);
  if (data.companyPhone) lessorDetail.push(`联系电话：${data.companyPhone}`);

  const tenantDetail: string[] = [];
  if (data.tenantIdType) tenantDetail.push(`证件类型：${data.tenantIdType}`);
  if (data.tenantIdNumber) tenantDetail.push(`证件号码：${data.tenantIdNumber}`);
  if (data.tenantPhone) tenantDetail.push(`联系电话：${data.tenantPhone}`);

  // === 费用明细 ===
  const feeItems = data.feeItems || [];
  let feeRows = '';
  if (feeItems.length > 0) {
    feeRows = feeItems.map(fi =>
      td(fi.name, `¥${Number(fi.amount).toFixed(2)} ${fi.unit || ''}`)
    ).join('');
  }

  const periodicFeeTotal = feeItems.reduce((sum, fi) => {
    if (fi.unit === '元/月' || fi.unit === '元/吨' || fi.unit === '元/度' || fi.unit === '元/㎡/月') {
      return sum + Number(fi.amount) * months;
    }
    return sum + Number(fi.amount);
  }, 0);

  const periodTotal = periodRent + periodicFeeTotal;

  // === 收款方式 ===
  let paymentInfoHtml = '';
  if (data.paymentMethod) {
    if (data.paymentMethod === '银行汇款' && (data.bankName || data.bankAccountNumber)) {
      paymentInfoHtml += td('收款方式', '银行汇款');
      paymentInfoHtml += td('开户银行', data.bankName || '--');
      paymentInfoHtml += td('银行账号', data.bankAccountNumber || '--');
      paymentInfoHtml += td('收款户名', data.bankAccountName || '--');
    } else {
      paymentInfoHtml += td('收款方式', data.paymentMethod);
    }
  }

  // === 增值税行 ===
  let taxRow = '';
  if (data.taxType === '不含税' && data.taxRate) {
    const taxAmount = data.rentAmount * months * (data.taxRate || 0) / 100;
    taxRow = td(`增值税额（${data.taxRate}%）`, `¥${taxAmount.toFixed(2)}（${toChineseAmount(taxAmount)}），由承租方另行支付`, { highlight: true });
  }

  // === 条款 ===
  const rawClauses = data.clauses && Array.isArray(data.clauses) ? data.clauses : [];
  const uniqueClauses = deduplicateClauses(rawClauses).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

  // === 章节计数器 ===
  const CN = '一二三四五六七八九十';
  let sec = 0;
  const sn = () => {
    sec++;
    if (sec <= 10) return CN[sec - 1];
    if (sec < 20) return '十' + (sec > 10 ? CN[sec - 11] : '');
    return String(sec);
  };

  // === 签章区 ===
  const sealBlock = (label: string, imgSrc?: string) => {
    if (imgSrc) {
      return `<div style="text-align:center;padding:0 10px">
        <img src="${imgSrc}" style="max-width:140px;max-height:140px" crossorigin="anonymous" />
        <p style="margin:4px 0 0;font-size:12px">${label}（盖章）</p>
      </div>`;
    }
    return `<div style="text-align:center;padding:0 10px">
      <p style="margin:40px 0 8px;font-size:13px">${label}：_______________</p>
      <p style="font-size:11px;color:#888">日期：____年____月____日</p>
    </div>`;
  };

  const logoHtml = data.companyLogo
    ? `<img src="${data.companyLogo}" style="max-width:200px;max-height:52px;margin-bottom:6px" crossorigin="anonymous" />`
    : '';

  const statusBadge = {
    '执行中': '执行中', '已签订': '已签订', '已到期': '已到期',
    '已终止': '已终止', '草稿': '草稿', '待审批': '待审批',
  }[data.status] || data.status;

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: "SimSun", "宋体", "serif"; font-size: 14px; line-height: 2; color: #222; }
  .page { width: 740px; margin: 0 auto; padding: 36px 28px 50px; }
  h3 { font-size: 15px; margin: 22px 0 10px; padding-bottom: 4px; border-bottom: 1px solid #333; color: #111; }
  table { width: 100%; border-collapse: collapse; }
  .section { margin: 0 0 4px; }
  .header-row { text-align: center; margin-bottom: 28px; }
  .sign-area { display: flex; align-items: start; margin-top: 60px; }
  .sign-col { flex: 1; }

  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .page { padding: 20px 20px 36px; }
  }
  @page { margin: 16mm 14mm 20mm 14mm; }
</style>
</head>
<body>
<div class="page">

  <!-- ====== 标题 ====== -->
  <div class="header-row">
    ${logoHtml}
    <div style="display:flex;align-items:center;justify-content:center;margin:8px 0">
      <div style="flex:1;height:1px;background:#333"></div>
      <h1 style="margin:0 24px;font-size:24px;font-weight:bold;letter-spacing:6px;white-space:nowrap">物业租赁合同</h1>
      <div style="flex:1;height:1px;background:#333"></div>
    </div>
    <p style="font-size:12px;color:#666;margin-top:6px">合同编号：${data.contractNo}　　状态：${statusBadge}</p>
  </div>

  <!-- ====== 合同当事人 ====== -->
  <div class="section">
    <h3>${sn()}、合同当事人</h3>
    <table>
      <tr>
        <td style="width:50%;padding:10px 14px;border:1px solid #999;vertical-align:top">
          <p style="font-size:14px;font-weight:bold;margin-bottom:6px">出租方（甲方）</p>
          <p style="margin:3px 0">名称：${data.companyName}</p>
          ${lessorDetail.map(s => `<p style="margin:3px 0;font-size:12px;color:#555">${s}</p>`).join('')}
        </td>
        <td style="width:50%;padding:10px 14px;border:1px solid #999;vertical-align:top">
          <p style="font-size:14px;font-weight:bold;margin-bottom:6px">承租方（乙方）</p>
          <p style="margin:3px 0">姓名：${data.tenantName}</p>
          ${tenantDetail.map(s => `<p style="margin:3px 0;font-size:12px;color:#555">${s}</p>`).join('')}
        </td>
      </tr>
    </table>
  </div>

  <!-- ====== 租赁物业 ====== -->
  <div class="section">
    <h3>${sn()}、租赁物业</h3>
    <table>
      ${td('房源名称', data.propertyName)}
      ${td('坐落地址', data.propertyAddress)}
      ${td('建筑面积', data.propertyArea + ' ㎡')}
    </table>
  </div>

  <!-- ====== 租赁期限 ====== -->
  <div class="section">
    <h3>${sn()}、租赁期限</h3>
    <p style="text-indent:2em;margin:6px 0">本合同租赁期限自 <b>${formatDate(data.startDate)}</b> 起至 <b>${formatDate(data.endDate)}</b> 止。</p>
    <p style="text-indent:2em;margin:6px 0">租赁期满，如甲方继续出租该物业，在同等条件下乙方享有优先承租权。</p>
  </div>

  <!-- ====== 租金及费用 ====== -->
  <div class="section">
    <h3>${sn()}、租金及费用</h3>
    <table>
      ${td('月租金', `¥${data.rentAmount.toFixed(2)}　（${toChineseAmount(data.rentAmount)}）` + (data.taxType === '不含税' ? ' <span style="color:#e74c3c;font-size:11px">[不含税]</span>' : ' <span style="color:#27ae60;font-size:11px">[含税]</span>'))}
      ${td('付款周期', paymentCycleText)}
      ${td(cycleTerm + '应交租金', `¥${periodRent.toFixed(2)}　（${toChineseAmount(periodRent)}）`, { highlight: true })}
      ${td('押金', `¥${data.depositAmount.toFixed(2)}　（${toChineseAmount(data.depositAmount)}）`)}
      ${taxRow}
      ${feeRows}
      ${feeItems.length > 0 ? td(cycleTerm + '费用合计', `¥${periodTotal.toFixed(2)}　（${toChineseAmount(periodTotal)}）`, { highlight: true }) : ''}
      ${paymentInfoHtml}
      ${data.invoiceType && data.invoiceType !== '不开票' ? td('发票类型', data.invoiceType) : ''}
    </table>
  </div>

  <!-- ====== 合同细则 ====== -->
  <div class="section">
    <h3>${sn()}、合同细则</h3>
    <table>
      ${td('违约金', `逾期未缴租金按 ${((data.lateFeeRate ?? 0.05) * 100).toFixed(1)}% / 月 计收违约金`)}
      ${td('押金退还', data.depositTerms || '租赁期满且无违约欠费，押金全额无息退还')}
      ${td('日常维修', data.maintenanceParty === '乙方' ? '乙方负责租赁期间的日常维修' : data.maintenanceParty === '按约定' ? '双方按约定承担维修责任' : '甲方负责房屋主体及设施的自然损耗维修')}
      ${td('转租', data.subletAllowed ? '经甲方书面同意，乙方可将房屋转租' : '乙方不得将房屋转租给第三方')}
      ${td('提前解约', `任何一方提前解约需提前 ${data.terminationNotice ?? 30} 日书面通知对方`)}
      ${td('续约', `租赁期满如需续租，乙方应提前 ${data.renewalNotice ?? 30} 日书面通知甲方`)}
    </table>
  </div>

  ${data.notes ? `
  <!-- ====== 其他约定 ====== -->
  <div class="section">
    <h3>${sn()}、其他约定</h3>
    ${wrapTextAsParagraphs(data.notes, 'line-height:2')}
  </div>` : ''}

  <!-- ====== 合同条款 ====== -->
  <div class="section">
    <h3>${sn()}、合同条款</h3>
    ${uniqueClauses.length > 0 ? uniqueClauses.map((c, i) => `
    <div style="margin:6px 0 18px">
      <p style="font-weight:bold;margin:0 0 4px">第${i + 1}条　${c.title}</p>
      ${wrapTextAsParagraphs(c.content, 'color:#333')}
    </div>`).join('') : `
    <div style="margin:4px 0">
      <p style="text-indent:2em;margin:8px 0">1. 乙方应按约定时间及时缴纳租金及相关费用，逾期甲方有权按合同约定收取违约金。</p>
      <p style="text-indent:2em;margin:8px 0">2. 乙方不得擅自改变房屋用途或转租，如需变更应征得甲方书面同意。</p>
      <p style="text-indent:2em;margin:8px 0">3. 租赁期满，乙方如需续租应提前${data.renewalNotice ?? 30}日书面通知甲方。</p>
      <p style="text-indent:2em;margin:8px 0">4. 本合同一式两份，甲乙双方各执一份，具有同等法律效力。</p>
      <p style="text-indent:2em;margin:8px 0">5. 本合同自双方签章之日起生效。</p>
    </div>`}
  </div>

  ${buildFireSafetyHTML(data)}

  <!-- ====== 签章 ====== -->
  <div class="sign-area">
    <div class="sign-col" style="border-right:1px solid #ccc;padding-right:30px">
      ${sealBlock('甲方（出租方）', data.companySeal)}
    </div>
    <div class="sign-col" style="padding-left:30px">
      ${sealBlock('乙方（承租方）')}
    </div>
  </div>

  <!-- ====== 页脚 ====== -->
  <div style="text-align:center;margin-top:50px;font-size:10px;color:#aaa;border-top:1px solid #ddd;padding-top:10px">
    合同编号：${data.contractNo}　|　签订日期：${formatDate(new Date())}
  </div>

</div>
</body>
</html>`;
}
