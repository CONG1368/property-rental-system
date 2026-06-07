import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export type PrintMode = 'native' | 'pdf';
export type PaperSize = 'A4' | 'A4-landscape' | '80mm';

export interface PrintOptions {
  title: string;
  paperSize: PaperSize;
  htmlContent: string;
  mode?: PrintMode;
}

export async function printDocument(options: PrintOptions): Promise<void> {
  if (options.mode === 'native') {
    return printNative(options.htmlContent, options.title);
  }
  return printPDF(options);
}

export function isElectron(): boolean {
  return !!(window as any).electronAPI;
}

export function showPrintMenu(options: PrintOptions): void {
  if (isElectron() && options.mode === undefined) {
    throw new Error('print mode required');
  }
  const mode = isElectron() ? (options.mode || 'pdf') : 'pdf';
  printDocument({ ...options, mode });
}

const PAPER_SIZES: Record<string, { pageW: number; pageH: number; orientation: 'portrait' | 'landscape' }> = {
  'A4': { pageW: 210, pageH: 297, orientation: 'portrait' },
  'A4-landscape': { pageW: 297, pageH: 210, orientation: 'landscape' },
  '80mm': { pageW: 80, pageH: 297, orientation: 'portrait' },
};

async function printPDF(options: PrintOptions): Promise<void> {
  const { title, paperSize, htmlContent } = options;
  const size = PAPER_SIZES[paperSize] || PAPER_SIZES['A4'];
  const now = new Date().toISOString().slice(0, 10);
  const margin = paperSize === '80mm' ? 4 : 8;
  const usableW = size.pageW - margin * 2;
  const usableH = size.pageH - margin * 2;
  const width = paperSize === '80mm' ? '302px' : '760px';

  const styleMatch = htmlContent.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
  const styleTag = styleMatch ? '<style>' + styleMatch[1] + '</style>' : '';

  const blocksHTML = extractBlocksHTML(htmlContent);

  const doc = new jsPDF({ orientation: size.orientation, unit: 'mm', format: paperSize === '80mm' ? [80, 297] : 'a4' });
  let currentY = margin;

  for (let i = 0; i < blocksHTML.length; i++) {
    const blockContainer = document.createElement('div');
    blockContainer.innerHTML = styleTag + blocksHTML[i];
    blockContainer.style.cssText = 'position:fixed;left:-9999px;top:0;width:' + width + ';background:#fff;z-index:-1;';
    document.body.appendChild(blockContainer);

    try {
      const canvas = await html2canvas(blockContainer, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      document.body.removeChild(blockContainer);

      const imgData = canvas.toDataURL('image/png');
      const imgW = usableW;
      const imgH = (canvas.height * usableW) / canvas.width;

      if (i > 0 && currentY + imgH > margin + usableH) {
        doc.addPage();
        currentY = margin;
      }

      doc.addImage(imgData, 'PNG', margin, currentY, imgW, imgH);
      currentY += imgH;
    } catch {
      if (document.body.contains(blockContainer)) document.body.removeChild(blockContainer);
      throw new Error('PDF生成失败');
    }
  }

  doc.save(title + '_' + now + '.pdf');
}

function extractBlocksHTML(html: string): string[] {
  const blocks: string[] = [];
  const pageMatch = html.match(/<div class="page"[^>]*>([\s\S]*?)<\/div>\s*(?:<\/body>|$)/);
  if (!pageMatch) return [html];

  const inner = pageMatch[1];
  const splitRegex = /(<div class="(?:section|header-row|sign-area)"[^>]*>[\s\S]*?<\/div>\s*(?=<div class="(?:section|header-row|sign-area)"|$))/g;
  let match;
  let lastIndex = 0;

  while ((match = splitRegex.exec(inner)) !== null) {
    if (match.index > lastIndex) {
      const before = inner.slice(lastIndex, match.index).trim();
      if (before) blocks.push('<div class="page">' + before + '</div>');
    }
    blocks.push('<div class="page">' + match[1] + '</div>');
    lastIndex = match.index + match[1].length;
  }

  if (lastIndex < inner.length) {
    const after = inner.slice(lastIndex).trim();
    if (after) blocks.push('<div class="page">' + after + '</div>');
  }

  return blocks.length > 0 ? blocks : [html];
}

async function printNative(htmlContent: string, title: string): Promise<void> {
  const api = (window as any).electronAPI;
  if (!api || !api.printHTML) {
    return printPDF({ title, paperSize: 'A4', htmlContent, mode: 'pdf' });
  }

  try {
    const result = await api.printHTML(htmlContent, title);
    if (!result.success) {
      throw new Error(result.failureReason || '打印失败');
    }
  } catch {
    throw new Error('打印操作取消或失败');
  }
}

export function toChineseAmount(n: number): string {
  if (n === 0) return '零元整';
  const units = ['', '拾', '佰', '仟', '万'];
  const digits = ['零', '壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖'];
  const fraction = ['角', '分'];

  let numStr = n.toFixed(2);
  let [intStr, decStr] = numStr.split('.');

  let result = '';
  if (parseInt(intStr) === 0) {
    result = '零';
  } else {
    let intLen = intStr.length;
    for (let i = 0; i < intLen; i++) {
      let d = parseInt(intStr[i]);
      let u = (intLen - 1 - i) % 4;
      if (d !== 0) {
        result += digits[d] + units[u];
      } else {
        if (i < intLen - 1 && parseInt(intStr[i + 1]) !== 0) {
          result += '零';
        }
      }
      if (u === 0 && i < intLen - 1) {
        result += intLen - 1 - i >= 8 ? '亿' : '万';
      }
    }
  }
  result += '元';

  if (decStr === '00') {
    result += '整';
  } else {
    if (decStr[0] !== '0') result += digits[parseInt(decStr[0])] + fraction[0];
    if (decStr[1] !== '0') result += digits[parseInt(decStr[1])] + fraction[1];
  }

  return result;
}

export function formatDate(date: Date | string | null | undefined, fmt = 'YYYY-MM-DD'): string {
  if (!date) return '-';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '-';
  const map: Record<string, string> = {
    YYYY: String(d.getFullYear()),
    MM: String(d.getMonth() + 1).padStart(2, '0'),
    DD: String(d.getDate()).padStart(2, '0'),
    HH: String(d.getHours()).padStart(2, '0'),
    mm: String(d.getMinutes()).padStart(2, '0'),
    ss: String(d.getSeconds()).padStart(2, '0'),
  };
  return fmt.replace(/YYYY|MM|DD|HH|mm|ss/g, (k) => map[k]);
}
