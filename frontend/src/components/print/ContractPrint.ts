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
  // 乙方签约信息（合同底部签章区，用户 2026-10-10 要求）：五项全部来自租客档案里用户自行填写的字段，
  // 不做任何"用联系人顶法定代表人、用证件地址顶签约地址"的映射
  tenantLegalPerson?: string;
  tenantSignAddress?: string;
  tenantPostcode?: string;
  tenantBankName?: string;
  tenantBankAccount?: string;
  // 是否把乙方（承租方）证件信息与联系方式写入合同（用户 2026-10-10 要求）：
  // 由合同起草页的开关决定；未显式传值时按老合同处理，保持原有输出
  showTenantContact?: boolean;
  startDate: string;
  endDate: string;
  rentAmount: number;
  depositAmount: number;
  // 履约违约金（用户 2026-10-10 要求）：替代原「违约金比例」，与押金并列的可自定义金额
  performancePenalty?: number;
  // 首期应交租金（用户 2026-10-10 要求）：0/缺省＝自动按「月租金 × 付款周期月数」，>0 为自定义金额（几年一起交）
  firstPeriodRent?: number;
  paymentCycle: string;
  // status 仍由调用方传入，但**不再打印在合同上**（用户 2026-10-10 要求）
  status: string;
  notes: string;
  /**
   * 合同附件（用户 2026-10-16 要求，当日再次修订）：打印件里的「附件清单」**只列用户自己上传的附件**，
   * 不做任何自动添加——消防也一样：消防条款本身印在合同正文，需要作为「附件」时由用户自己上传。
   * 打印顺序：主合同正文 → 甲乙双方签名（签章区）→ 附件清单（没有上传附件就整段不出现）。
   */
  attachments?: { name: string; title?: string; uploadedAt?: string }[];
  feeItems?: FeeItem[];
  companyName: string;
  companyLogo?: string;
  companySeal?: string;
  companyIdType?: string;
  companyIdNumber?: string;
  companyPhone?: string;
  // 甲方签约信息（用户 2026-10-10 要求，用于合同底部签章区）：来自打印设置，未配置则留空供手写
  companyAddress?: string;
  companyPostcode?: string;
  companySigner?: string;
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

  // 用户 2026-10-10 要求：**消防责任方 / 检查频率不再打印在合同上**（内部管理口径），
  // 消防条款、禁止事项、配备器材、违规处罚等文字约定全部保留。
  const rows: string[] = [];
  if (fs.violationPenalty) {
    rows.push(td('违规处罚', fs.violationPenalty));
  }
  if (fs.equipment && fs.equipment.length > 0) {
    rows.push(`<tr><td style="padding:6px 8px;border:1px solid #999;background:#f7f7f7;font-size:12px;text-align:right">配备器材</td>
      <td style="padding:6px 10px;border:1px solid #999;font-size:13px">${fs.equipment.join('；')}</td></tr>`);
  }
  if (fs.restrictions && fs.restrictions.length > 0) {
    rows.push(`<tr><td style="padding:6px 8px;border:1px solid #999;background:#f7f7f7;font-size:12px;text-align:right">禁止事项</td>
      <td style="padding:6px 10px;border:1px solid #999;font-size:13px">${fs.restrictions.map((r, i) => `${i + 1}. ${r}`).join('<br>')}</td></tr>`);
  }
  const hasClauses = !!(fs.clauses && fs.clauses.length > 0);
  // 只配了责任方/检查频率（参数已不打印）又没有条款文字时，整段不出，避免合同上留一个空标题
  if (rows.length === 0 && !hasClauses) return '';

  let html = '<div class="section"><h3>消防安全约定</h3>';
  if (rows.length > 0) html += `<table>${rows.join('')}</table>`;

  if (hasClauses) {
    for (let i = 0; i < fs.clauses!.length; i++) {
      const c = fs.clauses![i];
      html += `<p style="margin:8px 0 2px;font-weight:bold">${i + 1}. ${c.title}</p>`;
      html += wrapTextAsParagraphs(c.content, 'margin-left:16px;color:#333');
    }
  }

  html += '</div>';
  return html;
}

// 金额相当于几个月租金：让承租人一眼看清押金 / 履约违约金各是「几个月」、各是多少钱（用户 2026-10-10 要求）
function rentMonthsNote(amount: number, rentAmount: number): string {
  const rent = Number(rentAmount || 0);
  const value = Number(amount || 0);
  if (!rent || !value) return '';
  return `　相当于 ${Number((value / rent).toFixed(2))} 个月租金（月租金 ¥${rent.toFixed(2)}）`;
}

