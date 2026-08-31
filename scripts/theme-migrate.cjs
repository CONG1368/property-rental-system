
const fs = require('fs');
const path = require('path');

// 湛蓝玻璃拟物主题 — 旧色值迁移
// 打印模板（components/print）保持纸质深墨色，不参与迁移
const SKIP_DIRS = [path.join('src', 'components', 'print')];
const ROOT = path.join(__dirname, '..', 'frontend', 'src');

const MAP = {
  '#1a5f8a': '#3b66e0',   // 旧主色渐变末端 → 新强调深色
  '#F6B93B': '#f59e0b', '#f6b93b': '#f59e0b',   // 旧金 → warning
  '#00B894': '#10b981', '#00b894': '#10b981',   // 旧绿 → success
  '#FF6B35': '#f97316', '#ff6b35': '#f97316',   // 旧橙 → orange
  '#82CCDD': '#7ba0f9', '#82ccdd': '#7ba0f9',   // 旧浅蓝 → primary-light-3
};

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { walk(p, out); continue; }
    if (/\.(vue|ts|scss)$/.test(e.name)) out.push(p);
  }
  return out;
}

let files = 0, hits = 0;
for (const file of walk(ROOT)) {
  const rel = path.relative(path.join(__dirname, '..', 'frontend'), file);
  if (SKIP_DIRS.some(d => rel.includes(d))) continue;
  let s = fs.readFileSync(file, 'utf8');
  const before = s;

  // 1) 旧主色 #0A3D62：CSS 文字色 → 中性标题色；其余（背景/边框/图表/主题色）→ 强调蓝
  s = s.replace(/color:\s*(#0A3D62|#0a3d62)/g, (m) => { hits++; return m.replace(/#0A3D62|#0a3d62/, '#1f2430'); });
  s = s.replace(/#0A3D62|#0a3d62/g, () => { hits++; return '#4f7cf7'; });

  // 2) 其余固定映射
  for (const [oldC, newC] of Object.entries(MAP)) {
    s = s.split(oldC).join(newC) === s ? s : (() => { const c = s.split(oldC).length - 1; hits += c; return s.split(oldC).join(newC); })();
  }

  if (s !== before) { fs.writeFileSync(file, s); files++; }
}
console.log('主题色迁移完成：' + files + ' 个文件，' + hits + ' 处色值');
