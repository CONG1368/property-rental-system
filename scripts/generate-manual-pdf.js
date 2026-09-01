import { chromium } from 'playwright';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname, basename } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const docsDir = resolve(__dirname, '../docs');
const screenshotDir = resolve(docsDir, 'screenshots');
const mdFile = resolve(docsDir, '使用说明书.md');
// 版本号唯一来源：根 package.json（禁止在脚本里写死）
const APP_VERSION = JSON.parse(readFileSync(resolve(__dirname, '../package.json'), 'utf-8')).version;
const BUILD_DATE = new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
const pdfFile = resolve(docsDir, `物业租赁综合管理系统-使用说明书-v${APP_VERSION}.pdf`);

// 生成与 GitHub 一致的标题锚点（目录内部跳转用）
function slugify(text) {
  return text.trim().toLowerCase().replace(/[.,:：、（）()]/g, '').replace(/\s+/g, '-');
}

function mdToHtml(md) {
  let html = md;

  // 图片 ![alt](path) — 转为 base64 data URI 内嵌，确保 PDF 跨平台可移植
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, src) => {
    const absPath = resolve(docsDir, src);
    const buf = readFileSync(absPath);
    const ext = absPath.split('.').pop()?.toLowerCase() || 'png';
    const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png';
    const b64 = buf.toString('base64');
    return `<div style="text-align:center;margin:16px 0"><img src="data:${mime};base64,${b64}" alt="${alt}" style="max-width:100%;height:auto;border:1px solid #e0e0e0;border-radius:4px;box-shadow:0 2px 8px rgba(0,0,0,0.1)" /><p style="font-size:9pt;color:#999;margin:6px 0 0">${alt}</p></div>`;
  });

  // 围栏代码块（先于其它规则处理，块内不再做 Markdown 替换）
  const codeBlocks = [];
  html = html.replace(/```[a-zA-Z]*\n([\s\S]*?)```/g, (m, body) => {
    const esc = body.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    codeBlocks.push(`<pre>${esc}</pre>`);
    return `@@CODEBLOCK${codeBlocks.length - 1}@@`;
  });

  // 标题（带锚点 id，供目录跳转）
  html = html.replace(/^### (.+)$/gm, (m, t) => `<h3 id="${slugify(t)}">${t}</h3>`);
  html = html.replace(/^## (.+)$/gm, (m, t) => `<h2 id="${slugify(t)}">${t}</h2>`);
  html = html.replace(/^# (.+)$/gm, (m, t) => `<h1 id="${slugify(t)}">${t}</h1>`);

  // 链接 [文案](#锚点 或 URL)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // 粗体
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // 行内代码
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // 水平线
  html = html.replace(/^---$/gm, '<hr>');

  // 表格
  const lines = html.split('\n');
  let inTable = false;
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('|') && line.endsWith('|')) {
      if (/^\|[-:\s|]+\|$/.test(line)) continue; // 分隔行跳过
      const cells = line.split('|').filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
      const tag = !inTable ? 'th' : 'td';
      out.push(`<tr>${cells.map(c => `<${tag}>${c.trim()}</${tag}>`).join('')}</tr>`);
      if (!inTable) { inTable = true; out[out.length - 1] = '<table>' + out[out.length - 1]; }
    } else {
      if (inTable) { out[out.length - 1] += '</table>'; inTable = false; }
      out.push(line);
    }
  }
  if (inTable) out[out.length - 1] += '</table>';
  html = out.join('\n');

  // 无序列表
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/((?:<li>.*<\/li>\s*)+)/g, '<ul>$1</ul>');

  // 有序列表
  html = html.replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>');

  // 引用块
  html = html.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');

  // 段落（连续空行）
  html = html.replace(/\n\n+/g, '</p><p>');
  html = '<p>' + html + '</p>';

  // 清理
  html = html.replace(/<p>\s*<\/p>/g, '');
  html = html.replace(/<p>\s*(<h[123]|<table|<ul|<ol|<hr|<blockquote|<div)/g, '$1');
  html = html.replace(/(<\/h[123]>|<\/table>|<\/ul>|<\/ol>|<\/blockquote>|<\/div>|<\/pre>)\s*<\/p>/g, '$1');
  html = html.replace(/<p>\s*(<pre)/g, '$1');

  // 还原代码块
  html = html.replace(/@@CODEBLOCK(\d+)@@/g, (m, i) => codeBlocks[Number(i)]);

  return html;
}