export function buildContractHTML(data: ContractPrintData): string {
  const months = CYCLE_MONTHS[data.paymentCycle] || 1;
  // 首期应交租金：默认自动（月租金 × 付款周期月数），也允许自定义（几年一起交，用户 2026-10-10 要求）
  const autoPeriodRent = data.rentAmount * months;
  const customPeriodRent = Number(data.firstPeriodRent || 0);
  const periodRent = customPeriodRent > 0 ? customPeriodRent : autoPeriodRent;
  // 实际首期月数：自定义时按「金额 ÷ 月租金」折算，让按月计的费用与税额跟着一起缩放
  const effMonths = customPeriodRent > 0 && data.rentAmount > 0 ? customPeriodRent / data.rentAmount : months;
  const paymentCycleText = CYCLE_LABEL[data.paymentCycle] || data.paymentCycle;
  const cycleTerm = CYCLE_TERM[data.paymentCycle] || '首期';

  // === 双方当事人信息（两列对比） ===
  const lessorDetail: string[] = [];
  if (data.companyIdType) lessorDetail.push(`证件类型：${data.companyIdType}`);
  if (data.companyIdNumber) lessorDetail.push(`证件号码：${data.companyIdNumber}`);
  if (data.companyPhone) lessorDetail.push(`联系电话：${data.companyPhone}`);

  // 乙方证件信息为选填：开关关闭时整段不输出；证件类型单独存在（没有证件号）时也不输出，避免出现孤立的「证件类型：身份证」
  // 乙方证件与联系方式是否写入合同（用户 2026-10-10 要求）：开关关闭时乙方栏不输出，
  // 合同底部的乙方签约信息栏同样留空（标签保留，供手写）
  const withTenantContact = data.showTenantContact !== false;
  const tenantDetail: string[] = [];
  if (withTenantContact) {
    // 证件类型只有和证件号一起才打印：避免出现「证件类型：身份证」这种没有号码支撑的孤立声明
    if (data.tenantIdNumber) {
      if (data.tenantIdType) tenantDetail.push(`证件类型：${data.tenantIdType}`);
      tenantDetail.push(`证件号码：${data.tenantIdNumber}`);
    }
    if (data.tenantPhone) tenantDetail.push(`联系电话：${data.tenantPhone}`);
  }

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
      return sum + Number(fi.amount) * effMonths;
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
    const taxAmount = data.rentAmount * effMonths * (data.taxRate || 0) / 100;
    taxRow = td(`增值税额（${data.taxRate}%）`, `¥${taxAmount.toFixed(2)}（${toChineseAmount(taxAmount)}），由承租方另行支付`, { highlight: true });
  }

  // === 条款 ===
  const rawClauses = data.clauses && Array.isArray(data.clauses) ? data.clauses : [];
  const uniqueClauses = deduplicateClauses(rawClauses).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  // 条款排版规则（用户 2026-10-11 要求：条款完全由用户自定义排版，系统不再自动生成条款、也不再强行编号）
  // ① 只要有一条条款标题自带编号（第一条 / 一、 / 1. /（一）…），就认为整体用用户自己的编号体系 → 全部原样打印
  // ② 标题为空时只打印内容段落（可当纯文本条款）
  // ③ 用户没编号时，系统才补「第N条」，保持旧观感
  const CLAUSE_NUM_RE = /^\s*(第[0-9一二三四五六七八九十百零〇两]+[条章节款项]|[0-9]+\s*[.、．)）]|[（(]\s*[0-9一二三四五六七八九十]+\s*[)）]|[一二三四五六七八九十]+\s*[、.．])/;
  const userNumbered = uniqueClauses.some((c) => CLAUSE_NUM_RE.test((c.title || '').trim()));
  const clauseHeading = (c: { title: string; content: string }, index: number): string => {
    const title = (c.title || '').trim();
    if (!title) return '';
    if (userNumbered || CLAUSE_NUM_RE.test(title)) return title;
    return `第${index + 1}条　${title}`;
  };

  // === 章节计数器 ===
  const CN = '一二三四五六七八九十';
  let sec = 0;
  const sn = () => {
    sec++;
    if (sec <= 10) return CN[sec - 1];
    if (sec < 20) return '十' + (sec > 10 ? CN[sec - 11] : '');
    return String(sec);
  };

  // === 签章区（用户 2026-10-10 要求）：甲乙双方各自的签约信息栏，系统里有的就带出，没有的留空划线供手写 ===
  const signField = (label: string, value?: string | number | null) => {
    const v = value === undefined || value === null ? '' : String(value).trim();
    return `<p style="display:flex;align-items:flex-end;margin:7px 0;font-size:13px;line-height:1.7">
      <span style="flex:0 0 104px;color:#333">${label}：</span>
      <span style="flex:1;border-bottom:1px solid #333;min-height:20px;padding:0 4px">${v}</span>
    </p>`;
  };

  const logoHtml = data.companyLogo
    ? `<img src="${data.companyLogo}" style="max-width:200px;max-height:52px;margin-bottom:6px" crossorigin="anonymous" />`
    : '';

  // 抬头不再打印合同状态（用户 2026-10-10 要求：给租户正式签署的合同上不能出现「起草中」这类状态提示）

  // 消防约定区块（合同正文内，与附件无关）
  const fireSafetyHtml = buildFireSafetyHTML(data);

  // 附件清单（用户 2026-10-16 要求，当日再次修订）：排在甲乙双方签名之后，**只列用户上传的附件**，
  // 不做任何自动添加——消防不再自动占位（消防条款已印在正文，需要消防附件时由用户自己上传）
  const escAttr = (s: string) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const attachmentItems: string[] = [];
  (data.attachments || []).forEach((it) => {
    // 优先用用户自定义的标题/备注（用户 2026-10-16 要求），没设置才回退到去掉扩展名的文件名
    const title = String(it?.title || '').trim();
    const raw = String(it?.name || '').trim();
    const label = title || raw.replace(/\.[A-Za-z0-9]{1,6}$/, '');
    if (!label) return;
    attachmentItems.push(escAttr(label));
  });
  const attachmentHtml = attachmentItems.length > 0 ? `
  <!-- ====== 附件清单（签名之后）====== -->
  <div class="section" style="margin-top:48px">
    <h3>附件清单</h3>
    <p style="font-size:12px;color:#666;margin:4px 0 8px">以下附件与本合同具有同等法律效力，具体文件另附。</p>
    <table>
      ${attachmentItems.map((n, i) => td('附件' + (i + 1), n)).join('')}
    </table>
  </div>` : '';

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
    <p style="font-size:12px;color:#666;margin-top:6px">合同编号：${data.contractNo}</p>
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
      ${td(customPeriodRent > 0 ? '首期应交租金' : cycleTerm + '应交租金', `¥${periodRent.toFixed(2)}　（${toChineseAmount(periodRent)}）${rentMonthsNote(periodRent, data.rentAmount)}`, { highlight: true })}
      ${td('押金', `¥${data.depositAmount.toFixed(2)}　（${toChineseAmount(data.depositAmount)}）${rentMonthsNote(data.depositAmount, data.rentAmount)}`)}
      ${(data.performancePenalty ?? 0) > 0 ? td('履约违约金', `¥${Number(data.performancePenalty).toFixed(2)}　（${toChineseAmount(Number(data.performancePenalty))}）${rentMonthsNote(Number(data.performancePenalty), data.rentAmount)}`) : ''}
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
      ${data.lateFeeRate !== undefined && !((data.performancePenalty ?? 0) > 0) ? td('违约金', `逾期未缴租金按 ${(data.lateFeeRate * 100).toFixed(1)}% / 月 计收违约金`) : ''}
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

  <!-- ====== 条款区（用户 2026-10-11 要求：不再自动生成兜底条款，条款为空时整段不出）====== -->
  ${uniqueClauses.length > 0 ? `
  <div class="section">
    <h3>${sn()}、合同条款</h3>
    ${uniqueClauses.map((c, i) => `
    <div style="margin:6px 0 18px">
      ${clauseHeading(c, i) ? `<p style="font-weight:bold;margin:0 0 4px">${clauseHeading(c, i)}</p>` : ''}
      ${wrapTextAsParagraphs(c.content, 'color:#333')}
    </div>`).join('')}
  </div>` : ''}

  ${fireSafetyHtml}

  <!-- ====== 签章区（甲乙双方签约信息，用户 2026-10-10 要求）====== -->
  <div class="sign-area">
    <div class="sign-col" style="border-right:1px solid #ccc;padding-right:30px">
      ${data.companySeal ? `<div style="text-align:center;margin-bottom:8px">
        <img src="${data.companySeal}" style="max-width:120px;max-height:120px" crossorigin="anonymous" />
        <p style="margin:2px 0 0;font-size:11px;color:#888">（甲方盖章）</p>
      </div>` : ''}
      ${signField('甲方', data.companyName)}
      ${signField('签约代表人', data.companySigner)}
      ${signField('地址', data.companyAddress)}
      ${signField('电话', data.companyPhone)}
      ${signField('邮编', data.companyPostcode)}
      ${signField('开户银行', data.bankName)}
      ${signField('帐户名', data.bankAccountName)}
      ${signField('帐　号', data.bankAccountNumber)}
      <p style="margin:16px 0 0;font-size:13px">日期：＿＿＿＿年＿＿月＿＿日</p>
    </div>
    <div class="sign-col" style="padding-left:30px">
      ${signField('乙方', data.tenantName)}
      ${signField('法定代表人', data.tenantLegalPerson)}
      ${signField('（授权代表）', '')}
      ${signField('身份证号码', withTenantContact ? data.tenantIdNumber : '')}
      ${signField('地址', data.tenantSignAddress)}
      ${signField('电话', withTenantContact ? data.tenantPhone : '')}
      ${signField('邮编', data.tenantPostcode)}
      ${signField('开户银行', data.tenantBankName)}
      ${signField('帐　号', data.tenantBankAccount)}
      <p style="margin:16px 0 0;font-size:13px">日期：＿＿＿＿年＿＿月＿＿日</p>
    </div>
  </div>
${attachmentHtml}

  <!-- ====== 页脚 ====== -->
  <div style="text-align:center;margin-top:50px;font-size:10px;color:#aaa;border-top:1px solid #ddd;padding-top:10px">
    合同编号：${data.contractNo}　|　签订日期：${formatDate(new Date())}
  </div>

</div>
</body>
</html>`;
}
