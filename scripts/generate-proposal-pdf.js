// 产品方案 Markdown → PDF 转换器（增强版）
// 匹配 PPTX 深蓝+金色商务风格，支持章节页、KPI卡片、功能卡片等特殊元素
import { chromium } from 'playwright';
import { readFileSync, existsSync, mkdirSync } from 'fs';

const mdFile = './docs/物业租赁综合管理系统-产品方案-v1.0.2.md';
const pdfFile = './docs/物业租赁综合管理系统-产品方案-v1.0.2.pdf';

// 品牌色
const C = {
  primary:    '#0A3D62',   // 深蓝主色
  primaryLt:  '#1a5276',   // 深蓝亮
  gold:       '#F6B93B',   // 金色点缀
  accent:     '#82CCDD',   // 浅蓝辅助
  bg:         '#DFE6E9',   // 页面背景灰
  success:    '#00B894',   // 成功绿
  warning:    '#FF6B35',   // 警告橙
  title:      '#2C3E50',   // 标题深灰
  body:       '#34495E',   // 正文中灰
  muted:      '#7F8C8D',   // 辅助文字浅灰
  white:      '#FFFFFF',
  lightBg:    '#f8f9fa',
};

function mdToHtml(md) {
  let html = md;

  // ── 特殊块：章节分隔页 <!-- section: 编号 标题 副标题 --> ──
  html = html.replace(/<!--\s*section:\s*(.+?)\s*-->/g, (_, text) => {
    const parts = text.split('|').map(s => s.trim());
    const num = parts[0] || '';
    const title = parts[1] || '';
    const sub = parts[2] || '';
    return `<div class="section-page">
      <div class="section-num">${num}</div>
      <div class="section-title">${title}</div>
      ${sub ? `<div class="section-sub">${sub}</div>` : ''}
    </div>`;
  });

  // ── 特殊块：KPI卡片行 <!-- kpi: 标签1=数值1[颜色] | 标签2=数值2[颜色] | ... --> ──
  html = html.replace(/<!--\s*kpi:\s*(.+?)\s*-->/g, (_, text) => {
    const items = text.split('|').map(s => s.trim()).filter(Boolean);
    const cards = items.map(item => {
      const m = item.match(/^(.+?)=(.+?)(?:\[(.+?)\])?$/);
      if (!m) return '';
      const label = m[1].trim();
      const value = m[2].trim();
      const color = m[3] || C.primary;
      return `<div class="kpi-card"><div class="kpi-value" style="color:${color}">${value}</div><div class="kpi-label">${label}</div></div>`;
    }).join('');
    return `<div class="kpi-row">${cards}</div>`;
  });

  // ── 特殊块：功能卡片 <!-- cards:3 | 标题1=描述1 | 标题2=描述2 | ... --> ──
  html = html.replace(/<!--\s*cards:(\d+):?\s*(.+?)\s*-->/g, (_, cols, text) => {
    const items = text.split('|').map(s => s.trim()).filter(Boolean);
    const cards = items.map(item => {
      const idx = item.indexOf('=');
      if (idx === -1) return '';
      const title = item.slice(0, idx).trim();
      const desc = item.slice(idx + 1).trim();
      return `<div class="feature-card"><div class="feature-card-title">${title}</div><div class="feature-card-desc">${desc}</div></div>`;
    }).join('');
    return `<div class="feature-cards cols-${cols}">${cards}</div>`;
  });

  // ── 特殊块：流程图 <!-- flow: 步骤1 → 步骤2 → 步骤3 → ... --> ──
  html = html.replace(/<!--\s*flow:\s*(.+?)\s*-->/g, (_, text) => {
    const steps = text.split('→').map(s => s.trim()).filter(Boolean);
    const items = steps.map((s, i) =>
      `<div class="flow-step"><div class="flow-num">${i + 1}</div><div class="flow-label">${s}</div></div>`
    ).join('<div class="flow-arrow">→</div>');
    return `<div class="flow-row">${items}</div>`;
  });

  // ── 特殊块：进度条 <!-- progress: 标签=百分比=颜色 | ... --> ──
  html = html.replace(/<!--\s*progress:\s*(.+?)\s*-->/g, (_, text) => {
    const items = text.split('|').map(s => s.trim()).filter(Boolean);
    return items.map(item => {
      const parts = item.split('=');
      const label = parts[0] || '';
      const pct = parts[1] || '0';
      const color = parts[2] || C.success;
      return `<div class="progress-item"><div class="progress-label">${label}</div><div class="progress-bar"><div class="progress-fill" style="width:${pct}%;background:${color}"></div></div><div class="progress-pct">${pct}%</div></div>`;
    }).join('');
  });

  // ── 标准 Markdown 转换 ──
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // 粗体
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  // 行内代码
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // 表格
  html = html.replace(/^\|(.+)\|$/gm, (line) => {
    const cells = line.split('|').filter((c, i, arr) => i > 0 && i < arr.length - 1);
    if (/^[-:\s|]+$/.test(line)) return '';
    const tag = line.includes('---') ? '' : 'td';
    return '<tr>' + cells.map(c => `<${tag}>${c.trim()}</${tag}>`).join('') + '</tr>';
  });
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
  html = html.replace(/(<li>[\s\S]*?<\/li>)/g, (match) => {
    if (match.includes('<ul>') || match.includes('<ol>')) return match;
    if (!match.includes('<ol>')) return '<ol>' + match + '</ol>';
    return match;
  });

  // 代码块
  html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');

  // 水平线
  html = html.replace(/^---$/gm, '<hr>');

  // Callout 框：> **⚠**... → 警告, > **✓**... → 提示
  // 必须在段落转换之前处理
  html = html.replace(/^&gt; \*\*(⚠|✓|📊)\*\*(.+)$/gm, (_, icon, text) => {
    const cls = icon === '⚠' ? 'warning' : icon === '✓' ? 'tip' : 'info';
    return `<div class="callout callout-${cls}"><strong>${icon}</strong>${text}</div>`;
  });
  html = html.replace(/^> \*\*(⚠|✓|📊)\*\*(.+)$/gm, (_, icon, text) => {
    const cls = icon === '⚠' ? 'warning' : icon === '✓' ? 'tip' : 'info';
    return `<div class="callout callout-${cls}"><strong>${icon}</strong>${text}</div>`;
  });

  // 段落
  html = html.replace(/\n\n+/g, '</p><p>');
  html = '<p>' + html + '</p>';

  // 清理
  html = html.replace(/<p>\s*<\/p>/g, '');
  html = html.replace(/<p>\s*(<h[123]|<table|<ul|<ol|<hr|<li|<pre|<div)/g, '$1');
  html = html.replace(/(<\/h[123]>|<\/table>|<\/ul>|<\/ol>|<\/li>|<\/hr>|<\/pre>|<\/div>)\s*<\/p>/g, '$1');

  // 合并连续的 ul/ol
  html = html.replace(/<\/ul>\s*<ul>/g, '');
  html = html.replace(/<\/ol>\s*<ol>/g, '');

  return html;
}