async function main() {
  console.log('[PDF] Reading Markdown...');
  let md = readFileSync(mdFile, 'utf-8');
  // 去掉 Markdown 自带的一级标题与版本引用行 —— PDF 由下方模板统一渲染标题块，
  // 避免与 .md 在 GitHub 上直读时的标题重复。
  md = md.replace(/^#\s+.+\r?\n(\s*\r?\n)?(>\s+.+\r?\n)?/, '');
  const bodyHtml = mdToHtml(md);

  const fullHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>物业租赁综合管理系统 — 使用说明书</title>
<style>
  * { box-sizing: border-box; }
  body {
    font-family: "Microsoft YaHei", "SimHei", "PingFang SC", sans-serif;
    font-size: 11pt;
    line-height: 1.9;
    color: #333;
    max-width: 720px;
    margin: 0 auto;
    padding: 20px 0;
  }
  h1 {
    font-size: 22pt;
    color: #0A3D62;
    border-bottom: 3px solid #0A3D62;
    padding-bottom: 8px;
    margin-top: 0;
    page-break-before: avoid;
    page-break-after: avoid;
  }
  h2 {
    font-size: 15pt;
    color: #1a5276;
    border-bottom: 1px solid #bdc3c7;
    padding-bottom: 4px;
    margin-top: 32px;
    page-break-before: always;
    page-break-after: avoid;
  }
  h3 {
    font-size: 12pt;
    color: #2c3e50;
    margin-top: 20px;
    page-break-after: avoid;
  }
  p { text-align: justify; }
  table {
    border-collapse: collapse;
    width: 100%;
    margin: 12px 0;
    font-size: 10pt;
    page-break-inside: avoid;
  }
  th, td {
    border: 1px solid #bdc3c7;
    padding: 5px 8px;
    text-align: left;
  }
  th { background: #0A3D62; color: #fff; font-weight: bold; }
  tr:nth-child(even) { background: #f8f9fa; }
  code {
    background: #f0f0f0;
    padding: 1px 5px;
    border-radius: 3px;
    font-family: "Consolas", monospace;
    font-size: 9pt;
  }
  strong { color: #0A3D62; }
  ul, ol { padding-left: 24px; }
  li { margin-bottom: 3px; }
  hr { border: none; border-top: 1px solid #ddd; margin: 24px 0; }
  blockquote {
    border-left: 4px solid #0A3D62;
    padding: 8px 16px;
    background: #f0f4f8;
    margin: 12px 0;
  }
  img { page-break-inside: avoid; }
  pre {
    background: #f5f7fa;
    border: 1px solid #e0e4ea;
    border-left: 3px solid #0A3D62;
    padding: 8px 12px;
    font-family: "Consolas", monospace;
    font-size: 9pt;
    line-height: 1.6;
    white-space: pre-wrap;
    page-break-inside: avoid;
  }
  a { color: #1a5276; text-decoration: none; }
  .header-info { text-align: right; font-size: 9pt; color: #999; margin-bottom: 24px; }
</style>
</head>
<body>
<h1>物业租赁综合管理系统 — 使用说明书</h1>
<p class="header-info">版本 v${APP_VERSION} | ${BUILD_DATE}</p>
${bodyHtml}
</body>
</html>`;

  // --html: 额外落地中间 HTML，便于排查 Markdown 转换问题
  if (process.argv.includes('--html')) {
    const htmlPath = resolve(docsDir, '.manual-preview.html');
    writeFileSync(htmlPath, fullHtml, 'utf-8');
    console.log('[PDF] HTML written: ' + htmlPath);
  }

  console.log('[PDF] Launching browser...');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent(fullHtml, { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(1000);

  if (!existsSync(docsDir)) mkdirSync(docsDir, { recursive: true });

  console.log('[PDF] Generating PDF...');
  await page.pdf({
    path: pdfFile,
    format: 'A4',
    margin: { top: '1.8cm', bottom: '2cm', left: '2cm', right: '2cm' },
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: `<div style="font-size:8pt;color:#999;text-align:center;width:100%;padding:0 2cm;">物业租赁综合管理系统 — 使用说明书 v${APP_VERSION}</div>`,
    footerTemplate: '<div style="font-size:8pt;color:#999;text-align:center;width:100%;padding:0 2cm;">第 <span class="pageNumber"></span> 页 / 共 <span class="totalPages"></span> 页</div>',
  });

  await browser.close();
  console.log(`[PDF] Done: ${pdfFile}`);
}

main().catch(err => { console.error('[PDF] Failed:', err.message); process.exit(1); });
