
/**
 * 主题迁移 v2 —— 把 frontend/src 下的颜色字面量替换为令牌 v2。
 * 用法: node scripts/theme-migrate-v2.cjs [--dry] [--dump]
 *
 * 按上下文产出正确形式：
 *   <style> / .scss   ->  $token
 *   <template>        ->  var(--token)
 *   <script> / .ts    ->  整串颜色 -> tokens.x
 *                         反引号模板内嵌 -> 插值形式（用于内嵌 HTML）
 *                         单/双引号串内混排 -> ' + tokens.x + '
 *
 * 豁免：styles/variables.scss、styles/global.scss、styles/tokens.ts、components/print/**
 */
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const DRY = process.argv.includes('--dry');
const BT = String.fromCharCode(96);   // 反引号
const D = String.fromCharCode(36);    // 美元符

function oklchToRgb(L, C, H) {
  const h = (H * Math.PI) / 180, a = C * Math.cos(h), b = C * Math.sin(h);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
  const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const bl = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;
  const gam = (c) => { c = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055; return Math.max(0, Math.min(1, c)); };
  return [gam(r) * 255, gam(g) * 255, gam(bl) * 255];
}
function parseColor(input) {
  const str = String(input).trim().toLowerCase();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(str);
  if (hex) { let h = hex[1]; if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: 1 }; }
  const rgb = /^rgba?\(([^)]+)\)$/.exec(str);
  if (rgb) { const p = rgb[1].split(/[,/\s]+/).filter(Boolean);
    const a = p.length >= 4 ? (p[3].endsWith('%') ? Number(p[3].slice(0, -1)) / 100 : Number(p[3])) : 1;
    return { r: Number(p[0]), g: Number(p[1]), b: Number(p[2]), a }; }
  const ok = /^oklch\(([^)]+)\)$/.exec(str);
  if (ok) { const seg = ok[1].split('/'); const nums = seg[0].trim().split(/\s+/);
    const [r, g, b] = oklchToRgb(parseFloat(nums[0]) / 100, parseFloat(nums[1]), parseFloat(nums[2]));
    return { r, g, b, a: seg[1] !== undefined ? parseFloat(seg[1]) : 1 }; }
  throw new Error('无法解析：' + input);
}
const toHex = (c) => '#' + [c.r, c.g, c.b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const compositeOver = (fg, bg) => fg.a >= 1 ? { r: fg.r, g: fg.g, b: fg.b, a: 1 } : { r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1 };

const scss = fs.readFileSync(path.join(root, 'frontend/src/styles/variables.scss'), 'utf-8');
const TOKENS = {};
{ const re = /\$([a-z0-9-]+)\s*:\s*(oklch\([^;]+\))/g; let m;
  while ((m = re.exec(scss)) !== null) { const c = parseColor(m[2]); TOKENS[m[1]] = { hex: toHex(c), rgb: [Math.round(c.r), Math.round(c.g), Math.round(c.b)] }; } }
const camel = (name) => name.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
const CANDIDATES = Object.keys(TOKENS).filter((k) => k.indexOf('st-') !== 0 && k !== 'glass' && k !== 'scrim');
function srgbToOklab(r, g, b) {
  const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const R = lin(r), G = lin(g), B = lin(b);
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return [0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
          1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
          0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s];
}
const TOKEN_LAB = {}; for (const k of CANDIDATES) TOKEN_LAB[k] = srgbToOklab(TOKENS[k].rgb[0], TOKENS[k].rgb[1], TOKENS[k].rgb[2]);
function nearest(rgb) {
  const lab = srgbToOklab(rgb[0], rgb[1], rgb[2]); let best = CANDIDATES[0], bd = Infinity;
  for (const k of CANDIDATES) { const t = TOKEN_LAB[k]; const d = (lab[0]-t[0])*(lab[0]-t[0]) + (lab[1]-t[1])*(lab[1]-t[1]) + (lab[2]-t[2])*(lab[2]-t[2]);
    if (d < bd) { bd = d; best = k; } }
  return best;
}
const CURATED = {
  '#fff': 'n-0', '#ffffff': 'n-0',
  '#f5f7fa': 'n-50', '#f7f8fa': 'n-50', '#f5f5f5': 'n-50', '#f0f4f8': 'n-50', '#f2f6fc': 'n-50',
  '#f0f0f0': 'n-100', '#eee': 'n-100', '#e8e8e8': 'n-100', '#e7ecf5': 'n-100',
  '#ebeef5': 'n-200', '#e0e0e0': 'n-200', '#ddd': 'n-200', '#dcdfe6': 'n-200', '#d3d6db': 'n-200', '#e9e9eb': 'n-200',
  '#c0c4cc': 'n-300', '#c8c9cc': 'n-300', '#ccc': 'n-300',
  '#b0b0b0': 'n-400', '#b0bec5': 'n-400', '#b2bec3': 'n-400', '#aabbcc': 'n-400', '#95a5a6': 'n-400', '#8b93a3': 'n-400',
  '#999': 'n-600', '#8c8c8c': 'n-600', '#909399': 'n-600', '#8899aa': 'n-600', '#7f8c8d': 'n-600',
  '#687385': 'n-600', '#636e72': 'n-600', '#5f6675': 'n-600', '#5b6472': 'n-600', '#556677': 'n-600',
  '#666': 'n-700', '#606266': 'n-700', '#595959': 'n-700', '#3a4354': 'n-700',
  '#333': 'n-900', '#303133': 'n-900', '#1f2430': 'n-900', '#1a1f36': 'n-900', '#34495e': 'n-900',
  '#1a3a6b': 'n-900', '#0a1628': 'n-900', '#0d2137': 'n-900', '#0f2b47': 'n-900',
  '#4f7cf7': 'brand-600', '#409eff': 'brand-600', '#1890ff': 'brand-600', '#1677ff': 'brand-600',
  '#3b82f6': 'brand-600', '#5b7fff': 'brand-600', '#0984e3': 'brand-600', '#3498db': 'brand-600',
  '#4472c4': 'brand-600', '#3b72d8': 'brand-600', '#5b8bf8': 'brand-600', '#2b57c9': 'brand-600',
  '#3b66e0': 'brand-700', '#2b4fbf': 'brand-700', '#2456b8': 'brand-700', '#096dd9': 'brand-700', '#1e50bd': 'brand-700',
  '#7ba0f9': 'brand-300', '#60a5fa': 'brand-300', '#a0c4ff': 'brand-300', '#38bdf8': 'brand-300',
  '#c6d6fd': 'brand-100', '#b3d8ff': 'brand-100', '#ecf5ff': 'brand-100', '#f0f5ff': 'brand-100',
  '#e6f0ff': 'brand-100', '#ecf1fe': 'brand-100', '#d9e3fd': 'brand-100',
  '#67c23a': 'ok-600', '#10b981': 'ok-600', '#1abc9c': 'ok-600', '#52c41a': 'ok-600', '#a0d911': 'ok-600',
  '#059669': 'ok-600', '#0a7652': 'ok-600', '#0c8a60': 'ok-600',
  '#f0f9eb': 'ok-100', '#e8f8f0': 'ok-100', '#e6faf4': 'ok-100', '#c2e7b0': 'ok-100', '#b7e4d0': 'ok-100',
  '#e6a23c': 'warn-600', '#f59e0b': 'warn-600', '#f97316': 'warn-600', '#faad14': 'warn-600',
  '#fa8c16': 'warn-600', '#f39c12': 'warn-600', '#e67e22': 'warn-600', '#d35400': 'warn-600',
  '#8a5200': 'warn-600', '#a06200': 'warn-600',
  '#fdf6ec': 'warn-100', '#fef3e6': 'warn-100', '#f5dab1': 'warn-100', '#fae2b4': 'warn-100',
  '#f56c6c': 'bad-600', '#ef4444': 'bad-600', '#e74c3c': 'bad-600', '#ff4d4f': 'bad-600',
  '#bf2626': 'bad-600', '#eb2f96': 'bad-600', '#d63030': 'bad-600',
  '#fef0f0': 'bad-100', '#fde8e8': 'bad-100', '#fbc4c4': 'bad-100',
  '#722ed1': 'info-600', '#13c2c2': 'info-600', '#b8a9ff': 'info-100', '#f4f0fe': 'info-100', '#d9cff5': 'info-100',
  '#e3ecfb': 'n-50', '#dbe6f8': 'n-50', '#e0edf7': 'n-50', '#dde7f5': 'n-50',
  '#ffd04b': 'st-booked', '#fadb14': 'st-booked',
};
const CURATED_ALPHA = {
  'rgba(26,43,68,.82)': 'n-900', 'rgba(31,41,55,.14)': 'sh-1', 'rgba(255,255,255,.4)': 'sh-inset',
  'rgba(64,158,255,.3)': 'brand-300', 'rgba(79,124,247,.4)': 'brand-300',
};
function mapColor(literal) {
  const s = literal.toLowerCase().replace(/\s+/g, '');
  const norm = s.replace(/0\.(\d+)/g, '.$1');
  if (CURATED_ALPHA[s]) return CURATED_ALPHA[s];
  if (CURATED[s]) return CURATED[s];
  if (CURATED_ALPHA[norm]) return CURATED_ALPHA[norm];
  if (CURATED[norm]) return CURATED[norm];
  const c = parseColor(s);
  if (c.a < 1) {
    const isWhite = c.r > 240 && c.g > 240 && c.b > 240;
    const isBlack = c.r < 30 && c.g < 30 && c.b < 30;
    if (isWhite) return 'glass';
    if (isBlack) return c.a >= 0.2 ? 'scrim' : 'n-100';
    const f = compositeOver(c, { r: 255, g: 255, b: 255, a: 1 });
    return nearest([f.r, f.g, f.b]);
  }
  return nearest([c.r, c.g, c.b]);
}
const refOf = (tok, ctx) => ctx === 'style' ? D + tok : ctx === 'template' ? 'var(--' + tok + ')' : 'tokens.' + camel(tok);

const COLOR_ONE = /^(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\)|oklch\([^)]*\))$/;
const COLOR_RE = /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|oklch\([^)]*\)/g;
const stats = { style: 0, template: 0, script: 0, files: 0 };
const mappingSeen = new Map();
const note = (lit, ref) => mappingSeen.set(lit.toLowerCase().replace(/\s+/g, ''), ref);

