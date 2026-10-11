import JSZip from 'jszip';

/**
 * 打印 HTML → 标准 Word(.docx) 转换器（用户 2026-10-11 要求：合同除 PDF 外还要 Word 版本）。
 *
 * 设计要点：
 * 1. **唯一数据源是打印模板生成的 HTML**——Word 与 PDF 走同一份数据/同一套排版，内容不会漂移。
 * 2. 产出的是**真正的 Office Open XML**（不是改扩展名的 HTML），Word 打开不会弹「文件格式与扩展名不符」，
 *    也不会出现乱字符。
 * 3. 字体全部**显式声明**：中文 `w:eastAsia="宋体"`（标题「黑体」），西文 `w:ascii/w:hAnsi="Times New Roman"`。
 *    Word 不再按默认字体替换，中文不会变成方框/乱码；正文是文字而非图片，所以任意缩放都清晰。
 * 4. 所有文本走 XML 转义（& < > " 与控制字符），特殊符号不会破坏文档结构。
 */

const MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const FONT_CN = '宋体';
const FONT_CN_HEAD = '黑体';
const FONT_EN = 'Times New Roman';
const A4_TWIPS = { w: 11906, h: 16838, margin: 1134 };

/** XML 转义 + 剔除 XML 1.0 非法控制字符（乱字符的常见来源） */
function esc(s: string): string {
  return String(s ?? '')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** px → Word 半点（half-point）：px × 0.75 = pt，pt × 2 = 半点 */
function halfPoints(px: number): number {
  return Math.max(2, Math.round(px * 1.5));
}

function fontXml(cn: string): string {
  return `<w:rFonts w:ascii="${FONT_EN}" w:hAnsi="${FONT_EN}" w:eastAsia="${cn}" w:cs="${FONT_EN}"/>`;
}

interface RunStyle { bold?: boolean; sizePx?: number; color?: string; cnFont?: string }

function runXml(text: string, st: RunStyle = {}): string {
  if (text === '') return '';
  const rpr = [
    fontXml(st.cnFont || FONT_CN),
    st.bold ? '<w:b/><w:bCs/>' : '',
    st.sizePx ? `<w:sz w:val="${halfPoints(st.sizePx)}"/><w:szCs w:val="${halfPoints(st.sizePx)}"/>` : '',
    st.color ? `<w:color w:val="${st.color.replace('#', '').toUpperCase()}"/>` : '',
  ].join('');
  return `<w:r><w:rPr>${rpr}</w:rPr><w:t xml:space="preserve">${esc(text)}</w:t></w:r>`;
}

/** 内联子节点 → runs（支持 <b>/<strong>、font-weight、color、font-size、<br>） */
function inlineRuns(el: Element, inherited: RunStyle = {}): string {
  let out = '';
  el.childNodes.forEach((n) => {
    if (n.nodeType === Node.TEXT_NODE) {
      out += runXml(n.textContent || '', inherited);
      return;
    }
    if (n.nodeType !== Node.ELEMENT_NODE) return;
    const child = n as Element;
    const tag = child.tagName.toLowerCase();
    if (tag === 'br') { out += '<w:r><w:br/></w:r>'; return; }
    if (tag === 'img') { return; } // 图片不嵌入（保持文档轻量、避免低分辨率位图模糊）
    const css = (child.getAttribute('style') || '').toLowerCase();
    const st: RunStyle = { ...inherited };
    if (tag === 'b' || tag === 'strong' || /font-weight:\s*(bold|[6-9]00)/.test(css)) st.bold = true;
    const sz = css.match(/font-size:\s*([\d.]+)px/);
    if (sz) st.sizePx = Number(sz[1]);
    const col = css.match(/color:\s*(#[0-9a-f]{3,6})/);
    if (col) st.color = col[1];
    out += inlineRuns(child, st);
  });
  return out;
}

interface ParaStyle {
  align?: 'center' | 'right' | 'both';
  indentChars?: number;
  bold?: boolean;
  sizePx?: number;
  cnFont?: string;
  spaceBefore?: number;
  spaceAfter?: number;
  borderBottom?: boolean;
}

function paraXml(runs: string, st: ParaStyle = {}): string {
  const ppr = [
    '<w:pPr>',
    st.borderBottom ? '<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="2" w:color="333333"/></w:pBdr>' : '',
    `<w:spacing w:before="${st.spaceBefore ?? 0}" w:after="${st.spaceAfter ?? 0}" w:line="300" w:lineRule="auto"/>`,
    st.indentChars ? `<w:ind w:firstLineChars="${st.indentChars * 100}"/>` : '',
    st.align ? `<w:jc w:val="${st.align}"/>` : '',
    '</w:pPr>',
  ].join('');
  return `<w:p>${ppr}${runs || runXml('', st)}</w:p>`;
}

function cssNumber(css: string, prop: string): number | undefined {
  const m = css.match(new RegExp(prop + ':\\s*([\\d.]+)'));
  return m ? Number(m[1]) : undefined;
}

/** 单个块级元素 → Word 段落/表格 */
function blockXml(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const css = (el.getAttribute('style') || '').toLowerCase();

  if (tag === 'img') return '';
  if (tag === 'h1' || tag === 'h2' || tag === 'h3' || tag === 'h4') {
    const sizePx = tag === 'h1' ? 24 : tag === 'h3' ? 15 : 16;
    const runs = inlineRuns(el, { bold: true, sizePx, cnFont: tag === 'h1' ? FONT_CN_HEAD : FONT_CN });
    return paraXml(runs, {
      align: 'center',
      bold: true,
      cnFont: FONT_CN_HEAD,
      spaceBefore: tag === 'h1' ? 120 : 200,
      spaceAfter: tag === 'h1' ? 120 : 80,
      borderBottom: tag !== 'h1',
    });
  }
  if (tag === 'table') return tableXml(el);
  if (tag === 'p') {
    const st: ParaStyle = {
      align: /text-align:\s*center/.test(css) ? 'center' : /text-align:\s*right/.test(css) ? 'right' : undefined,
      indentChars: cssNumber(css, 'text-indent') ? 2 : undefined,
      spaceAfter: 40,
    };
    return paraXml(inlineRuns(el), st);
  }
  if (tag === 'div' || tag === 'section' || tag === 'td' || tag === 'body' || tag === 'blockquote') {
    // 容器：递归子块；纯文本/内联内容则整体成段
    const kids = Array.from(el.children);
    const hasBlockChild = kids.some((k) => ['div', 'p', 'table', 'h1', 'h2', 'h3', 'h4'].includes(k.tagName.toLowerCase()));
    if (!hasBlockChild) {
      const runs = inlineRuns(el);
      if (!runs) return '';
      return paraXml(runs, {
        align: /text-align:\s*center/.test(css) ? 'center' : undefined,
        indentChars: cssNumber(css, 'text-indent') ? 2 : undefined,
      });
    }
    return kids.map(blockXml).join('');
  }
  // 其它标签按段落处理
  const runs = inlineRuns(el);
  return runs ? paraXml(runs) : '';
}

function tableXml(table: Element): string {
  const rows = Array.from(table.querySelectorAll(':scope > tr, :scope > tbody > tr'));
  if (rows.length === 0) return '';
  const gridCols = Math.max(...rows.map((r) => Array.from(r.children).reduce((n, c) => n + (Number((c as Element).getAttribute('colspan')) || 1), 0)), 1);
  const colW = Math.floor((A4_TWIPS.w - A4_TWIPS.margin * 2) / gridCols);
  const body = rows.map((tr) => {
    const cells = Array.from(tr.children).map((tdEl) => {
      const cell = tdEl as Element;
      const colspan = Number(cell.getAttribute('colspan')) || 1;
      const css = (cell.getAttribute('style') || '').toLowerCase();
      const bg = css.match(/background:\s*#([0-9a-f]{3,6})/);
      const cellParas = Array.from(cell.children).length > 0
        ? Array.from(cell.children).map(blockXml).join('') || paraXml(inlineRuns(cell))
        : paraXml(inlineRuns(cell));
      const tcpr = [
        `<w:tcW w:w="${colW * colspan}" w:type="dxa"/>`,
        colspan > 1 ? `<w:gridSpan w:val="${colspan}"/>` : '',
        bg ? `<w:shd w:val="clear" w:color="auto" w:fill="${bg[1].toUpperCase()}"/>` : '',
        '<w:vAlign w:val="center"/>',
      ].join('');
      return `<w:tc><w:tcPr>${tcpr}</w:tcPr>${cellParas}</w:tc>`;
    }).join('');
    return `<w:tr>${cells}</w:tr>`;
  }).join('');

  const borders = ['top', 'left', 'bottom', 'right', 'insideH', 'insideV']
    .map((side) => `<w:${side} w:val="single" w:sz="6" w:space="0" w:color="999999"/>`).join('');
  return `<w:tbl>
    <w:tblPr>
      <w:tblW w:w="${A4_TWIPS.w - A4_TWIPS.margin * 2}" w:type="dxa"/>
      <w:tblBorders>${borders}</w:tblBorders>
      <w:tblCellMar>
        <w:top w:w="40" w:type="dxa"/><w:left w:w="80" w:type="dxa"/>
        <w:bottom w:w="40" w:type="dxa"/><w:right w:w="80" w:type="dxa"/>
      </w:tblCellMar>
    </w:tblPr>
    <w:tblGrid>${Array.from({ length: gridCols }).map(() => `<w:gridCol w:w="${colW}"/>`).join('')}</w:tblGrid>
    ${body}
  </w:tbl>
  <w:p><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr></w:p>`;
}

/** 签章区（打印模板用 flex 两列）→ Word 两列表格，保证左右并排不串行 */
function signAreaXml(area: Element): string {
  const cols = Array.from(area.querySelectorAll(':scope > .sign-col'));
  if (cols.length === 0) return blockXml(area);
  const inner = cols.map((c) => {
    const paras = Array.from(c.children).map(blockXml).join('') || paraXml(inlineRuns(c));
    return `<w:tc><w:tcPr><w:tcW w:w="${Math.floor((A4_TWIPS.w - A4_TWIPS.margin * 2) / cols.length)}" w:type="dxa"/><w:vAlign w:val="top"/></w:tcPr>${paras}</w:tc>`;
  }).join('');
  return `<w:tbl>
    <w:tblPr><w:tblW w:w="${A4_TWIPS.w - A4_TWIPS.margin * 2}" w:type="dxa"/><w:tblBorders>
      <w:top w:val="none" w:sz="0" w:space="0" w:color="auto"/><w:left w:val="none" w:sz="0" w:space="0" w:color="auto"/>
      <w:bottom w:val="none" w:sz="0" w:space="0" w:color="auto"/><w:right w:val="none" w:sz="0" w:space="0" w:color="auto"/>
      <w:insideV w:val="single" w:sz="6" w:space="0" w:color="999999"/>
      <w:insideH w:val="none" w:sz="0" w:space="0" w:color="auto"/>
    </w:tblBorders></w:tblPr>
    <w:tr>${inner}</w:tr>
  </w:tbl>`;
}

/** 打印 HTML → Word 正文 XML */
export function htmlToWordXml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const root = doc.querySelector('.page') || doc.body;
  const blocks = Array.from(root.children).map((el) => {
    if (el.classList.contains('sign-area')) return signAreaXml(el);
    if (el.tagName.toLowerCase() === 'table') return tableXml(el);
    return blockXml(el);
  }).join('');
  return blocks;
}

function stylesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault><w:rPr>${fontXml(FONT_CN)}<w:sz w:val="21"/><w:szCs w:val="21"/>
      <w:lang w:val="en-US" w:eastAsia="zh-CN" w:bidi="ar-SA"/></w:rPr></w:rPrDefault>
    <w:pPrDefault><w:pPr><w:spacing w:line="300" w:lineRule="auto"/></w:pPr></w:pPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
  <w:style w:type="table" w:default="1" w:styleId="TableNormal"><w:name w:val="Normal Table"/><w:qFormat/></w:style>
</w:styles>`;
}

/**
 * 生成 Word 文件。
 * @param html 打印模板产出的完整 HTML（buildContractHTML / 其它 Print 模板均可）
 * @param meta 文档属性（标题/作者，仅影响文件信息）
 */
export async function buildDocxBlob(html: string, meta: { title?: string; creator?: string } = {}): Promise<Blob> {
  const zip = new JSZip();
  const body = htmlToWordXml(html);
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    ${body}
    <w:sectPr>
      <w:pgSz w:w="${A4_TWIPS.w}" w:h="${A4_TWIPS.h}"/>
      <w:pgMar w:top="${A4_TWIPS.margin}" w:right="${A4_TWIPS.margin}" w:bottom="${A4_TWIPS.margin}" w:left="${A4_TWIPS.margin}" w:header="851" w:footer="992" w:gutter="0"/>
      <w:cols w:space="425"/><w:docGrid w:type="lines" w:linePitch="312"/>
    </w:sectPr>
  </w:body>
</w:document>`;

  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`);
  zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`);
  zip.file('word/_rels/document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>
</Relationships>`);
  zip.file('word/document.xml', documentXml);
  zip.file('word/styles.xml', stylesXml());
  zip.file('word/settings.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:zoom w:percent="100"/><w:defaultTabStop w:val="420"/><w:compat/>
</w:settings>`);
  zip.file('docProps/core.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>${esc(meta.title || '物业租赁合同')}</dc:title>
  <dc:creator>${esc(meta.creator || '物业租赁综合管理系统')}</dc:creator>
  <cp:lastModifiedBy>${esc(meta.creator || '物业租赁综合管理系统')}</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString().replace(/\.\d+Z$/, 'Z')}</dcterms:created>
</cp:coreProperties>`);
  zip.file('docProps/app.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>物业租赁综合管理系统</Application>
</Properties>`);

  return zip.generateAsync({ type: 'blob', mimeType: MIME, compression: 'DEFLATE', compressionOptions: { level: 6 } });
}

export const DOCX_MIME = MIME;
