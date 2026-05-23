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

/**
 * 统一打印服务 — 支持系统原生打印（Electron）和 PDF 导出两种模式
 */
export async function printDocument(options: PrintOptions): Promise<void> {
  if (options.mode === 'native') {
    return printNative(options.htmlContent, options.title);
  }
  return printPDF(options);
}

/** 获取当前运行环境 */
export function isElectron(): boolean {
  return !!(window as any).electronAPI;
}

/** 弹出打印模式选择（桌面端有原生选项，浏览器只支持PDF） */
export function showPrintMenu(options: PrintOptions): void {
  if (isElectron() && options.mode === undefined) {
    // 直接调用，由页面层弹选择菜单
    throw new Error('print mode required');
  }
  const mode = isElectron() ? (options.mode || 'pdf') : 'pdf';
  printDocument({ ...options, mode });
}

// ====== PDF 导出 ======

const PAPER_SIZES: Record<string, { pageW: number; pageH: number; orientation: 'portrait' | 'landscape' }> = {
  'A4': { pageW: 210, pageH: 297, orientation: 'portrait' },
  'A4-landscape': { pageW: 297, pageH: 210, orientation: 'landscape' },
  '80mm': { pageW: 80, pageH: 297, orientation: 'portrait' },
};

async function printPDF(options: PrintOptions): Promise<void> {
  const { title, paperSize, htmlContent } = options;
  const size = PAPER_SIZES[paperSize] || PAPER_SIZES['A4'];
  const now = new Date().toISOString().slice(0, 10);

  // 创建离屏渲染容器
  const container = document.createElement('div');
  container.innerHTML = htmlContent;
  const width = paperSize === '80mm' ? '302px' : '760px';
  container.style.cssText = `position:fixed;left:-9999px;top:0;width:${width};font-family:"Microsoft YaHei","SimHei","PingFang SC",sans-serif;font-size:12px;color:#333;background:#fff;padding:16px;z-index:-1;`;
  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
    document.body.removeChild(container);

    const imgData = canvas.toDataURL('image/png');
    const margin = paperSize === '80mm' ? 4 : 8;
    const usableW = size.pageW - margin * 2;
    const usableH = size.pageH - margin * 2;
    const imgW = usableW;
    const imgH = (canvas.height * usableW) / canvas.width;

    const doc = new jsPDF({ orientation: size.orientation, unit: 'mm', format: paperSize === '80mm' ? [80, 297] : 'a4' });

    let heightLeft = imgH;
    let position = margin;
    let pageNum = 0;

    doc.addImage(imgData, 'PNG', margin, position, imgW, imgH);
    heightLeft -= usableH;
    pageNum++;

    while (heightLeft > 0) {
      doc.addPage();
      position = -(usableH * pageNum) + margin;
      doc.addImage(imgData, 'PNG', margin, position, imgW, imgH);
      heightLeft -= usableH;
      pageNum++;
    }

    doc.save(`${title}_${now}.pdf`);
  } catch {
    if (document.body.contains(container)) document.body.removeChild(container);
    throw new Error('PDF生成失败');
  }
}

// ====== 原生打印（Electron） ======

async function printNative(htmlContent: string, title: string): Promise<void> {
  const api = (window as any).electronAPI;
  if (!api?.printHTML) {
    // 退化到 PDF 模式
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

// ====== 辅助工具 ======

/** 将金额转为大写汉字 */
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

/** 格式化日期 */
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
