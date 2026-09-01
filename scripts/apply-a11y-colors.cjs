
/**
 * 无障碍配色迁移：把「文字场景」的语义色替换为 WCAG AA 达标的 -text 变体
 * 依据：docs/对比度检查报告.md
 * 规则：
 *   1) 只处理 .vue 的 <template>/<style> 片段与 .scss 文件——<script> 段内的
 *      color 多为 ECharts 系列色/标签底色（属填充，门槛 3:1），不参与替换；
 *   2) 仅替换真正的文字色（color: 前不能是 background-/border-/-）；
 *   3) 次要文字 #8b93a3（2.47:1）在任何场景都不达标，全量替换。
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', 'frontend', 'src');
const SKIP = [path.join('components', 'print'), path.join('styles', 'variables.scss'), path.join('styles', 'global.scss')];

// 文字色映射（仅用于 color: 场景）
const TEXT_MAP = {
  '#f59e0b': '#8a5200', '#F59E0B': '#8a5200',
  '#10b981': '#0a7652', '#10B981': '#0a7652',
  '#ef4444': '#bf2626', '#EF4444': '#bf2626',
  '#4f7cf7': '#2b57c9', '#4F7CF7': '#2b57c9',
  '#3b66e0': '#1e50bd', '#3B66E0': '#1e50bd',
};
// 全量替换（该色仅用于次要文字）
const GLOBAL_MAP = { '#8b93a3': '#5f6675', '#8B93A3': '#5f6675' };

function replaceTextColors(chunk) {
  let n = 0;
  // color: #xxx / color:'#xxx' / color: "#xxx"（排除 background-color / border-color 等）
  chunk = chunk.replace(/(?<![-\w])color\s*:\s*(['"]?)(#[0-9a-fA-F]{6})\1/g, (m, q, hex) => {
    const to = TEXT_MAP[hex];
    if (!to) return m;
    n++;
    return m.replace(hex, to);
  });
  // el-icon 的 color="#xxx" 属性（细线图标按文字处理）
  chunk = chunk.replace(/color="(#[0-9a-fA-F]{6})"/g, (m, hex) => {
    const to = TEXT_MAP[hex];
    if (!to) return m;
    n++;
    return 'color="' + to + '"';
  });
  return { chunk, n };
}

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(vue|scss|ts)$/.test(e.name)) out.push(p);
  }
  return out;
}

let files = 0, textHits = 0, subtleHits = 0;
for (const file of walk(ROOT)) {
  const rel = path.relative(ROOT, file);
  if (SKIP.some(s => rel.includes(s))) continue;
  let s = fs.readFileSync(file, 'utf8');
  const before = s;

  if (file.endsWith('.vue')) {
    // 按 <script ...> ... </script> 切分，只在非 script 片段替换文字色
    const parts = s.split(/(<script[\s\S]*?<\/script>)/);
    for (let i = 0; i < parts.length; i++) {
      if (parts[i].startsWith('<script')) continue;
      const r = replaceTextColors(parts[i]);
      parts[i] = r.chunk; textHits += r.n;
    }
    s = parts.join('');
  } else if (file.endsWith('.scss')) {
    const r = replaceTextColors(s);
    s = r.chunk; textHits += r.n;
  }

  // 次要文字色全量替换（含 script 段，它只用于文字）
  for (const [oldC, newC] of Object.entries(GLOBAL_MAP)) {
    const cnt = s.split(oldC).length - 1;
    if (cnt) { s = s.split(oldC).join(newC); subtleHits += cnt; }
  }

  if (s !== before) { fs.writeFileSync(file, s); files++; }
}
console.log('无障碍配色迁移完成：' + files + ' 个文件，文字语义色 ' + textHits + ' 处，次要文字色 ' + subtleHits + ' 处');
