/**
 * 附件单据的渲染引擎（用户 2026-10-16：附件便捷化 ①②③）。
 * 纯函数：把「模板 + 合同/租客/房源数据」渲染成可直接交给 docx.ts 转 Word 的 HTML，
 * 说明：本文件属「打印/单据模板」性质（与 components/print/* 同规格），HTML 里的颜色必须是字面量
 *（Word 与打印引擎不认 CSS 变量），故相关行按静态门禁自身机制标注 ci-allow:R2。
 * 数据源（消防器材台账/账单/合同条款）只做纯映射，取数由调用方负责。
 */
export interface DocContext { [key: string]: string }

export interface DocField { label: string; value: string }
export interface DocSignature { label: string; name: string }
export interface DocColumn { key: string; label: string }

export interface DocTemplate {
  name: string;
  docTitle?: string;
  intro?: string;
  fields?: DocField[];
  clauses?: string[];
  signatures?: DocSignature[];
  dataSource?: string;
  tableColumns?: DocColumn[];
}

/** 金额显示：与系统其他位置一致，两位小数、千分位不加逗号（合同口径）。 */
function money(v: any): string {
  const n = Number(v || 0);
  return n.toFixed(2);
}

/** 把 ${key} 或 {{key}} 替换为上下文值；未提供的键替换为空串（避免合同上出现 ${xxx}）。 */
export function renderPlaceholders(text: string, ctx: DocContext): string {
  return String(text ?? '')
    .replace(/\$\{\s*([A-Za-z0-9_]+)\s*\}/g, (_m, k) => String(ctx[k] ?? ''))
    .replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, (_m, k) => String(ctx[k] ?? ''));
}

/** 组装占位符上下文（合同 + 租客 + 房源 + 甲方信息）。 */
export function buildDocContext(input: {
  contract?: any; tenant?: any; property?: any;
  companyName?: string; companySigner?: string; today?: string;
}): DocContext {
  const c = input.contract || {};
  const t = input.tenant || {};
  const p = input.property || {};
  const d = input.today ? new Date(input.today) : new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const today = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  return {
    contractNo: String(c.contractNo || ''),
    tenantName: String(t.name || c.tenantName || ''),
    tenantLegalPerson: String(t.legalPerson || ''),
    tenantIdNumber: String(t.idNumber || ''),
    tenantPhone: String(t.phone || ''),
    propertyName: String(p.name || ''),
    propertyAddress: String(p.address || ''),
    propertyArea: String(p.area ?? ''),
    rentAmount: money(c.rentAmount),
    depositAmount: money(c.depositAmount),
    performancePenalty: money(c.performancePenalty),
    firstPeriodRent: money(c.firstPeriodRent),
    paymentCycle: String(c.paymentCycle || ''),
    startDate: String(c.startDate || ''),
    endDate: String(c.endDate || ''),
    companyName: String(input.companyName || ''),
    companySigner: String(input.companySigner || ''),
    today,
  };
}

/** 系统记录 → 表格行（纯映射；未识别的数据源返回空数组）。 */
export function buildRows(dataSource: string, data: any): any[] {
  const list: any[] = Array.isArray(data) ? data : [];
  if (dataSource === 'fire-equipment') {
    return list.map((e) => ({
      name: e?.name || '', type: e?.type || '', location: e?.location || '',
      quantity: e?.quantity ?? '', status: e?.status || '', expireDate: e?.expireDate || '',
    }));
  }
  if (dataSource === 'bills') {
    return list.map((b) => ({
      billNo: b?.billNo || '', period: b?.period || '', totalAmount: money(b?.totalAmount),
      paidAmount: money(b?.paidAmount), dueDate: b?.dueDate || '', status: b?.status || '',
    }));
  }
  if (dataSource === 'contract-clauses') {
    const clauses: any[] = Array.isArray(data?.clauses) ? data.clauses : [];
    const fire = data?.billingConfig?.fireSafety || data?.fireSafety || null;
    const rows: any[] = clauses.map((c, i) => ({ no: String(i + 1), title: c?.title || '', content: c?.content || '' }));
    if (fire) {
      if (Array.isArray(fire.clauses)) fire.clauses.forEach((c: any) => rows.push({ no: '消防', title: c?.title || '消防约定', content: c?.content || '' }));
      if (Array.isArray(fire.restrictions) && fire.restrictions.length) rows.push({ no: '消防', title: '禁止事项', content: fire.restrictions.join('；') });
      if (Array.isArray(fire.equipment) && fire.equipment.length) rows.push({ no: '消防', title: '配备器材', content: fire.equipment.join('；') });
      if (fire.violationPenalty) rows.push({ no: '消防', title: '违规处罚', content: String(fire.violationPenalty) });
    }
    return rows;
  }
  return [];
}

