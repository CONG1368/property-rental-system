/**
 * 附件正文打印（用户 2026-10-17 要求：上传附件文件里的内容也要打印在合同后面）。
 *
 * 图片：直接转 dataURL 嵌入；PDF：用 pdf.js 逐页渲染成图片再嵌入（这样导出的合同 PDF/Word
 * 里就是「合同 → 签名 → 附件目录 → 每份附件的正文页」，不依赖任何 PDF 合并库）。
 * Word/Excel 类附件无法转成页面，打印时标注「请查阅原件」。
 */
export interface PrintAttachment { name?: string; title?: string; index: number }

const IMG_EXT = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'];
const PDF_EXT = ['pdf'];
/** Word / Excel：由后端用 mammoth / word-extractor / exceljs 转成可打印 HTML（用户 2026-10-17 要求） */
const DOC_EXT = ['doc', 'docx', 'xls', 'xlsx'];

export function extOfName(name: string): string {
  const m = String(name || '').toLowerCase().match(/\.([a-z0-9]{1,6})$/);
  return m ? m[1] : '';
}

/** 由附件扩展名推断 MIME（附件在磁盘上是哈希文件名、无扩展名，服务端可能给不出正确 Content-Type） */
const MIME_BY_EXT: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', bmp: 'image/bmp', webp: 'image/webp',
};

/** 转 dataURL：显式指定 MIME，避免 blob.type=application/octet-stream 时 <img> 无法渲染 */
async function toDataUrl(blob: Blob, mime: string): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)) as unknown as number[]);
  }
  return 'data:' + (mime || blob.type || 'application/octet-stream') + ';base64,' + btoa(bin);
}

/** 把一份 PDF 渲染成多张 JPEG（每页一张），失败返回空数组（不阻断打印） */
export async function renderPdfPages(pdfBlob: Blob, maxPages = 40): Promise<string[]> {
  try {
    const pdfjs: any = await import('pdfjs-dist');
    const workerUrl: any = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
    const buf = new Uint8Array(await pdfBlob.arrayBuffer());
    const doc = await pdfjs.getDocument({ data: buf }).promise;
    const out: string[] = [];
    const total = Math.min(doc.numPages, maxPages);
    for (let p = 1; p <= total; p += 1) {
      const page = await doc.getPage(p);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext('2d');
      if (!ctx) break;
      await page.render({ canvasContext: ctx, viewport }).promise;
      out.push(canvas.toDataURL('image/jpeg', 0.85));
    }
    return out;
  } catch { return []; }
}

/**
 * 生成附件正文页 HTML（每份附件另起一页，标题沿用附件目录里的编号/名称）。
 * fetchOne(index) 由调用方提供（带鉴权取原文件）。
 */
export async function buildAttachmentContentHTML(
  attachments: PrintAttachment[],
  fetchOne: (index: number) => Promise<Blob | null>,
  fetchRender?: (index: number) => Promise<{ html: string; note?: string } | null>,
): Promise<string> {
  const pages: string[] = [];
  for (let n = 0; n < attachments.length; n += 1) {
    const item = attachments[n];
    const label = String(item?.title || '').trim() || String(item?.name || '').replace(/\.[A-Za-z0-9]{1,6}$/, '') || ('附件' + (n + 1));
    const ext = extOfName(String(item?.name || ''));
    const heading = '附件' + (n + 1) + '：' + label;
    if (DOC_EXT.includes(ext)) {
      // Word / Excel：后端转成 HTML 后整页嵌入（保留段落、表格、文档里的图片）
      const rendered = fetchRender ? await fetchRender(item.index) : null;
      if (rendered && rendered.html) {
        pages.push('<div class="section" style="page-break-before:always;margin-top:18px">' +
          '<h3>' + heading + '</h3>' +
          '<div style="font-size:12.5px;line-height:1.7">' + rendered.html + '</div></div>');
      } else {
        pages.push('<div class="section" style="page-break-before:always;margin-top:24px">' +
          '<h3>' + heading + '</h3>' +
          '<p style="font-size:13px">该附件正文转换失败，请查阅原件（已在附件目录中列出）。</p></div>');
      }
      continue;
    }
    if (!IMG_EXT.includes(ext) && !PDF_EXT.includes(ext)) {
      pages.push('<div class="section" style="page-break-before:always;margin-top:24px">' +
        '<h3>' + heading + '</h3>' +
        '<p style="font-size:13px">该附件格式暂不支持打印正文，请查阅原件（已在附件目录中列出）。</p></div>');
      continue;
    }
    const blob = await fetchOne(item.index);
    if (!blob) { pages.push('<div class="section" style="page-break-before:always;margin-top:24px"><h3>' + heading + '</h3><p style="font-size:13px">附件原件缺失，无法打印正文。</p></div>'); continue; }
    if (IMG_EXT.includes(ext)) {
      const dataUrl = await toDataUrl(blob, MIME_BY_EXT[ext] || blob.type);
      pages.push('<div class="section" style="page-break-before:always;margin-top:18px">' +
        '<h3>' + heading + '</h3>' +
        '<img src="' + dataUrl + '" style="max-width:100%;max-height:240mm;display:block;margin:0 auto" /></div>');
      continue;
    }
    const imgs = await renderPdfPages(blob);
    if (imgs.length === 0) { pages.push('<div class="section" style="page-break-before:always;margin-top:24px"><h3>' + heading + '</h3><p style="font-size:13px">附件 PDF 解析失败，无法打印正文。</p></div>'); continue; }
    imgs.forEach((src, i) => {
      pages.push('<div class="section" style="page-break-before:always;margin-top:18px">' +
        '<h3>' + heading + (imgs.length > 1 ? '（第 ' + (i + 1) + ' 页 / 共 ' + imgs.length + ' 页）' : '') + '</h3>' +
        '<img src="' + src + '" style="max-width:100%;max-height:240mm;display:block;margin:0 auto" /></div>');
    });
  }
  return pages.join('\n');
}