async function main() {
  console.log('[PDF Gen] 读取产品方案 Markdown...');
  if (!existsSync(mdFile)) {
    console.error(`[PDF Gen] 文件不存在: ${mdFile}`);
    process.exit(1);
  }
  const md = readFileSync(mdFile, 'utf-8');
  const bodyHtml = mdToHtml(md);

  const fullHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>物业租赁综合管理系统 — 产品方案</title>
  <style>
    /* ====== 页面基础 ====== */
    @page {
      size: A4;
      margin: 2cm 2.2cm;
    }
    @page section-page {
      margin: 0;
      background: ${C.primary};
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: "Microsoft YaHei", "Noto Sans CJK SC", "SimSun", sans-serif;
      font-size: 10.5pt;
      line-height: 1.85;
      color: ${C.body};
    }

    /* ====== 封面 ====== */
    .cover {
      background: linear-gradient(135deg, ${C.primary} 0%, #0d4f7c 100%);
      color: ${C.white};
      text-align: center;
      padding: 100px 40px 60px;
      margin: -2cm -2.2cm;
      page-break-after: always;
    }
    .cover h1 {
      font-size: 30pt;
      font-weight: 700;
      color: ${C.white};
      border: none;
      margin-bottom: 8px;
      letter-spacing: 2px;
    }
    .cover .cover-tag {
      display: inline-block;
      color: ${C.gold};
      font-size: 18pt;
      font-weight: 700;
      border: 3px solid ${C.gold};
      padding: 6px 28px;
      margin: 16px 0 24px;
      letter-spacing: 4px;
    }
    .cover .cover-sub {
      color: ${C.accent};
      font-size: 11pt;
      margin-bottom: 40px;
    }
    .cover .cover-meta {
      font-size: 9pt;
      color: rgba(255,255,255,0.65);
    }
    .cover .cover-meta span {
      margin: 0 10px;
      padding: 4px 14px;
      border: 1px solid rgba(255,255,255,0.25);
      border-radius: 20px;
      font-size: 8.5pt;
    }

    /* ====== 目录 ====== */
    .toc { page-break-after: always; }
    .toc .toc-title {
      font-size: 22pt;
      color: ${C.primary};
      border-bottom: 3px solid ${C.primary};
      padding-bottom: 8px;
      margin-bottom: 20px;
    }
    .toc .toc-item {
      display: flex;
      align-items: baseline;
      padding: 8px 0;
      border-bottom: 1px dotted ${C.bg};
    }
    .toc .toc-num {
      font-size: 18pt;
      font-weight: 700;
      color: ${C.primary};
      width: 40px;
      flex-shrink: 0;
    }
    .toc .toc-name {
      font-size: 12pt;
      font-weight: 600;
      color: ${C.title};
      flex: 1;
    }
    .toc .toc-desc {
      font-size: 9pt;
      color: ${C.muted};
      margin-left: 12px;
    }

    /* ====== 章节分隔页 ====== */
    .section-page {
      background: ${C.primary};
      color: ${C.white};
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      text-align: center;
      margin: -2cm -2.2cm;
      padding: 4cm 2cm;
      min-height: 25.7cm;
      page-break-before: always;
      page-break-after: always;
    }
    .section-page .section-num {
      font-size: 96pt;
      font-weight: 800;
      color: rgba(255,255,255,0.15);
      line-height: 1;
      margin-bottom: 8px;
    }
    .section-page .section-title {
      font-size: 26pt;
      font-weight: 700;
      letter-spacing: 3px;
      margin-bottom: 12px;
    }
    .section-page .section-sub {
      font-size: 12pt;
      color: ${C.gold};
      letter-spacing: 1px;
    }

    /* ====== 标题 ====== */
    h1 {
      font-size: 22pt;
      color: ${C.primary};
      border-bottom: 3px solid ${C.primary};
      padding-bottom: 8px;
      margin-top: 0;
      page-break-before: avoid;
    }
    h2 {
      font-size: 15pt;
      color: ${C.primaryLt};
      border-left: 5px solid ${C.gold};
      padding: 6px 0 6px 12px;
      margin-top: 30px;
      page-break-after: avoid;
    }
    h3 {
      font-size: 12pt;
      color: ${C.title};
      margin-top: 22px;
      page-break-after: avoid;
    }
    h3::before {
      content: "▸ ";
      color: ${C.gold};
    }

    /* ====== KPI 卡片 ====== */
    .kpi-row {
      display: flex;
      gap: 14px;
      margin: 18px 0;
      page-break-inside: avoid;
    }
    .kpi-card {
      flex: 1;
      background: ${C.white};
      border: 1px solid ${C.bg};
      border-radius: 8px;
      text-align: center;
      padding: 16px 10px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.04);
    }
    .kpi-card .kpi-value {
      font-size: 24pt;
      font-weight: 700;
      line-height: 1.2;
    }
    .kpi-card .kpi-label {
      font-size: 9pt;
      color: ${C.muted};
      margin-top: 4px;
    }

    /* ====== 功能卡片 ====== */
    .feature-cards {
      display: flex;
      gap: 14px;
      margin: 16px 0;
      page-break-inside: avoid;
    }
    .feature-cards.cols-2 .feature-card { flex: 0 0 calc(50% - 7px); }
    .feature-cards.cols-3 .feature-card { flex: 0 0 calc(33.33% - 9px); }
    .feature-cards.cols-4 .feature-card { flex: 0 0 calc(25% - 10px); }
    .feature-card {
      background: ${C.white};
      border: 1px solid ${C.bg};
      border-radius: 8px;
      padding: 16px 14px;
      box-shadow: 0 2px 6px rgba(0,0,0,0.03);
      border-top: 3px solid ${C.primary};
    }
    .feature-card:nth-child(2) { border-top-color: ${C.gold}; }
    .feature-card:nth-child(3) { border-top-color: ${C.success}; }
    .feature-card:nth-child(4) { border-top-color: ${C.warning}; }
    .feature-card .feature-card-title {
      font-size: 11pt;
      font-weight: 700;
      color: ${C.title};
      margin-bottom: 6px;
    }
    .feature-card .feature-card-desc {
      font-size: 9pt;
      color: ${C.body};
      line-height: 1.6;
    }

    /* ====== 流程图 ====== */
    .flow-row {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      margin: 20px 0;
      page-break-inside: avoid;
    }
    .flow-step {
      text-align: center;
      min-width: 80px;
    }
    .flow-step .flow-num {
      width: 36px; height: 36px;
      background: ${C.primary};
      color: ${C.white};
      border-radius: 50%;
      font-size: 14pt;
      font-weight: 700;
      line-height: 36px;
      margin: 0 auto 6px;
    }
    .flow-step .flow-label {
      font-size: 9pt;
      color: ${C.title};
      font-weight: 600;
    }
    .flow-arrow {
      font-size: 18pt;
      color: ${C.gold};
      font-weight: 700;
    }

    /* ====== Callout 提示框 ====== */
    .callout {
      padding: 12px 16px;
      margin: 14px 0;
      border-radius: 6px;
      font-size: 10pt;
      page-break-inside: avoid;
    }
    .callout-warning {
      background: #fef5e7;
      border-left: 5px solid ${C.warning};
      color: #935d1a;
    }
    .callout-tip {
      background: #eafaf1;
      border-left: 5px solid ${C.success};
      color: #1a6d3c;
    }
    .callout-info {
      background: #eaf2f8;
      border-left: 5px solid ${C.primary};
      color: ${C.primaryLt};
    }

    /* ====== 进度条 ====== */
    .progress-item {
      display: flex;
      align-items: center;
      gap: 10px;
      margin: 8px 0;
      page-break-inside: avoid;
    }
    .progress-label {
      width: 90px;
      font-size: 9pt;
      color: ${C.title};
      font-weight: 600;
      text-align: right;
    }
    .progress-bar {
      flex: 1;
      height: 10px;
      background: ${C.bg};
      border-radius: 5px;
      overflow: hidden;
    }
    .progress-fill {
      height: 100%;
      border-radius: 5px;
      transition: width 0.3s;
    }
    .progress-pct {
      width: 36px;
      font-size: 9pt;
      font-weight: 700;
      color: ${C.primary};
    }

    /* ====== 表格 ====== */
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 14px 0;
      font-size: 9pt;
      page-break-inside: avoid;
    }
    th, td {
      border: 1px solid ${C.bg};
      padding: 7px 10px;
      text-align: left;
    }
    th {
      background: ${C.primary};
      color: ${C.white};
      font-weight: 600;
      font-size: 9pt;
    }
    tr:nth-child(even) { background: ${C.lightBg}; }

    /* ====== 基础元素 ====== */
    code {
      background: #f0f0f0;
      padding: 1px 5px;
      border-radius: 3px;
      font-family: "Consolas", "Courier New", monospace;
      font-size: 8.5pt;
    }
    pre {
      background: #f4f4f4;
      padding: 12px 16px;
      border-radius: 6px;
      font-family: "Consolas", "Courier New", monospace;
      font-size: 8pt;
      overflow-x: auto;
      line-height: 1.5;
      page-break-inside: avoid;
    }
    strong { color: ${C.primary}; }
    ul, ol { padding-left: 22px; }
    li { margin-bottom: 4px; }
    hr {
      border: none;
      border-top: 1px solid ${C.bg};
      margin: 20px 0;
    }
    p { text-align: justify; }
    blockquote {
      border-left: 4px solid ${C.primary};
      padding: 8px 16px;
      background: ${C.lightBg};
      margin: 12px 0;
    }

    /* ====== 页面信息 ====== */
    .header-info {
      text-align: right;
      font-size: 9pt;
      color: ${C.muted};
      margin-bottom: 24px;
    }
    .page-break { page-break-before: always; }

    /* ====== 打印设置 ====== */
    @media print {
      .section-page { -webkit-print-color-adjust: exact; }
      .cover { -webkit-print-color-adjust: exact; }
      .kpi-card { -webkit-print-color-adjust: exact; }
    }
  </style>
