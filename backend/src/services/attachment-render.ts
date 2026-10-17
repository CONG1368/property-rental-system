/**
 * 附件正文转换（用户 2026-10-17 要求：Word / Excel 附件的正文也要打印在合同后面）。
 *
 * 不依赖 LibreOffice：用项目里已有的解析库把文档转成可打印的 HTML——
 *   .docx → mammoth（保留段落/表格/图片，图片会内联成 data URI）
 *   .doc  → word-extractor（纯文本，按段落输出）
 *   .xlsx → exceljs（逐个工作表转成表格）
 * PDF / 图片由前端直接渲染成图，不走这里。
 */

export interface RenderedAttachment { html: string; kind: string; note?: string }

const esc = (s: any) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** 纯文本 → 段落 HTML（保留空行分隔） */
export function textToHtml(text: string): string {
  const lines = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const parts = lines.map((l) => l.trim()).filter((l) => l.length > 0).map((l) => '<p style="margin:3px 0">' + esc(l) + '</p>');
  return parts.join('\n');
}

/** 二维数据 → 表格 HTML（第一行当表头） */
export function rowsToTableHtml(rows: any[][], sheetName?: string, borderColor = '#999'): string {
  const body = (rows || []).filter((r) => Array.isArray(r) && r.some((c) => String(c ?? '').trim() !== ''));
  if (body.length === 0) return '';
  const head = '<h4 style="margin:10px 0 4px">' + esc(sheetName || '') + '</h4>';
  const trs = body.map((r, i) => {
    const tag = i === 0 ? 'th' : 'td';
    const style = 'border:1px solid ' + borderColor + ';padding:4px 6px;font-size:12px;' + (i === 0 ? 'background:#f2f2f2;text-align:left;' : '');
    return '<tr>' + r.map((c) => '<' + tag + ' style="' + style + '">' + esc(c) + '</' + tag + '>').join('') + '</tr>';
  }).join('');
  return head + '<table style="width:100%;border-collapse:collapse">' + trs + '</table>';
}

/** 按扩展名把附件文件转成可打印 HTML（失败返回空 html，由调用方给提示） */
export async function renderAttachmentHtml(absPath: string, ext: string, originalName: string): Promise<RenderedAttachment> {
  const e = String(ext || '').toLowerCase().replace(/^\./, '');
  try {
    if (e === 'docx') {
      const mammoth: any = (await import('mammoth')).default || (await import('mammoth'));
      const result = await mammoth.convertToHtml({ path: absPath });
      const html = String(result?.value || '');
      return { html, kind: 'docx' };
    }
    if (e === 'doc') {
      const WordExtractor: any = (await import('word-extractor')).default || (await import('word-extractor'));
      const extractor = new WordExtractor();
      const doc = await extractor.extract(absPath);
      const raw = typeof doc.getBody === 'function' ? doc.getBody() : String(doc.body || '');
      return { html: textToHtml(raw), kind: 'doc' };
    }
    if (e === 'xlsx') {
      const ExcelJS: any = (await import('exceljs')).default || (await import('exceljs'));
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.readFile(absPath);
      const parts: string[] = [];
      wb.eachSheet((ws: any) => {
        const rows: any[][] = [];
        let maxCol = 0;
        ws.eachRow({ includeEmpty: false }, (row: any) => {
          const vals: any[] = [];
          row.eachCell({ includeEmpty: true }, (cell: any, col: number) => {
            const v = cell?.value;
            vals[col - 1] = v && typeof v === 'object' && 'result' in v ? v.result : (v && v.text ? v.text : v);
            if (col > maxCol) maxCol = col;
          });
          rows.push(vals);
        });
        const table = rowsToTableHtml(rows, ws.name);
        if (table) parts.push(table);
      });
      return { html: parts.join('\n'), kind: 'xlsx' };
    }
    return { html: '', kind: e, note: 'unsupported' };
  } catch (err: any) {
    return { html: '', kind: e, note: String(err?.message || err).slice(0, 200) };
  }
}