function replFlat(body, ctx) {
  return body.replace(COLOR_RE, (lit) => { const ref = refOf(mapColor(lit), ctx); stats[ctx] += 1; note(lit, ref); return ref; });
}
function replScript(body) {
  let out = '', i = 0, mode = null;
  const colorAt = (pos) => { const m = /^(#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|oklch\([^)]*\))/.exec(body.slice(pos)); return m ? m[1] : null; };
  while (i < body.length) {
    const ch = body[i];
    if (ch === String.fromCharCode(92)) { out += body.slice(i, i + 2); i += 2; continue; }
    if (mode === BT) {
      if (ch === BT) { mode = null; out += ch; i++; continue; }
      const lit = colorAt(i);
      if (lit) { const ref = D + '{' + refOf(mapColor(lit), 'script') + '}'; stats.script++; note(lit, ref); out += ref; i += lit.length; continue; }
      out += ch; i++; continue;
    }
    if (mode === "'" || mode === '"') {
      if (ch === mode) { mode = null; out += ch; i++; continue; }
      const lit = colorAt(i);
      if (lit) { const ref = "' + " + refOf(mapColor(lit), 'script') + " + '"; stats.script++; note(lit, ref); out += ref; i += lit.length; continue; }
      out += ch; i++; continue;
    }
    if (ch === BT || ch === "'" || ch === '"') {
      const q = ch;
      const re = q === BT ? new RegExp('^' + BT + '([^' + BT + ']*)' + BT) : new RegExp('^' + q + '([^' + q + ']*)' + q);
      const m = re.exec(body.slice(i));
      if (m && COLOR_ONE.test(m[1])) { const ref = refOf(mapColor(m[1]), 'script'); stats.script++; note(m[1], ref); out += ref; i += m[0].length; continue; }
      mode = q; out += ch; i++; continue;
    }
    out += ch; i++;
  }
  return out;
}
function blocks(txt) {
  const res = [];
  const scriptStart = txt.indexOf('<script');
  if (txt.trimStart().indexOf('<template') === 0) {
    const bs = txt.indexOf('>', txt.indexOf('<template')) + 1;
    const be = scriptStart > 0 ? txt.lastIndexOf('</template>', scriptStart) : txt.lastIndexOf('</template>');
    if (be > bs) res.push({ tag: 'template', bs, body: txt.slice(bs, be) });
  }
  if (scriptStart >= 0) {
    const bs = txt.indexOf('>', scriptStart) + 1;
    const be = txt.lastIndexOf('</script>');
    if (be > bs) res.push({ tag: 'script', bs, body: txt.slice(bs, be) });
  }
  const yStart = txt.lastIndexOf('<style');
  if (yStart >= 0) {
    const bs = txt.indexOf('>', yStart) + 1;
    const be = txt.lastIndexOf('</style>');
    if (be > bs) res.push({ tag: 'style', bs, body: txt.slice(bs, be) });
  }
  return res;
}
const EXEMPT = [/components[\/\\]print[\/\\]/, /styles[\/\\]variables\.scss$/, /styles[\/\\]global\.scss$/, /styles[\/\\]tokens\.ts$/];
const IMPORT_LINE = "import { tokens } from '@/styles/tokens';";
function processFile(file) {
  const rel = path.relative(root, file).replace(/\\/g, '/');
  if (EXEMPT.some((r) => r.test(rel))) return;
  let txt = fs.readFileSync(file, 'utf-8');
  const orig = txt;
  if (file.endsWith('.vue')) {
    const bs = blocks(txt).sort((a, b) => b.bs - a.bs);
    let needImport = false;
    for (const b of bs) {
      const out = b.tag === 'script' ? replScript(b.body) : replFlat(b.body, b.tag);
      if (out !== b.body) {
        txt = txt.slice(0, b.bs) + out + txt.slice(b.bs + b.body.length);
        if (b.tag === 'script' && /tokens\.[a-zA-Z]/.test(out)) needImport = true;
      }
    }
    if (needImport && txt.indexOf("from '@/styles/tokens'") < 0) {
      const m = /<script[^>]*>\n?/.exec(txt);
      if (m) { const at = m.index + m[0].length; txt = txt.slice(0, at) + IMPORT_LINE + String.fromCharCode(10) + txt.slice(at); }
    }
  } else if (file.endsWith('.ts')) {
    txt = replScript(txt);
    if (/tokens\.[a-zA-Z]/.test(txt) && txt.indexOf("from '@/styles/tokens'") < 0) txt = IMPORT_LINE + String.fromCharCode(10) + txt;
  } else if (file.endsWith('.scss')) {
    txt = replFlat(txt, 'style');
  }
  if (txt !== orig) { stats.files += 1; if (!DRY) fs.writeFileSync(file, txt); }
}
function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name === 'node_modules' || e.name === 'dist') continue; walk(f); continue; }
    if (!/\.(vue|ts|scss)$/.test(e.name)) continue;
    processFile(f);
  }
}
walk(path.join(root, 'frontend/src'));
console.log((DRY ? '[DRY] ' : '[APPLY] ') + '替换：style ' + stats.style + ' / template ' + stats.template + ' / script+ts ' + stats.script + ' | 改动文件 ' + stats.files);
if (process.argv.includes('--dump')) { console.log(''); console.log('=== 映射表 ==='); for (const kv of [...mappingSeen.entries()].sort()) console.log('  ' + kv[0].padEnd(26) + ' -> ' + kv[1]); }
