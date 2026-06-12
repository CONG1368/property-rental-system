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

// 文字PDF导出（Electron printToPDF，生成真正的文字PDF而非截图）
export async function exportTextPDF(title: string, htmlContent: string): Promise<void> {
  const api = (window as any).electronAPI;
  if (!api || !api.exportPDF) {
    // 非Electron环境回退到截图PDF
    return printPDF({ title, paperSize: 'A4', htmlContent, mode: 'pdf' });
  }
  try {
    const result = await api.exportPDF(htmlContent, title);
    if (!result.success) throw new Error(result.error || '导出失败');
    // 用户取消保存对话框不算错误
  } catch (e: any) {
    throw new Error(e.message || 'PDF导出失败');
  }
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
      const canvas = await html2canvas(blockContainer, { scale: 1.5, useCORS: true, backgroundColor: '#ffffff' });
      document.body.removeChild(blockContainer);

      const imgW = usableW;
      const imgH = (canvas.height * usableW) / canvas.width;
      const maxBlockH = usableH * 0.95;

      if (imgH > maxBlockH) {
        // 超长区块按页均分切片，避免最后一页内容过少（翻页异常）
        const pagesNeeded = Math.ceil(imgH / maxBlockH);
        const slicePixelH = Math.ceil(canvas.height / pagesNeeded);

        for (let s = 0; s < pagesNeeded; s++) {
          const srcY = s * slicePixelH;
          const srcH = Math.min(slicePixelH, canvas.height - srcY);
          const sliceImgH = srcH * usableW / canvas.width;

          const sliceCanvas = document.createElement('canvas');
          sliceCanvas.width = canvas.width;
          sliceCanvas.height = srcH;
          const ctx = sliceCanvas.getContext('2d')!;
          ctx.drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH);

          if (currentY + sliceImgH > margin + usableH) {
            doc.addPage();
            currentY = margin;
          }

          const sliceData = sliceCanvas.toDataURL('image/jpeg', 0.92);
          doc.addImage(sliceData, 'JPEG', margin, currentY, imgW, sliceImgH);
          currentY += sliceImgH;
        }
      } else {
        if (i > 0 && currentY + imgH > margin + usableH) {
          doc.addPage();
          currentY = margin;
        }

        doc.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', margin, currentY, imgW, imgH);
        currentY += imgH;
      }
    } catch {
      if (document.body.contains(blockContainer)) document.body.removeChild(blockContainer);
      throw new Error('PDF生成失败');
    }
  }

  doc.save(title + '_' + now + '.pdf');
}

function extractBlocksHTML(html: string): string[] {
  const blocks: string[] = [];
  const container = document.createElement('div');
  container.innerHTML = html;

  const pageEl = container.querySelector('.page');
  if (!pageEl) return [html];

  const blockClasses = ['section', 'header-row', 'sign-area'];
  let current: HTMLElement[] = [];

  function flush() {
    if (current.length === 0) return;
    const wrapper = document.createElement('div');
    wrapper.className = 'page';
    current.forEach(c => wrapper.appendChild(c.cloneNode(true)));
    blocks.push(wrapper.outerHTML);
    current = [];
  }

  for (const child of Array.from(pageEl.children)) {
    const el = child as HTMLElement;
    const isBlock = blockClasses.some(cls => el.classList.contains(cls));
    if (isBlock) {
      flush();
      current.push(el);
      flush();
    } else {
      current.push(el);
    }
  }
  flush();

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
