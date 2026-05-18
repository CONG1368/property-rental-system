// 使用说明书 Markdown → PDF 转换器
// 使用 Playwright 将 Markdown 渲染为样式化 HTML 后输出 PDF
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';

const mdFile = './docs/使用说明书.md';
const pdfFile = './docs/物业租赁综合管理系统-使用说明书-v1.0.2.pdf';

// 简易 Markdown → HTML 转换
function mdToHtml(md) {
  let html = md;

  // 标题
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // 粗体/斜体
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  // 行内代码
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // 表格
  html = html.replace(/^\|(.+)\|$/gm, (line) => {
    const cells = line.split('|').filter((c, i, arr) => i > 0 && i < arr.length - 1);
    const isHead = /^[-:\s|]+$/.test(line);
    if (isHead) return '';
    const tag = line.includes('---') ? '' : 'td';
    return '<tr>' + cells.map(c => `<${tag}>${c.trim()}</${tag}>`).join('') + '</tr>';
  });

  // 包裹表格
  html = html.replace(/(<tr>[\s\S]*?<\/tr>)(\s*<tr>)/g, '<table>$1$2');
  html = html.replace(/(<tr>[\s\S]*?<\/tr>)(?!\s*<tr>)/g, '$1</table>');

  // 无序列表
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>[\s\S]*?<\/li>)/g, (match) => {
    if (!match.includes('<ul>')) return '<ul>' + match + '</ul>';
    return match;
  });

  // 有序列表
  html = html.replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>');

  // 水平线
  html = html.replace(/^---$/gm, '<hr>');

  // 段落（连续非空行）
  html = html.replace(/\n\n+/g, '</p><p>');
  html = '<p>' + html + '</p>';

  // 清理空段落和标签间多余空白
  html = html.replace(/<p>\s*<\/p>/g, '');
  html = html.replace(/<p>\s*(<h[123]|<table|<ul|<ol|<hr|<li)/g, '$1');
  html = html.replace(/(<\/h[123]>|<\/table>|<\/ul>|<\/ol>|<\/li>|<\/hr>)\s*<\/p>/g, '$1');

  return html;
}

async function main() {
  console.log('[PDF Gen] 读取 Markdown...');
  const md = readFileSync(mdFile, 'utf-8');
  const bodyHtml = mdToHtml(md);

  const fullHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>物业租赁综合管理系统 — 使用说明书</title>
  <style>
    @page { size: A4; margin: 2cm 2.2cm; }
    body {
      font-family: "Microsoft YaHei", "SimSun", sans-serif;
      font-size: 12pt;
      line-height: 1.8;
      color: #333;
    }
    h1 {
      font-size: 22pt;
      color: #0A3D62;
      border-bottom: 3px solid #0A3D62;
      padding-bottom: 8px;
      margin-top: 0;
      page-break-before: avoid;
    }
    h2 {
      font-size: 16pt;
      color: #1a5276;
      border-bottom: 1px solid #bdc3c7;
      padding-bottom: 4px;
      margin-top: 28px;
      page-break-after: avoid;
    }
    h3 {
      font-size: 13pt;
      color: #2c3e50;
      margin-top: 20px;
      page-break-after: avoid;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 12px 0;
      font-size: 10pt;
      page-break-inside: avoid;
    }
    th, td {
      border: 1px solid #bdc3c7;
      padding: 6px 10px;
      text-align: left;
    }
    th {
      background: #0A3D62;
      color: #fff;
      font-weight: bold;
    }
    tr:nth-child(even) { background: #f8f9fa; }
    code {
      background: #f0f0f0;
      padding: 1px 5px;
      border-radius: 3px;
      font-family: "Consolas", "Courier New", monospace;
      font-size: 9pt;
    }
    strong { color: #0A3D62; }
    ul, ol { padding-left: 24px; }
    li { margin-bottom: 4px; }
    hr { border: none; border-top: 1px solid #ddd; margin: 20px 0; }
    p { text-align: justify; }
    blockquote {
      border-left: 4px solid #0A3D62;
      padding: 8px 16px;
      background: #f0f4f8;
      margin: 12px 0;
    }
    .page-break { page-break-before: always; }
    .header-info {
      text-align: right;
      font-size: 9pt;
      color: #999;
      margin-bottom: 24px;
    }
    .toc { background: #f8f9fa; padding: 16px 20px; border-radius: 4px; margin-bottom: 20px; }
  </style>
</head>
<body>
<h1>物业租赁综合管理系统 — 使用说明书</h1>
<p class="header-info">版本：v1.0.2 | 2026年5月18日 | 仅供内部使用</p>
${bodyHtml}
</body>
</html>`;

  console.log('[PDF Gen] 启动浏览器...');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent(fullHtml, { waitUntil: 'networkidle' });

  // 添加页码
  await page.evaluate(() => {
    const style = document.createElement('style');
    style.textContent = `
      @page {
        @bottom-center {
          content: "- " counter(page) " -";
          font-size: 9pt;
          color: #999;
        }
      }
    `;
    document.head.appendChild(style);
  });

  console.log('[PDF Gen] 生成 PDF...');
  if (!existsSync('./docs')) mkdirSync('./docs', { recursive: true });

  await page.pdf({
    path: pdfFile,
    format: 'A4',
    margin: { top: '2cm', bottom: '2cm', left: '2.2cm', right: '2.2cm' },
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: '<span style="font-size:8pt;color:#999;margin-left:2cm;">物业租赁综合管理系统 — 使用说明书 v1.0.2</span>',
    footerTemplate: '<span style="font-size:8pt;color:#999;margin:0 auto;">第 <span class="pageNumber"></span> 页 / 共 <span class="totalPages"></span> 页</span>',
  });

  await browser.close();
  console.log(`[PDF Gen] 完成: ${pdfFile}`);
}

main().catch((err) => {
  console.error('[PDF Gen] 失败:', err.message);
  process.exit(1);
});