</head>
<body>
<div class="cover">
  <h1>物业租赁综合管理系统</h1>
  <div class="cover-tag">产 品 方 案</div>
  <div class="cover-sub">Property Rental Comprehensive Management System</div>
  <div class="cover-meta">
    <span>版本 v1.0.2</span>
    <span>2026年5月</span>
    <span>状态：已发布</span>
  </div>
</div>
${bodyHtml}
</body>
</html>`;

  console.log('[PDF Gen] 启动浏览器...');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent(fullHtml, { waitUntil: 'networkidle' });

  if (!existsSync('./docs')) mkdirSync('./docs', { recursive: true });

  console.log('[PDF Gen] 生成 PDF...');
  await page.pdf({
    path: pdfFile,
    format: 'A4',
    margin: { top: '2cm', bottom: '2cm', left: '2.2cm', right: '2.2cm' },
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: '<span style="font-size:8pt;color:#999;margin-left:2cm;">物业租赁综合管理系统 — 产品方案 v1.0.2</span>',
    footerTemplate: '<span style="font-size:8pt;color:#999;margin:0 auto;">第 <span class="pageNumber"></span> 页 / 共 <span class="totalPages"></span> 页</span>',
  });

  await browser.close();
  console.log(`[PDF Gen] 完成: ${pdfFile}`);
}

main().catch((err) => {
  console.error('[PDF Gen] 失败:', err.message);
  process.exit(1);
});
