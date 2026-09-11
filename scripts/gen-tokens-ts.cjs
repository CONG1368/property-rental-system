/**
 * 由 scripts/gen-tokens-ts.cjs 自动生成，勿手改。
 * 数据源：frontend/src/styles/variables.scss（SCSS 令牌）→ oklch 转 sRGB hex。
 * 用途：ECharts 系列色、内联 JS 里需要「真实色值」的场景（CSS 端请用 $令牌 或 var(--令牌)）。
 */
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');

// ---- oklch -> sRGB hex ----
function oklchToHex(L, C, H, alpha) {
  const h = (H * Math.PI) / 180;
  const a = C * Math.cos(h), b = C * Math.sin(h);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;
  const l = l_ * l_ * l_, m = m_ * m_ * m_, s = s_ * s_ * s_;
  let r = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  let g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  let bl = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;
  const gam = (c) => { c = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055; return Math.max(0, Math.min(1, c)); };
  const to255 = (c) => Math.round(gam(c) * 255);
  const hex = '#' + [to255(r), to255(g), to255(bl)].map((n) => n.toString(16).padStart(2, '0')).join('');
  if (alpha !== undefined && alpha < 1) {
    return hex + Math.round(alpha * 255).toString(16).padStart(2, '0');
  }
  return hex;
}

const scss = fs.readFileSync(path.join(root, 'frontend/src/styles/variables.scss'), 'utf-8');
const map = {};
const re = /\$([a-z0-9-]+)\s*:\s*oklch\(([^)]*)\)/g;
let m;
while ((m = re.exec(scss)) !== null) {
  const name = m[1];
  const parts = m[2].trim().split('/');
  const nums = parts[0].trim().split(/\s+/);
  const L = parseFloat(nums[0]) / 100;
  const C = parseFloat(nums[1]);
  const H = parseFloat(nums[2]);
  const alpha = parts[1] !== undefined ? parseFloat(parts[1]) : undefined;
  const camel = name.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
  map[camel] = oklchToHex(L, C, H, alpha);
}

const lines = Object.entries(map).map(([k, v]) => '  ' + k + ": '" + v + "',").join('\n');
const out = [
  '/**',
  ' * Design Tokens（JS 镜像）— 由 scripts/gen-tokens-ts.cjs 从 variables.scss 自动生成，勿手改。',
  ' * 仅用于 ECharts 等需要真实色值的 JS 场景；样式请用 SCSS $令牌。',
  ' */',
  'export const tokens = {',
  lines,
  '} as const;',
  '',
  'export type TokenName = keyof typeof tokens;',
  '',
].join('\n');
fs.writeFileSync(path.join(root, 'frontend/src/styles/tokens.ts'), out);
console.log('生成 ' + Object.keys(map).length + ' 个令牌 -> frontend/src/styles/tokens.ts');
for (const [k, v] of Object.entries(map)) console.log('  ' + k + ' = ' + v);