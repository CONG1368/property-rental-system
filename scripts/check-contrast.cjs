#!/usr/bin/env node
/**
 * WCAG 2.1 对比度自检 — 冷调中性（现代极简）· 令牌 v2
 * ============================================================
 * 令牌来源：frontend/src/styles/variables.scss（脚本解析 oklch 并转 sRGB，与令牌保持同步）。
 * 背景模型：v2 已取消「玻璃卡片」，页面底为 $n-50、卡片/弹层/输入为 $n-0；
 *           仅顶栏/侧栏/抽屉/弹层允许玻璃（$glass 合成到页面底）。
 *
 * 算法：sRGB 线性化 → 相对亮度 L = .2126R+.7152G+.0722B → 对比度 (L1+.05)/(L2+.05)
 * 阈值：正文 >=4.5:1 ｜ 大字 >=3.0:1 ｜ UI 件 >=3.0:1（WCAG 2.1 AA / SC 1.4.11）
 *
 * 运行：node scripts/check-contrast.cjs     退出码：全通过 0 / 有 FAIL 1
 */
'use strict';
const fs = require('fs');
const path = require('path');

// ============================================================
// 一、颜色解析（#hex / rgb / rgba / oklch）
// ============================================================
function oklchToRgb(L, C, H) {
  const h = (H * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;
  const l = l_ * l_ * l_, m = m_ * m_ * m_, s = s_ * s_ * s_;
  const r = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const bl = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;
  const gam = (c) => { c = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055; return Math.max(0, Math.min(1, c)); };
  return [gam(r) * 255, gam(g) * 255, gam(bl) * 255];
}

function parseColor(input) {
  const str = String(input).trim().toLowerCase();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(str);
  if (hex) {
    let h = hex[1];
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: 1 };
  }
  const rgb = /^rgba?\(([^)]+)\)$/.exec(str);
  if (rgb) {
    const parts = rgb[1].split(/[,/\s]+/).filter(Boolean);
    const a = parts.length >= 4 ? (parts[3].endsWith('%') ? Number(parts[3].slice(0, -1)) / 100 : Number(parts[3])) : 1;
    return { r: Number(parts[0]), g: Number(parts[1]), b: Number(parts[2]), a };
  }
  const ok = /^oklch\(([^)]+)\)$/.exec(str);
  if (ok) {
    const seg = ok[1].split('/');
    const nums = seg[0].trim().split(/\s+/);
    const L = parseFloat(nums[0]) / 100;
    const C = parseFloat(nums[1]);
    const H = parseFloat(nums[2]);
    const a = seg[1] !== undefined ? parseFloat(seg[1]) : 1;
    const [r, g, b] = oklchToRgb(L, C, H);
    return { r, g, b, a };
  }
  throw new Error('无法解析的颜色值：' + input);
}

