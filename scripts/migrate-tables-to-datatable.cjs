/**
 * 批量迁移：视图内联 <el-table> -> <DataTable>（保守版，只做表格这一件事）。
 * 用法：
 *   node scripts/migrate-tables-to-datatable.cjs --dry            # 全量预演
 *   node scripts/migrate-tables-to-datatable.cjs --dry --only=X   # 单页预演
 *   node scripts/migrate-tables-to-datatable.cjs                  # 实际写入
 * 只处理「单表页」；解析异常/多表/含不支持写法时跳过并在报告中列出。
 */
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const VIEWS = path.join(root, 'frontend/src/views');
const DRY = process.argv.includes('--dry');
const ONLY = (process.argv.find(a => a.indexOf('--only=') === 0) || '').slice(7);

function walk(d) { const out = []; for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name);
  if (e.isDirectory()) out.push.apply(out, walk(f)); else if (e.name.endsWith('.vue')) out.push(f); } return out; }

function parseAttrs(s) {
  const out = {};
  const re = /([:@]?[A-Za-z_][\w-]*)(?:\s*=\s*"([^"]*)")?/g; let m;
  while ((m = re.exec(s)) !== null) { if (!m[1]) continue; out[m[1]] = m[2] === undefined ? true : m[2]; }
  return out;
}
const numOrStr = (v) => (/^\d+$/.test(String(v)) ? Number(v) : v);

/** 嵌套感知的闭合标签查找（template 会嵌套，如 #default 里再放 #header） */
function findMatchingClose(txt, gt, tag) {
  const closeTag = '</' + tag + '>';
  let depth = 1;
  let i = gt + 1;
  while (i < txt.length) {
    const nextOpen = txt.indexOf('<' + tag, i);
    const nextClose = txt.indexOf(closeTag, i);
    if (nextClose < 0) return -1;
    const after = txt.charAt(nextOpen + tag.length + 1);
    const realOpen = nextOpen >= 0 && nextOpen < nextClose && (after === '' || after === ' ' || after === '\n' || after === '\r' || after === '\t' || after === '>');
    if (realOpen) { depth++; i = nextOpen + tag.length + 1; }
    else { depth--; if (depth === 0) return nextClose; i = nextClose + closeTag.length; }
  }
  return -1;
}

/** 引号感知地定位开标签结束的 '>'——属性值里的 `=>`、`a > b` 不能被当成标签结束 */
function findTagEnd(txt, open) {
  let q = null;
  for (let i = open + 1; i < txt.length; i++) {
    const ch = txt[i];
    if (q) { if (ch === q) q = null; continue; }
    if (ch === '"' || ch === "'") { q = ch; continue; }
    if (ch === '>') return i;
  }
  return -1;
}

/** 截取一个以 <tag 开头的元素（支持自闭合；对 template 做嵌套配对） */
function extractElement(txt, startIdx, tag) {
  const open = txt.indexOf('<' + tag, startIdx);
  if (open < 0) return null;
  const gt = findTagEnd(txt, open);
  if (gt < 0) return null;
  if (txt[gt - 1] === '/') return { start: open, end: gt + 1, openTag: txt.slice(open, gt + 1), inner: '' };
  const close = findMatchingClose(txt, gt, tag);
  if (close < 0) return null;
  return { start: open, end: close + ('</' + tag + '>').length, openTag: txt.slice(open, gt + 1), inner: txt.slice(gt + 1, close) };
}

