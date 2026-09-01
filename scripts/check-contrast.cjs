#!/usr/bin/env node
/**
 * WCAG 2.1 对比度自检脚本 — 湛蓝玻璃拟物主题
 * ============================================================
 * 用途：校验「物业租赁综合管理系统」前端主题的文字色 × 背景色组合
 *       是否满足 WCAG 2.1 AA 级对比度要求。
 *
 * 算法依据：
 *   1) sRGB 通道值归一化到 [0,1]
 *   2) 线性化：c <= 0.03928 ? c/12.92 : ((c+0.055)/1.055)^2.4
 *   3) 相对亮度 L = 0.2126*R + 0.7152*G + 0.0722*B
 *   4) 对比度 = (L_lighter + 0.05) / (L_darker + 0.05)
 *
 * 半透明处理：玻璃拟物大量使用 rgba 半透明面（如 rgba(255,255,255,.62)），
 *   必须先按 alpha 合成（source-over）到不透明底色上，再参与亮度计算。
 *
 * 判定阈值（WCAG 2.1 AA）：
 *   - 普通文本  normal ：>= 4.5:1
 *   - 大文本    large  ：>= 3.0:1（>=18.66px 粗体 或 >=24px）
 *   - UI 组件/图形边界 ui：>= 3.0:1
 *
 * 运行：node scripts/check-contrast.cjs
 * 退出码：全部通过 0；存在 FAIL 1
 *
 * 注意：本脚本为只读自检工具，不会修改任何样式文件。
 */

'use strict';

// ============================================================
// 一、颜色解析工具
// ============================================================

/**
 * 解析颜色字符串为 { r, g, b, a }（r/g/b 为 0-255，a 为 0-1）
 * 支持：#rgb / #rrggbb / rgb(r,g,b) / rgba(r,g,b,a)
 */
function parseColor(input) {
  const str = String(input).trim().toLowerCase();

  // 十六进制：#abc 或 #aabbcc
  const hexMatch = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(str);
  if (hexMatch) {
    let hex = hexMatch[1];
    if (hex.length === 3) {
      hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
      a: 1,
    };
  }

  // rgb() / rgba()
  const rgbMatch = /^rgba?\(([^)]+)\)$/.exec(str);
  if (rgbMatch) {
    const parts = rgbMatch[1].split(/[,/\s]+/).filter(Boolean);
    if (parts.length < 3) throw new Error('颜色分量不足：' + input);
    const r = Number(parts[0]);
    const g = Number(parts[1]);
    const b = Number(parts[2]);
    // alpha 允许写成 .62 / 0.62 / 62%
    let a = 1;
    if (parts.length >= 4) {
      const raw = parts[3];
      a = raw.endsWith('%') ? Number(raw.slice(0, -1)) / 100 : Number(raw);
    }
    return { r, g, b, a };
  }

  throw new Error('无法解析的颜色值：' + input);
}

/** 把 { r, g, b } 格式化为大写十六进制字符串（四舍五入到整数通道） */
function toHex(color) {
  const to2 = (v) => {
    const n = Math.max(0, Math.min(255, Math.round(v)));
    return n.toString(16).padStart(2, '0');
  };
  return ('#' + to2(color.r) + to2(color.g) + to2(color.b)).toUpperCase();
}

// ============================================================
// 二、Alpha 合成（source-over）
// ============================================================

/**
 * 将半透明前景 fg 合成到（假定不透明的）底色 bg 上，返回不透明结果色。
 * 公式：out = fg * a + bg * (1 - a)
 * 若底色本身带 alpha，则先递归合成到给定的最终底色上（由调用方保证链条闭合）。
 */
function compositeOver(fg, bg) {
  const a = fg.a;
  if (a >= 1) return { r: fg.r, g: fg.g, b: fg.b, a: 1 };
  return {
    r: fg.r * a + bg.r * (1 - a),
    g: fg.g * a + bg.g * (1 - a),
    b: fg.b * a + bg.b * (1 - a),
    a: 1,
  };
}

/**
 * 把一条「图层栈」压平成不透明色。
 * layers 从最底层到最顶层排列，最底层必须不透明。
 * 例：flatten(['#dde7f5', 'rgba(255,255,255,.62)']) → 玻璃卡片面的实际渲染色
 */