const toHex = (c) => '#' + [c.r, c.g, c.b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('').toUpperCase();
const compositeOver = (fg, bg) => fg.a >= 1 ? { r: fg.r, g: fg.g, b: fg.b, a: 1 } : { r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1 };
function flatten(layers) {
  let base = parseColor(layers[0]);
  if (base.a < 1) throw new Error('最底层图层必须不透明：' + layers[0]);
  for (let i = 1; i < layers.length; i++) base = compositeOver(parseColor(layers[i]), base);
  return base;
}
const linearize = (v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const relativeLuminance = (c) => 0.2126 * linearize(c.r) + 0.7152 * linearize(c.g) + 0.0722 * linearize(c.b);
function contrastRatio(a, b) {
  const l1 = relativeLuminance(a), l2 = relativeLuminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

// ============================================================
// 二、从 variables.scss 读取令牌（保持同步）
// ============================================================
function loadTokens() {
  const p = path.resolve(__dirname, '../frontend/src/styles/variables.scss');
  const scss = fs.readFileSync(p, 'utf-8');
  const map = {};
  const re = /\$([a-z0-9-]+)\s*:\s*(oklch\([^;]+\))/g;
  let m;
  while ((m = re.exec(scss)) !== null) map[m[1]] = m[2].trim();
  return map;
}
const RAW = loadTokens();
const T = {};
for (const k of Object.keys(RAW)) T[k] = toHex(parseColor(RAW[k]));
function need(name) {
  if (!T[name]) throw new Error('variables.scss 缺少令牌 $' + name);
  return T[name];
}

// ============================================================
// 三、阈值与背景模型
// ============================================================
const THRESHOLDS = { normal: 4.5, large: 3.0, ui: 3.0 };
const KIND_LABEL = { normal: '正文', large: '大字', ui: 'UI件' };

const PAGE = need('n-50');   // 页面底
const CARD = need('n-0');    // 卡片 / 弹层 / 输入（净表面）
const SHELL = need('n-900'); // 顶栏（深色外壳）
const GLASS = RAW['glass'];  // 侧栏/弹层玻璃面

const SURFACES = {
  page: { name: '页面底 ' + PAGE, layers: [PAGE] },
  card: { name: '卡片净表面 ' + CARD, layers: [CARD] },
  dialog: { name: '弹层 ' + CARD, layers: [CARD] },
  input: { name: '输入框 ' + CARD, layers: [CARD] },
  tableHead: { name: '表头 ' + PAGE, layers: [PAGE] },
  shell: { name: '深色顶栏 ' + SHELL, layers: [SHELL] },
  sidebar: { name: '侧栏玻璃@页面底', layers: [PAGE, GLASS] },
  brandFill: { name: '主按钮底 ' + T['brand-600'], layers: [T['brand-600']] },
  brandFillHover: { name: '主按钮 hover ' + T['brand-700'], layers: [T['brand-700']] },
  okFill: { name: '成功实心 ' + T['ok-600'], layers: [T['ok-600']] },
  warnFill: { name: '警告实心 ' + T['warn-600'], layers: [T['warn-600']] },
  badFill: { name: '危险实心 ' + T['bad-600'], layers: [T['bad-600']] },
};

// ============================================================
// 四、检查清单（v2）
// ============================================================
const WHITE = '#ffffff';
const CHECKLIST = [
  // 页面 / 卡片上的文字
  { scene: '页面主文字', fg: need('n-900'), surface: 'page', kind: 'normal' },
  { scene: '页面次要文字', fg: need('n-600'), surface: 'page', kind: 'normal' },
  { scene: '页面正文(700)', fg: need('n-700'), surface: 'page', kind: 'normal' },
  { scene: '卡片主文字', fg: need('n-900'), surface: 'card', kind: 'normal' },
  { scene: '卡片次要文字', fg: need('n-600'), surface: 'card', kind: 'normal' },
  { scene: '卡片正文(700)', fg: need('n-700'), surface: 'card', kind: 'normal' },
  { scene: '输入框已填文字', fg: need('n-900'), surface: 'input', kind: 'normal' },
  { scene: '输入框占位符', fg: need('n-600'), surface: 'input', kind: 'normal' },
  { scene: '表头文字', fg: need('n-700'), surface: 'tableHead', kind: 'normal' },
  // 链接 / 主色文字
  { scene: '链接/主色文字@页面', fg: need('brand-600'), surface: 'page', kind: 'normal' },
  { scene: '链接/主色文字@卡片', fg: need('brand-600'), surface: 'card', kind: 'normal' },
  { scene: '主色 hover@页面', fg: need('brand-700'), surface: 'page', kind: 'normal' },
  // 语义状态文字
  { scene: '成功状态文字@页面', fg: need('ok-600'), surface: 'page', kind: 'normal' },
  { scene: '警告状态文字@页面', fg: need('warn-600'), surface: 'page', kind: 'normal' },
  { scene: '危险状态文字@页面', fg: need('bad-600'), surface: 'page', kind: 'normal' },
  { scene: '信息状态文字@页面', fg: need('info-600'), surface: 'page', kind: 'normal' },
  { scene: '成功状态文字@卡片', fg: need('ok-600'), surface: 'card', kind: 'normal' },
  { scene: '警告状态文字@卡片', fg: need('warn-600'), surface: 'card', kind: 'normal' },
  { scene: '危险状态文字@卡片', fg: need('bad-600'), surface: 'card', kind: 'normal' },
  // 实心按钮：白字
  { scene: '白字 vs 主按钮底', fg: WHITE, surface: 'brandFill', kind: 'normal' },
  { scene: '白字 vs 主按钮 hover', fg: WHITE, surface: 'brandFillHover', kind: 'normal' },
  { scene: '白字 vs 成功实心', fg: WHITE, surface: 'okFill', kind: 'normal' },
  { scene: '白字 vs 警告实心', fg: WHITE, surface: 'warnFill', kind: 'normal' },
  { scene: '白字 vs 危险实心', fg: WHITE, surface: 'badFill', kind: 'normal' },
  // 浅档填充上的墨字（成对规则：浅档配 n-900）
  { scene: 'n-900 on brand-100', fg: need('n-900'), surface: 'brandFill100', kind: 'normal' },
  { scene: 'n-900 on ok-100', fg: need('n-900'), surface: 'okFill100', kind: 'normal' },
  { scene: 'n-900 on warn-100', fg: need('n-900'), surface: 'warnFill100', kind: 'normal' },
  { scene: 'n-900 on bad-100', fg: need('n-900'), surface: 'badFill100', kind: 'normal' },
  { scene: 'n-900 on info-100', fg: need('n-900'), surface: 'infoFill100', kind: 'normal' },
  // 房态阶：浅三档配墨字，rented 配白字
  { scene: 'n-900 on 房态-空置', fg: need('n-900'), surface: 'stVacant', kind: 'normal' },
  { scene: 'n-900 on 房态-已锁定', fg: need('n-900'), surface: 'stLocked', kind: 'normal' },
  { scene: 'n-900 on 房态-已预订', fg: need('n-900'), surface: 'stBooked', kind: 'normal' },
  { scene: '白字 on 房态-已出租', fg: WHITE, surface: 'stRented', kind: 'normal' },
  // 深色顶栏
  { scene: '顶栏白字', fg: WHITE, surface: 'shell', kind: 'normal' },
  { scene: '顶栏弱化白字(.72)', fg: 'rgba(255,255,255,.72)', surface: 'shell', kind: 'normal' },
  { scene: '顶栏主色徽标', fg: need('brand-300'), surface: 'shell', kind: 'normal' },
  // 侧栏（玻璃合成后）
  { scene: '侧栏文字', fg: need('n-700'), surface: 'sidebar', kind: 'normal' },
  { scene: '侧栏主色文字', fg: need('brand-600'), surface: 'sidebar', kind: 'normal' },
  // UI 件 / 边界（>=3:1）
  { scene: '控件边界 vs 页面底', fg: need('n-400'), surface: 'page', kind: 'ui' },
  { scene: '控件边界 vs 卡片', fg: need('n-400'), surface: 'card', kind: 'ui' },
  { scene: '主按钮填充 vs 卡片', fg: need('brand-600'), surface: 'card', kind: 'ui' },
  { scene: '分割线 n-200 vs 卡片（装饰）', fg: need('n-200'), surface: 'card', kind: 'ui',
    exempt: true, exemptReason: '分割线为装饰性分隔，不承载信息；功能性边界由 $n-400 承担' },
  { scene: '卡片描边 n-200 vs 页面底（装饰）', fg: need('n-200'), surface: 'page', kind: 'ui',
    exempt: true, exemptReason: '净表面卡片轮廓为装饰，层级由背景明度差表达' },
];
const LIGHT_FILLS = { 'brand-100': 'brandFill100', 'ok-100': 'okFill100', 'warn-100': 'warnFill100', 'bad-100': 'badFill100', 'info-100': 'infoFill100' };
for (const [tok, key] of Object.entries(LIGHT_FILLS)) {
  SURFACES[key] = { name: '浅档 ' + T[tok], layers: [T[tok]] };
}
const STATUS_FILLS = { 'st-vacant': 'stVacant', 'st-locked': 'stLocked', 'st-booked': 'stBooked', 'st-rented': 'stRented' };
for (const [tok, key] of Object.entries(STATUS_FILLS)) {
  SURFACES[key] = { name: '房态 ' + T[tok], layers: [T[tok]] };
}

// ============================================================
// 五、执行
// ============================================================
function displayWidth(s) { let w = 0; for (const ch of String(s)) { const c = ch.codePointAt(0); const wide = (c >= 0x1100 && c <= 0x115f) || (c >= 0x2e80 && c <= 0xa4cf) || (c >= 0xac00 && c <= 0xd7a3) || (c >= 0xf900 && c <= 0xfaff) || (c >= 0xfe30 && c <= 0xfe6f) || (c >= 0xff00 && c <= 0xff60) || (c >= 0xffe0 && c <= 0xffe6); w += wide ? 2 : 1; } return w; }
const padEndW = (s, w) => s + ' '.repeat(Math.max(0, w - displayWidth(s)));
const padStartW = (s, w) => ' '.repeat(Math.max(0, w - displayWidth(s))) + s;
function printTable(headers, rows, aligns) {
  const widths = headers.map((h, i) => Math.max(displayWidth(h), ...rows.map((r) => displayWidth(r[i]))));
  const line = (cells) => cells.map((c, i) => (aligns[i] === 'r' ? padStartW(c, widths[i]) : padEndW(c, widths[i]))).join('  ');
  console.log(line(headers));
  console.log(widths.map((w) => '-'.repeat(w)).join('  '));
  for (const r of rows) console.log(line(r));
}
function run() {
  console.log('');
  console.log('==============================================================');
  console.log(' WCAG 2.1 AA 对比度自检 — 冷调中性（令牌 v2）');
  console.log(' 阈值：正文 >=4.5:1 ｜ 大字 >=3.0:1 ｜ UI 件 >=3.0:1');
  console.log(' 令牌源：frontend/src/styles/variables.scss（自动同步）');
  console.log('==============================================================');
  console.log('');
  const results = CHECKLIST.map((item) => {
    const surface = SURFACES[item.surface];
    if (!surface) throw new Error('未定义的背景：' + item.surface);
    const bgFlat = flatten(surface.layers);
    const fgParsed = parseColor(item.fg);
    const fgFlat = fgParsed.a < 1 ? compositeOver(fgParsed, bgFlat) : fgParsed;
    const ratio = contrastRatio(fgFlat, bgFlat);
    const threshold = THRESHOLDS[item.kind];
    return { scene: item.scene, kind: item.kind, fgRaw: item.fg, fgFlat: toHex(fgFlat), bgName: surface.name, bgFlat: toHex(bgFlat), ratio, threshold, pass: ratio >= threshold, exempt: !!item.exempt, exemptReason: item.exemptReason || '' };
  });
  printTable(['#', '检查场景', '类型', '前景(合成)', '背景(合成)', '对比度', '门槛', '判定'],
    results.map((r, i) => [String(i + 1), r.scene, KIND_LABEL[r.kind], r.fgFlat, r.bgFlat, r.ratio.toFixed(2) + ':1', r.threshold.toFixed(1), r.pass ? 'PASS' : (r.exempt ? 'EXEMPT' : 'FAIL')]),
    ['r', 'l', 'l', 'l', 'l', 'r', 'r', 'l']);
  const exempted = results.filter((r) => !r.pass && r.exempt);
  const failed = results.filter((r) => !r.pass && !r.exempt);
  if (exempted.length) {
    console.log('');
    console.log('豁免项（' + exempted.length + ' 条，WCAG SC 1.4.11 装饰性图形）：');
    for (const r of exempted) console.log('  [EXEMPT] ' + r.scene + '：' + r.ratio.toFixed(2) + ':1 — ' + r.exemptReason);
  }
  if (failed.length) {
    console.log('');
    console.log('不达标项（' + failed.length + ' 条）：');
    for (const r of failed) console.log('  [FAIL] ' + r.scene + '：' + r.fgFlat + ' on ' + r.bgFlat + ' = ' + r.ratio.toFixed(2) + ':1（需 ' + r.threshold.toFixed(1) + ':1）');
  }
  const passed = results.filter((r) => r.pass).length;
  console.log('');
  console.log('SUMMARY: ' + passed + '/' + (results.length - exempted.length) + ' passed' + (exempted.length ? '（另有 ' + exempted.length + ' 条装饰性豁免）' : ''));
  console.log('');
  return failed.length === 0 ? 0 : 1;
}

if (require.main === module) process.exit(run());
module.exports = { parseColor, toHex, compositeOver, flatten, relativeLuminance, contrastRatio, THRESHOLDS };