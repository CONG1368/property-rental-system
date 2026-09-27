'use strict';
const fs = require('fs'); const path = require('path');
const root = path.resolve(__dirname, '..');
const DRY = process.argv.includes('--dry');
const ONLY = (process.argv.find(a => a.indexOf('--only=') === 0) || '').slice(7);
const indentOf = (l) => (l.match(/^[ \t]*/) || [''])[0];
function findClose(lines, open, ind) { for (let j = open + 1; j < lines.length; j++) { if (lines[j].trim() === '</div>' && indentOf(lines[j]) === ind) return j; } return -1; }
const clean = (arr, keep) => arr.map(l => l.replace(/\s*style="margin-left:\s*auto"/g, '')).filter(l => l.trim() && !/^\s*<!--/.test(l));
function unwrapActions(a) { return (a.length >= 2 && /<div class="action-group"/.test(a[0]) && a[a.length - 1].trim() === '</div>') ? a.slice(1, -1) : a; }
function convert(file) {
  const raw = fs.readFileSync(file, 'utf-8');
  if (!/\.toolbar\s*\{/.test(raw)) return { skip: '无 .toolbar 样式' };
  const eol = raw.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
  const lines = raw.split(/\r?\n/);
  const oi = lines.findIndex(l => /^[ \t]*<div[^>]*class="[^"]*\btoolbar\b[^"]*"[^>]*>\s*$/.test(l));
  if (oi < 0) return { skip: '无 .toolbar 元素行' };
  const oInd = indentOf(lines[oi]); const ci = findClose(lines, oi, oInd);
  if (ci < 0) return { skip: '找不到闭合' };
  let si = -1, sc = -1;
  for (let j = oi + 1; j < ci; j++) if (/^[ \t]*<div class="search-group"\s*>\s*$/.test(lines[j])) { si = j; sc = findClose(lines, j, indentOf(lines[j])); break; }
  let filt = [], rest = [];
  if (si >= 0 && sc > 0) { filt = lines.slice(si + 1, sc).map(l => l.slice(indentOf(lines[si]).length + 2)); rest = lines.slice(oi + 1, si).concat(lines.slice(sc + 1, ci)); }
  else filt = lines.slice(oi + 1, ci).map(l => l.slice(oInd.length + 2));
  const hasCtl = filt.some(l => /<el-input|<el-select|<el-date-picker/.test(l));
  const P = oInd; const out = []; let imp = '';
  if (hasCtl) {
    const ti = rest.findIndex(l => /<h2[^>]*class="page-title"/.test(l));
    if (ti >= 0) out.push(rest.splice(ti, 1)[0]);
    let act = unwrapActions(clean(rest));
    out.push(P + '<FilterBar>');
    for (const l of filt) out.push(l.trim() ? P + '  ' + l.replace(/^[ \t]+/, '') : l);
    if (act.length) { out.push(P + '  <template #actions>'); for (const l of act) out.push(P + '    ' + l.replace(/^[ \t]+/, '')); out.push(P + '  </template>'); }
    out.push(P + '</FilterBar>');
    imp = "import FilterBar from '@/components/base/FilterBar.vue';";
  } else {
    const all = lines.slice(oi + 1, ci);
    const ti = all.findIndex(l => /<h2[^>]*class="page-title"/.test(l));
    if (ti < 0) return { skip: '无标题且无筛选控件' };
    const t = (/<h2[^>]*class="page-title"[^>]*>([\s\S]*?)<\/h2>/.exec(all[ti]) || [])[1] || '';
    const title = t.trim();
    if (!title || title.indexOf('"') >= 0) return { skip: '标题含引号或为空' };
    const acts = unwrapActions(clean(all.filter((_, i) => i !== ti)));
    out.push(P + '<PageHeader title="' + title + '">');
    if (acts.length) { out.push(P + '  <template #actions>'); for (const l of acts) out.push(P + '    ' + l.replace(/^[ \t]+/, '')); out.push(P + '  </template>'); }
    out.push(P + '</PageHeader>');
    imp = "import PageHeader from '@/components/base/PageHeader.vue';";
  }
  let txt = lines.slice(0, oi).concat(out, lines.slice(ci + 1)).join(eol);
  txt = txt.replace(/\r?\n[ \t]*\.(toolbar|search-group|action-group)(?![-\w])[^{]*\{[^{}]*\}/g, '');
  if (txt.indexOf(imp) < 0) {
    const sm = /<script setup lang="ts">/.exec(txt); if (!sm) return { skip: '非 script setup' };
    const at = sm.index + sm[0].length;
    txt = txt.slice(0, at) + eol + imp + txt.slice(at); }
  return { txt, kind: hasCtl ? 'FilterBar' : 'PageHeader', f: filt.filter(l => l.trim()).length, a: out.filter(l => l.trim()).length, rel: path.relative(root, file) };
}
function walk(d) { const o = []; for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name);
  if (e.isDirectory()) { if (e.name !== 'node_modules') o.push(...walk(f)); } else if (e.name.endsWith('.vue')) o.push(f); } return o; }
const base = path.join(root, 'frontend/src/views');
const targets = ONLY ? ONLY.split(',').map(r => path.join(base, r)) : walk(base);
const tally = {};
for (const f of targets) { const r = convert(f);
  let k = r.skip ? 'SKIP: ' + r.skip : 'OK ' + r.kind;
  tally[k] = (tally[k] || 0) + 1;
  if (!r.skip && !DRY) fs.writeFileSync(f, r.txt); }
for (const k of Object.keys(tally).sort()) console.log(String(tally[k]).padStart(4) + '  ' + k);