function flatten(layers) {
  if (!layers.length) throw new Error('图层栈为空');
  let base = parseColor(layers[0]);
  if (base.a < 1) throw new Error('最底层图层必须不透明：' + layers[0]);
  for (let i = 1; i < layers.length; i++) {
    base = compositeOver(parseColor(layers[i]), base);
  }
  return base;
}

// ============================================================
// 三、WCAG 2.1 相对亮度与对比度
// ============================================================

/** 单通道线性化（sRGB → 线性 RGB） */
function linearize(channel8bit) {
  const c = channel8bit / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** 相对亮度 L = 0.2126R + 0.7152G + 0.0722B（要求入参为不透明色） */
function relativeLuminance(color) {
  return (
    0.2126 * linearize(color.r) +
    0.7152 * linearize(color.g) +
    0.0722 * linearize(color.b)
  );
}

/** 对比度 =(L1+0.05)/(L2+0.05)，L1 为较亮者 */
function contrastRatio(colorA, colorB) {
  const l1 = relativeLuminance(colorA);
  const l2 = relativeLuminance(colorB);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// ============================================================
// 四、判定阈值
// ============================================================

// 用途 → AA 门槛
const THRESHOLDS = {
  normal: 4.5, // 普通文本
  large: 3.0,  // 大文本（>=18.66px 粗体 或 >=24px）
  ui: 3.0,     // UI 组件 / 图形边界
};

const KIND_LABEL = {
  normal: '正文',
  large: '大字',
  ui: 'UI件',
};

// ============================================================
// 五、项目实际背景定义（图层栈，取自 variables.scss / global.scss / AppLayout.vue）
// ============================================================

// 页面渐变底：linear-gradient(135deg, #e3ecfb, #dbe6f8 45%, #e0edf7)
// 回退固定色 #dde7f5。对比度取「最亮端 #e3ecfb」与「回退色 #dde7f5」两个采样点，
// 深色文字在最亮底上对比度最高、在最暗底上最低，因此以 #dde7f5 为保守基准。
const PAGE_BG_FALLBACK = '#dde7f5'; // $color-bg-fixed（保守/较暗采样点）
const PAGE_BG_LIGHT = '#e3ecfb';    // 渐变最亮端采样点

// 各类背景的图层栈（最底 → 最顶）
const SURFACES = {
  // (b) 页面渐变底 —— 直接落在渐变上的文字
  pageFallback: { name: '页面渐变底(#dde7f5)', layers: [PAGE_BG_FALLBACK] },
  pageLight: { name: '页面渐变底(#e3ecfb)', layers: [PAGE_BG_LIGHT] },

  // (a) 玻璃卡片面 —— rgba(255,255,255,.62) 合成到渐变底
  glassOnDark: { name: '玻璃卡片面@#dde7f5', layers: [PAGE_BG_FALLBACK, 'rgba(255,255,255,.62)'] },
  glassOnLight: { name: '玻璃卡片面@#e3ecfb', layers: [PAGE_BG_LIGHT, 'rgba(255,255,255,.62)'] },
  // 强玻璃面 $color-bg-elev-strong
  glassStrong: { name: '强玻璃面(.78)@#dde7f5', layers: [PAGE_BG_FALLBACK, 'rgba(255,255,255,.78)'] },
  // 弹层/对话框 .el-dialog/.el-popper 背景 rgba(255,255,255,.85)
  dialog: { name: '弹层/对话框(.85)', layers: [PAGE_BG_FALLBACK, 'rgba(255,255,255,.85)'] },
  // 侧边栏 rgba(255,255,255,.55)
  sidebar: { name: '侧边栏(.55)@#dde7f5', layers: [PAGE_BG_FALLBACK, 'rgba(255,255,255,.55)'] },
  // 输入框 .el-input__wrapper 背景 rgba(255,255,255,.6)（位于玻璃卡片之上）
  input: { name: '输入框(.6)@玻璃卡片', layers: [PAGE_BG_FALLBACK, 'rgba(255,255,255,.62)', 'rgba(255,255,255,.6)'] },
  // 表格表头 rgba(255,255,255,.55)（位于玻璃卡片之上）
  tableHead: { name: '表头(.55)@玻璃卡片', layers: [PAGE_BG_FALLBACK, 'rgba(255,255,255,.62)', 'rgba(255,255,255,.55)'] },

  // (c) 深色顶栏 rgba(26,43,68,.82) 合成到渐变底
  topNav: { name: '深色顶栏(.82)@#dde7f5', layers: [PAGE_BG_FALLBACK, 'rgba(26,43,68,.82)'] },
};

// 主题文字/强调色令牌
const TOKENS = {
  title: '#1f2430',      // $color-text-title
  body: '#3a4354',       // $color-text-body
  aux: '#5b6472',        // $color-text-aux
  subtle: '#5f6675',     // $color-text-subtle（也是 --el-text-color-placeholder 占位符色）
  primary: '#4f7cf7',    // $color-primary（仅用于填充/图表/进度条等 UI 件）
  accent: '#3b66e0',     // $color-accent（primary hover 填充）
  success: '#10b981',    // $color-success（标签底/图表）
  warning: '#f59e0b',    // $color-warning（标签底/图表）
  danger: '#ef4444',     // $color-danger（标签底/图表）
  white: '#ffffff',      // $color-white
  whiteBorder: 'rgba(255,255,255,.72)', // $color-border 白描边（纯装饰轮廓）
  // —— 无障碍文字变体（正文/链接/细线图标专用，见 docs/对比度检查报告.md）——
  primaryText: '#2b57c9',   // $color-primary-text
  accentText: '#1e50bd',    // $color-primary-text-hover
  successText: '#0a7652',   // $color-success-text
  warningText: '#8a5200',   // $color-warning-text
  dangerText: '#bf2626',    // $color-danger-text
  borderControl: '#6f8299', // $color-border-control（交互控件描边）
  onDarkPrimary: '#a8c2fc', // $color-on-dark-primary（深色顶栏上的主色）
  onDarkDanger: '#fca5a5',  // $color-on-dark-danger（深色顶栏上的红点）
};

// ============================================================
// 六、检查清单
// 每条：{ scene 场景, fg 前景色, surface 背景键, kind 用途 }
// ============================================================

const CHECKLIST = [
  // ---------- (a) 玻璃卡片面（半透明白 .62 合成后） ----------
  { scene: '卡片标题文字', fg: TOKENS.title, surface: 'glassOnDark', kind: 'normal' },
  { scene: '卡片标题文字(亮端)', fg: TOKENS.title, surface: 'glassOnLight', kind: 'normal' },
  { scene: '卡片正文文字', fg: TOKENS.body, surface: 'glassOnDark', kind: 'normal' },
  { scene: '卡片辅助文字', fg: TOKENS.aux, surface: 'glassOnDark', kind: 'normal' },
  { scene: '卡片次要文字', fg: TOKENS.subtle, surface: 'glassOnDark', kind: 'normal' },
  { scene: '卡片次要文字(大字)', fg: TOKENS.subtle, surface: 'glassOnDark', kind: 'large' },
  { scene: '卡片主色文字/链接', fg: TOKENS.primaryText, surface: 'glassOnDark', kind: 'normal' },
  { scene: '卡片主色大号数值', fg: TOKENS.primary, surface: 'glassOnDark', kind: 'large' },
  { scene: '卡片成功状态文字', fg: TOKENS.successText, surface: 'glassOnDark', kind: 'normal' },
  { scene: '卡片警告状态文字', fg: TOKENS.warningText, surface: 'glassOnDark', kind: 'normal' },
  { scene: '卡片危险状态文字', fg: TOKENS.dangerText, surface: 'glassOnDark', kind: 'normal' },
  { scene: '强玻璃面正文', fg: TOKENS.body, surface: 'glassStrong', kind: 'normal' },
  { scene: '弹层对话框正文', fg: TOKENS.body, surface: 'dialog', kind: 'normal' },
  { scene: '输入框占位符', fg: TOKENS.subtle, surface: 'input', kind: 'normal' },
  { scene: '输入框已填文字', fg: TOKENS.body, surface: 'input', kind: 'normal' },
  { scene: '表头文字', fg: TOKENS.aux, surface: 'tableHead', kind: 'normal' },
  { scene: '侧边栏菜单文字', fg: TOKENS.body, surface: 'sidebar', kind: 'normal' },
  { scene: '侧边栏选中项主色', fg: TOKENS.primaryText, surface: 'sidebar', kind: 'normal' },

  // ---------- (b) 页面渐变底（无卡片直接铺文字） ----------
  { scene: '页面大标题', fg: TOKENS.title, surface: 'pageFallback', kind: 'normal' },
  { scene: '页面正文', fg: TOKENS.body, surface: 'pageFallback', kind: 'normal' },
  { scene: '页面辅助文字', fg: TOKENS.aux, surface: 'pageFallback', kind: 'normal' },
  { scene: '页面次要文字', fg: TOKENS.subtle, surface: 'pageFallback', kind: 'normal' },
  { scene: '页面占位符文字', fg: TOKENS.subtle, surface: 'pageLight', kind: 'normal' },
  { scene: '页面主色文字/链接', fg: TOKENS.primaryText, surface: 'pageFallback', kind: 'normal' },
  { scene: '页面主色 hover', fg: TOKENS.accentText, surface: 'pageFallback', kind: 'normal' },
  { scene: '页面成功状态文字', fg: TOKENS.successText, surface: 'pageFallback', kind: 'normal' },
  { scene: '页面警告状态文字', fg: TOKENS.warningText, surface: 'pageFallback', kind: 'normal' },
  { scene: '页面危险状态文字', fg: TOKENS.dangerText, surface: 'pageFallback', kind: 'normal' },

  // ---------- (c) 深色顶栏 rgba(26,43,68,.82) 合成后 ----------
  { scene: '顶栏白色文字', fg: TOKENS.white, surface: 'topNav', kind: 'normal' },
  { scene: '顶栏白色次要文字(.85)', fg: 'rgba(255,255,255,.85)', surface: 'topNav', kind: 'normal' },
  { scene: '顶栏白色弱化文字(.65)', fg: 'rgba(255,255,255,.65)', surface: 'topNav', kind: 'normal' },
  { scene: '顶栏主色徽标/链接', fg: TOKENS.onDarkPrimary, surface: 'topNav', kind: 'normal' },
  { scene: '顶栏成功状态点', fg: TOKENS.success, surface: 'topNav', kind: 'ui' },
  { scene: '顶栏危险状态点/红点', fg: TOKENS.onDarkDanger, surface: 'topNav', kind: 'ui' },
  { scene: '顶栏警告状态点', fg: TOKENS.warning, surface: 'topNav', kind: 'ui' },

  // ---------- UI 组件 / 图形边界（>=3:1） ----------
  { scene: '主按钮填充 vs 玻璃面', fg: TOKENS.primary, surface: 'glassOnDark', kind: 'ui' },
  { scene: '主按钮白字 vs 主色底', fg: TOKENS.white, surface: 'primaryFill', kind: 'normal' },
  { scene: '成功按钮白字 vs 成功底', fg: TOKENS.white, surface: 'successFill', kind: 'normal' },
  { scene: '警告按钮白字 vs 警告底', fg: TOKENS.white, surface: 'warningFill', kind: 'normal' },
  { scene: '危险按钮白字 vs 危险底', fg: TOKENS.white, surface: 'dangerFill', kind: 'normal' },
  { scene: '主按钮填充(加深)vs 玻璃面', fg: TOKENS.primaryText, surface: 'glassOnDark', kind: 'ui' },
  { scene: '卡片白描边 vs 页面底', fg: TOKENS.whiteBorder, surface: 'pageFallback', kind: 'ui',
    exempt: true, exemptReason: '玻璃卡片高光轮廓，纯装饰、不承载信息，功能性边界另用 $color-border-control' },
  { scene: '卡片白描边 vs 玻璃面', fg: TOKENS.whiteBorder, surface: 'glassOnDark', kind: 'ui',
    exempt: true, exemptReason: '同上，卡片层级由阴影与背景明度差表达' },
  { scene: '输入框边界 vs 玻璃面', fg: TOKENS.borderControl, surface: 'glassOnDark', kind: 'ui' },
  { scene: '输入框边界 vs 页面底', fg: TOKENS.borderControl, surface: 'pageFallback', kind: 'ui' },
  { scene: '危险图标 vs 玻璃面', fg: TOKENS.dangerText, surface: 'glassOnDark', kind: 'ui' },
  { scene: '成功图标 vs 玻璃面', fg: TOKENS.successText, surface: 'glassOnDark', kind: 'ui' },
  { scene: '警告图标 vs 玻璃面', fg: TOKENS.warningText, surface: 'glassOnDark', kind: 'ui' },
];

// 纯色填充背景（按钮底），单独补进 SURFACES
// 实心按钮底：已按无障碍要求加深（见 global.scss 的 .el-button--xxx 覆盖）
SURFACES.primaryFill = { name: '主按钮填充 #2b57c9', layers: [TOKENS.primaryText] };
SURFACES.successFill = { name: '成功按钮填充 #0a7652', layers: [TOKENS.successText] };
SURFACES.warningFill = { name: '警告按钮填充 #8a5200', layers: [TOKENS.warningText] };
SURFACES.dangerFill = { name: '危险按钮填充 #bf2626', layers: [TOKENS.dangerText] };
// 标签/图表仍使用原色填充（UI 件门槛 3:1）
SURFACES.tagSuccessFill = { name: '成功标签底 #10b981', layers: [TOKENS.success] };
SURFACES.tagWarningFill = { name: '警告标签底 #f59e0b', layers: [TOKENS.warning] };

// ============================================================
// 七、表格化输出工具（兼容中文全角字符宽度）
// ============================================================

/** 计算字符串在等宽终端中的显示宽度（CJK 全角算 2 列） */
function displayWidth(str) {
  let width = 0;
  for (const ch of String(str)) {
    const code = ch.codePointAt(0);
    const isWide =
      (code >= 0x1100 && code <= 0x115f) ||
      (code >= 0x2e80 && code <= 0xa4cf) ||
      (code >= 0xac00 && code <= 0xd7a3) ||
      (code >= 0xf900 && code <= 0xfaff) ||
      (code >= 0xfe30 && code <= 0xfe6f) ||
      (code >= 0xff00 && code <= 0xff60) ||
      (code >= 0xffe0 && code <= 0xffe6);
    width += isWide ? 2 : 1;
  }
  return width;
}

/** 按显示宽度右侧补空格 */
function padEndWide(str, width) {
  const s = String(str);
  const pad = Math.max(0, width - displayWidth(s));
  return s + ' '.repeat(pad);
}

/** 按显示宽度左侧补空格（用于数字右对齐） */
function padStartWide(str, width) {
  const s = String(str);
  const pad = Math.max(0, width - displayWidth(s));
  return ' '.repeat(pad) + s;
}

/** 打印表格：headers 为表头数组，rows 为二维数组，aligns 为 'l'/'r' */
function printTable(headers, rows, aligns) {
  const widths = headers.map((h, i) => {
    let max = displayWidth(h);
    for (const row of rows) max = Math.max(max, displayWidth(row[i]));
    return max;
  });
  const line = (cells) =>
    cells
      .map((c, i) => (aligns[i] === 'r' ? padStartWide(c, widths[i]) : padEndWide(c, widths[i])))
      .join('  ');
  const sep = widths.map((w) => '-'.repeat(w)).join('  ');
  console.log(line(headers));
  console.log(sep);
  for (const row of rows) console.log(line(row));
}

// ============================================================
// 八、执行检查
// ============================================================

function run() {
  console.log('');
  console.log('==============================================================');
  console.log(' WCAG 2.1 AA 对比度自检 — 湛蓝玻璃拟物主题');
  console.log(' 阈值：普通文本 >= 4.5:1 ｜ 大文本 >= 3.0:1 ｜ UI 组件 >= 3.0:1');
  console.log('==============================================================');
  console.log('');

  const results = [];

  for (const item of CHECKLIST) {
    const surface = SURFACES[item.surface];
    if (!surface) throw new Error('未定义的背景：' + item.surface);

    // 背景：压平图层栈得到实际渲染色
    const bgFlat = flatten(surface.layers);
    // 前景：若前景本身半透明，则先合成到已压平的背景上
    const fgParsed = parseColor(item.fg);
    const fgFlat = fgParsed.a < 1 ? compositeOver(fgParsed, bgFlat) : fgParsed;

    const ratio = contrastRatio(fgFlat, bgFlat);
    const threshold = THRESHOLDS[item.kind];
    const pass = ratio >= threshold;

    results.push({
      scene: item.scene,
      kind: item.kind,
      fgRaw: item.fg,
      fgFlat: toHex(fgFlat),
      bgName: surface.name,
      bgFlat: toHex(bgFlat),
      ratio,
      threshold,
      pass,
      // 纯装饰性图形（不承载信息、不是功能性边界）按 WCAG SC 1.4.11 豁免
      exempt: !!item.exempt,
      exemptReason: item.exemptReason || '',
    });
  }

  // ---- 输出主表格 ----
  const rows = results.map((r, i) => [
    String(i + 1),
    r.scene,
    KIND_LABEL[r.kind],
    r.fgRaw,
    r.fgFlat,
    r.bgName,
    r.bgFlat,
    r.ratio.toFixed(2) + ':1',
    r.threshold.toFixed(1),
    r.pass ? 'PASS' : (r.exempt ? 'EXEMPT' : 'FAIL'),
  ]);
  printTable(
    ['#', '检查场景', '类型', '前景色(原始)', '前景(合成)', '背景(原始层)', '背景(合成)', '对比度', '门槛', '判定'],
    rows,
    ['r', 'l', 'l', 'l', 'l', 'l', 'l', 'r', 'r', 'l']
  );

  // ---- 豁免清单（装饰性图形） ----
  const exempted = results.filter((r) => !r.pass && r.exempt);
  if (exempted.length) {
    console.log('');
    console.log('--------------------------------------------------------------');
    console.log(' 豁免项（' + exempted.length + ' 条，WCAG SC 1.4.11 纯装饰图形）');
    console.log('--------------------------------------------------------------');
    for (const r of exempted) {
      console.log('  [EXEMPT] ' + r.scene + '：' + r.ratio.toFixed(2) + ':1 — ' + r.exemptReason);
    }
  }

  // ---- 不达标清单 ----
  const failed = results.filter((r) => !r.pass && !r.exempt);
  if (failed.length) {
    console.log('');
    console.log('--------------------------------------------------------------');
    console.log(' 不达标项（' + failed.length + ' 条）');
    console.log('--------------------------------------------------------------');
    for (const r of failed) {
      const gap = (r.threshold - r.ratio).toFixed(2);
      console.log(
        '  [FAIL] ' +
          r.scene +
          '：' +
          r.fgFlat +
          ' on ' +
          r.bgFlat +
          ' = ' +
          r.ratio.toFixed(2) +
          ':1（需 ' +
          r.threshold.toFixed(1) +
          ':1，差 ' +
          gap +
          '）'
      );
    }
  }

  // ---- 汇总 ----
  const passed = results.filter((r) => r.pass).length;
  console.log('');
  console.log('SUMMARY: ' + passed + '/' + (results.length - exempted.length) + ' passed'
    + (exempted.length ? '（另有 ' + exempted.length + ' 条装饰性豁免）' : ''));
  console.log('');

  return failed.length === 0 ? 0 : 1;
}

// ============================================================
// 九、辅助：给定背景求「满足门槛的最深同色相修正色」（供报告生成建议值参考）
// 使用方式：node scripts/check-contrast.cjs --suggest "#10b981" "#F2F6FB" 4.5
// ============================================================

/** 将颜色按比例向黑色压暗，二分搜索出刚好满足目标对比度的色值 */
function darkenToMeet(fgHex, bgHex, target) {
  const fg = parseColor(fgHex);
  const bg = parseColor(bgHex);
  if (contrastRatio(fg, bg) >= target) return { hex: toHex(fg), ratio: contrastRatio(fg, bg), k: 1 };
  let lo = 0; // 全黑
  let hi = 1; // 原色
  let best = { r: 0, g: 0, b: 0, a: 1 };
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    const candidate = { r: fg.r * mid, g: fg.g * mid, b: fg.b * mid, a: 1 };
    if (contrastRatio(candidate, bg) >= target) {
      best = candidate;
      lo = mid; // 尽量保留原色饱和度（取满足条件里最亮的）
    } else {
      hi = mid;
    }
  }
  const snapped = parseColor(toHex(best));
  return { hex: toHex(best), ratio: contrastRatio(snapped, bg), k: lo };
}

// 命令行参数：--suggest <前景> <背景> [目标比]
if (process.argv.includes('--suggest')) {
  const idx = process.argv.indexOf('--suggest');
  const fgArg = process.argv[idx + 1];
  const bgArg = process.argv[idx + 2];
  const targetArg = Number(process.argv[idx + 3] || 4.5);
  const out = darkenToMeet(fgArg, bgArg, targetArg);
  console.log(
    '建议色值：' + out.hex + '  对比度：' + out.ratio.toFixed(2) + ':1（目标 ' + targetArg.toFixed(1) + ':1）'
  );
  process.exit(0);
}

// 直接运行时执行检查并按结果设置退出码
if (require.main === module) {
  process.exit(run());
}

module.exports = {
  parseColor,
  toHex,
  compositeOver,
  flatten,
  linearize,
  relativeLuminance,
  contrastRatio,
  darkenToMeet,
  THRESHOLDS,
};