function convert(file) {
  const rel = path.relative(VIEWS, file).replace(/\\/g, '/');
  let txt = fs.readFileSync(file, 'utf-8');
  const COLN = (function () { const taken = new Set((txt.match(/const\s+(COLUMNS\w*)\s*:/g) || []).map((s) => s.replace(/const\s+|\s*:/g, ''))); let n = 'COLUMNS'; let k = 1; while (taken.has(n)) { k++; n = 'COLUMNS_' + k; } return n; })();
  const openCount = (txt.match(/<el-table[\s>]/g) || []).length;
  if (openCount === 0) return { rel, skip: '无内联表' };

  const tbl = extractElement(txt, 0, 'el-table');
  if (!tbl) return { rel, skip: '解析 el-table 失败' };
  const attrs = parseAttrs(tbl.openTag);

  // ---- 解析列 ----
  const cols = [];
  const slots = [];
  let i = 0; let n = 0;
  while (true) {
    const c = extractElement(tbl.inner, i, 'el-table-column');
    if (!c) break;
    i = c.end;
    const a = parseAttrs(c.openTag);
    if (a['v-for'] || a[':label'] || a[':prop']) return { rel, skip: '动态列(v-for/:label/:prop)' };
    if (a['type'] === 'selection') { cols.push({ __selection: true }); continue; }
    n++;
    const entry = {};
    if (a['type'] === 'index') entry.type = 'index';
    if (a.prop) entry.prop = a.prop;
    if (a.label) entry.label = a.label;
    if (a.width !== undefined) entry.width = numOrStr(a.width);
    if (a['min-width'] !== undefined) entry.minWidth = numOrStr(a['min-width']);
    if (a.fixed) entry.fixed = a.fixed === true ? true : a.fixed;
    if (a.sortable !== undefined) entry.sortable = a.sortable === true ? true : ('custom' === a.sortable ? 'custom' : a.sortable);
    if (a['show-overflow-tooltip'] !== undefined) entry.tooltip = a['show-overflow-tooltip'] === 'true' || a['show-overflow-tooltip'] === true;
    if (a.align) entry.align = a.align;
    if (!entry.label) entry.label = entry.prop || ('列' + n);

    const tpl = extractElement(c.inner, 0, 'template');
    if (tpl) {
      const tplAttrs = parseAttrs(tpl.openTag);
      const scopeRaw = tplAttrs['default'] !== undefined ? String(tplAttrs['default']) : '{ row }';
      const body = tpl.inner.trim();
      const simple = /^\{\{\s*row\.([A-Za-z_$][\w$]*)\s*\}\}$/.exec(body);
      if (simple && !entry.type) { entry.prop = entry.prop || simple[1]; }
      else {
        const slot = 'c' + n;
        entry.slot = slot;
        const rowExpr = scopeRaw;
        slots.push({ slot, rowExpr, body });
      }
    }
    // 兜底：无 label 且无 prop 且无 slot 的列无法迁移
    if (!entry.prop && !entry.slot && !entry.type) return { rel, skip: '存在无法解析的列' };
    cols.push(entry);
  }
  if (!cols.length) return { rel, skip: '未解析到列' };

  // ---- 空态 ----
  const emptyTpl = (function () {
    const m = /<template\s+#empty\s*>([\s\S]*?)<\/template>/.exec(tbl.inner);
    if (!m) return null;
    const es = extractElement(m[1], 0, 'EmptyState');
    if (!es) return null;
    const a = parseAttrs(es.openTag);
    return { title: a.title, description: a.description };
  })();

  // ---- 分页 ----
  let pager = null;
  const pag = extractElement(txt, tbl.end, 'el-pagination');
  if (pag && txt.slice(tbl.end, pag.start).trim() === '') {
    const a = parseAttrs(pag.openTag);
    pager = { page: a['v-model:current-page'] || a[':current-page'], total: a[':total'], pageSize: a[':page-size'], onChange: a['@current-change'] };
  }

  // ---- 生成 DataTable ----
  const inner = [];
  const dtAttrs = [];
  if (attrs[':data']) dtAttrs.push(':data="' + attrs[':data'] + '"');
  else if (attrs.data) dtAttrs.push(':data="' + attrs.data + '"');
  else return { rel, skip: '未找到 :data 绑定' };
  const loadingExpr = attrs['v-loading'];
  if (loadingExpr) dtAttrs.push(':loading="' + loadingExpr + '"');
  dtAttrs.push(':columns="' + COLN + '"');
  const rk = attrs['row-key'] || attrs[':row-key'] || 'id';
  dtAttrs.push('row-key="' + String(rk).replace(/"/g, '') + '"');
  if (cols.some((c) => c.__selection)) {
    dtAttrs.push('selectable');
    if (attrs['@selection-change']) dtAttrs.push('@selection-change="' + attrs['@selection-change'] + '"');
  }
  if (attrs['@row-click']) dtAttrs.push('@row-click="' + attrs['@row-click'] + '"');
  if (pager) {
    if (pager.page) dtAttrs.push('v-model:page="' + pager.page + '"');
    if (pager.total) dtAttrs.push(':total="' + pager.total + '"');
    if (pager.pageSize) dtAttrs.push(':page-size="' + pager.pageSize + '"');
    if (pager.onChange) dtAttrs.push('@page-change="' + pager.onChange + '"');
  }
  if (emptyTpl) {
    if (emptyTpl.title) dtAttrs.push('empty-title="' + emptyTpl.title + '"');
    if (emptyTpl.description) dtAttrs.push('empty-description="' + emptyTpl.description + '"');
  }
  const styleAttr = attrs.style ? ' style="' + attrs.style + '"' : '';
  const colCount = cols.filter((c) => !c.__selection).length;
  inner.push('<DataTable ' + dtAttrs.join(' ') + styleAttr + '>');
  for (const s of slots) inner.push('  <template #' + s.slot + '="' + s.rowExpr + '">' + s.body + '</template>');
  inner.push('</DataTable>');
  let newBlock = inner.join('\n');

  // ---- 替换：TableSkeleton + el-table (+ pagination) ----
  let from = tbl.start; let to = tbl.end;
  const skel = (function () { const k = txt.lastIndexOf('<TableSkeleton', tbl.start); if (k < 0) return null; const e = txt.indexOf('/>', k); return e > 0 && txt.slice(e + 2, tbl.start).trim() === '' ? { start: k, end: e + 2 } : null; })();
  if (skel) from = skel.start;
  if (pager) to = pag.end;
  const indent = (txt.slice(0, from).split('\n').pop() || '').match(/^\s*/)[0];
  newBlock = newBlock.split('\n').map((l, k) => (k === 0 ? l : indent + l)).join('\n');
  txt = txt.slice(0, from) + newBlock + txt.slice(to);

  // ---- 注入 script ----
  const colLines = cols.filter((c) => !c.__selection).map((c) => {
    const parts = [];
    if (c.type) parts.push("type: '" + c.type + "'");
    if (c.prop) parts.push("prop: '" + c.prop + "'");
    parts.push("label: '" + String(c.label).replace(/'/g, "\\'") + "'");
    if (c.width !== undefined) parts.push('width: ' + (typeof c.width === 'number' ? c.width : "'" + c.width + "'"));
    if (c.minWidth !== undefined) parts.push('minWidth: ' + (typeof c.minWidth === 'number' ? c.minWidth : "'" + c.minWidth + "'"));
    if (c.fixed) parts.push('fixed: ' + (c.fixed === true ? 'true' : "'" + c.fixed + "'"));
    if (c.sortable) parts.push("sortable: '" + c.sortable + "'");
    if (c.tooltip) parts.push('tooltip: true');
    if (c.align) parts.push("align: '" + c.align + "'");
    if (c.slot) parts.push("slot: '" + c.slot + "'");
    return '  { ' + parts.join(', ') + ' },';
  });
  const scriptStart = txt.indexOf('<script setup');
  if (scriptStart < 0) return { rel, skip: '非 <script setup>' };
  const scriptGt = txt.indexOf('>', scriptStart) + 1;
  const imports = "import DataTable from '@/components/base/DataTable.vue';\nimport type { TableColumn } from '@/components/base/types';\n";
  const colsDecl = '\nconst ' + COLN + ': TableColumn[] = [\n' + colLines.join('\n') + '\n];\n';
  if (!txt.includes('@/components/base/DataTable.vue')) txt = txt.slice(0, scriptGt) + '\n' + imports + txt.slice(scriptGt);
  const bodyStart = txt.indexOf('\n', txt.indexOf('<script setup')) + 1;
  const declAfter = txt.indexOf('\n', txt.indexOf('import type { TableColumn }', bodyStart));
  txt = txt.slice(0, declAfter + 1) + colsDecl + txt.slice(declAfter + 1);

  return { rel, txt, cols: colCount, slots: slots.length, selectable: cols.some((c) => c.__selection), pager: !!pager, output: newBlock };
}

const files = walk(VIEWS).filter((f) => (ONLY ? f.replace(/\\/g, '/').indexOf(ONLY) >= 0 : true));
const done = []; const skipped = [];
for (const f of files) {
  const r = convert(f);
  if (r.skip) { if (!ONLY) skipped.push(r.rel + '  ← ' + r.skip); continue; }
  if (DRY) { done.push(r); } else { fs.writeFileSync(f, r.txt); done.push(r); }
}
console.log((DRY ? '[DRY] ' : '[APPLY] ') + '可迁移 ' + done.length + ' 页 ｜ 跳过 ' + skipped.length + ' 页');
for (const d of done.slice(0, 3)) {
  console.log('\n----- ' + d.rel + '  (列 ' + d.cols + ' / 插槽 ' + d.slots + ' / selectable ' + d.selectable + ' / 分页 ' + d.pager + ') -----');
  console.log(d.output);
}
if (skipped.length) { console.log('\n跳过明细（前 30）：'); skipped.slice(0, 30).forEach((s) => console.log('  ' + s)); }