function esc(s: any): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** 渲染单据 HTML（交给 docx.ts 转 Word；.sign-area 会被特判为两列表格）。 */
export function buildDocHTML(tpl: DocTemplate, ctx: DocContext, rows: any[] = []): string {
  const title = renderPlaceholders(tpl.docTitle || tpl.name, ctx);
  const intro = renderPlaceholders(tpl.intro || '', ctx);
  const fields = (tpl.fields || []).map((f) => ({ label: renderPlaceholders(f.label, ctx), value: renderPlaceholders(f.value, ctx) }));
  const clauses = (tpl.clauses || []).map((c) => renderPlaceholders(c, ctx)).filter((c) => c.trim());
  const signatures = (tpl.signatures || []).map((s) => ({ label: renderPlaceholders(s.label, ctx), name: renderPlaceholders(s.name, ctx) }));
  let cols: DocColumn[] = (tpl.tableColumns || []).filter((c) => c && c.key);
  if (rows.length > 0 && cols.length === 0) cols = Object.keys(rows[0]).map((k) => ({ key: k, label: k }));

  let html = '<div class="section">';
  html += '<h1 style="text-align:center;font-size:20px;margin:0 0 6px">' + esc(title) + '</h1>';
  html += '<p style="text-align:center;font-size:11px;color:#666;margin:0 0 14px">合同编号：' + esc(ctx.contractNo || '') + '　|　制单日期：' + esc(ctx.today || '') + '</p>'; // ci-allow:R2（单据 HTML 要交给 Word/打印，必须写具体颜色，不能用 CSS 变量）
  if (intro) html += '<p style="text-indent:2em;margin:6px 0;font-size:13px">' + esc(intro) + '</p>';

  if (fields.length > 0) {
    html += '<table style="width:100%;border-collapse:collapse;margin:8px 0;font-size:13px">';
    for (const f of fields) {
      html += '<tr><td style="width:150px;padding:5px 8px;border:1px solid #999;background:#f7f7f7">' + esc(f.label) + '</td>' + // ci-allow:R2（单据 HTML 要交给 Word/打印，必须写具体颜色，不能用 CSS 变量）
        '<td style="padding:5px 8px;border:1px solid #999">' + esc(f.value) + '</td></tr>'; // ci-allow:R2（单据 HTML 要交给 Word/打印，必须写具体颜色，不能用 CSS 变量）
    }
    html += '</table>';
  }

  if (rows.length > 0 && cols.length > 0) {
    html += '<table style="width:100%;border-collapse:collapse;margin:8px 0;font-size:12px">';
    html += '<tr>' + cols.map((c) => '<th style="padding:5px 6px;border:1px solid #999;background:#f2f2f2">' + esc(c.label) + '</th>').join('') + '</tr>'; // ci-allow:R2（单据 HTML 要交给 Word/打印，必须写具体颜色，不能用 CSS 变量）
    for (const r of rows) {
      html += '<tr>' + cols.map((c) => '<td style="padding:5px 6px;border:1px solid #999">' + esc(r[c.key] ?? '') + '</td>').join('') + '</tr>'; // ci-allow:R2（单据 HTML 要交给 Word/打印，必须写具体颜色，不能用 CSS 变量）
    }
    html += '</table>';
  }

  clauses.forEach((c, i) => {
    html += '<p style="text-indent:2em;margin:6px 0;font-size:13px">' + (clauses.length > 1 ? esc(String(i + 1) + '、') : '') + esc(c) + '</p>';
  });

  if (signatures.length > 0) {
    html += '<div class="sign-area" style="margin-top:36px">' + signatures.map((s) =>
      '<div style="padding:6px 16px"><p style="margin:4px 0;font-size:13px">' + esc(s.label) + '：' + esc(s.name || '＿＿＿＿＿＿') + '</p>' +
      '<p style="margin:16px 0 0;font-size:12px">日期：＿＿＿＿年＿＿月＿＿日</p></div>').join('') + '</div>';
  }
  html += '</div>';
  return html;
}

/** 附件文件名（模板名 + 合同编号），便于在附件列表与打印清单里辨认。 */
export function docxFileName(templateName: string, contractNo: string): string {
  const name = String(templateName || '单据').replace(/[\\/:*?"<>|]/g, '').trim() || '单据';
  const no = String(contractNo || '').replace(/[\\/:*?"<>|]/g, '').trim();
  return no ? name + '_' + no + '.docx' : name + '.docx';
}
