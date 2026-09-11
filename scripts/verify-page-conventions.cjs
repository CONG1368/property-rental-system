// 第 6 周门槛：新增页面的默认动作是「组装组件」而不是「新建样式」。
// 静态检查（无需 dev），可作 CI 门禁。
//
// 硬性规则（必须 0 违规）：
//   P1 base/ 组件不得出现业务词汇（依赖方向：modules → base 单向）
//   P2 视图不得使用 backdrop-filter（玻璃只允许在 global.scss 与外壳组件里）
//   P3 base/ 组件不得 import modules/
// 棘轮规则（不得比基线更差；迁移有进展时把基线调低）：
//   P4 自行声明 .toolbar / .search-group 样式的文件数 <= BASELINE
//   P5 使用内联 <el-table> 的文件数 <= BASELINE
//   P6 <style> 块引用 $令牌必须声明 lang="scss"（硬性 0 违规）
// 棘轮统计范围 = frontend/src 全量（不只 views/），防止把内联表或工具栏样式挪进 components/ 重生；
// 豁免清单见 RATCHET_EXEMPT_*，每条都必须写明理由。
// 参考指标（只打印，不判定）：DataTable / FilterBar 采用率。
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const VIEWS = path.join(root, 'frontend/src/views');
const BASE = path.join(root, 'frontend/src/components/base');
const SRC = path.join(root, 'frontend/src');

// —— 棘轮豁免清单（每条都必须有理由，禁止随手加）——
// P4：应用外壳本身就是工具栏，天然拥有 .toolbar 样式
const RATCHET_EXEMPT_TOOLBAR = ['frontend/src/components/layout/', 'frontend/src/components/surfaces/'];
// P5：① DataTable 自身就是 el-table 的封装层；② 可编辑录入网格（行内是 input/select/number）不适合 DataTable（只读展示件）
const RATCHET_EXEMPT_TABLE = [
  'frontend/src/components/base/DataTable.vue',
  'frontend/src/components/modules/finance/VoucherEntryRows.vue',
];

// —— 棘轮基线（迁移推进后请调低；数字只许降不许升）——
const BASELINE = { toolbarViews: 40, inlineTableView: 0 };

let pass = 0; const failures = [];
function ok(name, violations, scanned) {
  const scale = scanned ? '  [' + scanned + ']' : '';
  if (!violations.length) { pass++; console.log('PASS: ' + name + scale); return; }
  failures.push(name);
  console.log('FAIL: ' + name + '  => ' + violations.length + ' 处');
  violations.slice(0, 10).forEach((v) => console.log('        ' + v));
  if (violations.length > 10) console.log('        ...（其余 ' + (violations.length - 10) + ' 处省略）');
}
function walk(dir, exts) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name === 'node_modules' || e.name === 'dist') continue; out.push.apply(out, walk(f, exts)); }
    else if (exts.some((x) => e.name.endsWith(x))) out.push(f);
  }
  return out;
}
const rel = (f) => path.relative(root, f).replace(/\\/g, '/');

// —— P1 base/ 无业务词汇 ——
function checkBaseNoBusinessWords() {
  const WORDS = ['已缴', '未缴', '逾期', '租客', '房源', '合同', '账单', '凭证', '发票', '费用', '门锁', '水电'];
  const v = [];
  for (const f of walk(BASE, ['.vue', '.ts'])) {
    const r = rel(f);
    if (r.endsWith('types.ts')) continue;   // 类型注释可能提到示例
    fs.readFileSync(f, 'utf-8').split(/\r?\n/).forEach((line, i) => {
      const hit = WORDS.find((w) => line.indexOf(w) >= 0);
      if (hit) v.push(r + ':' + (i + 1) + '  ' + hit + '  ' + line.trim().slice(0, 60));
    });
  }
  ok('P1 base/ 组件无业务词汇（依赖方向单向）', v, '扫描 ' + walk(BASE, ['.vue', '.ts']).length + ' 个 base 文件');
}

// —— P2 视图不得使用 backdrop-filter ——
function checkNoBlurInViews() {
  const v = [];
  const files = walk(VIEWS, ['.vue']);
  for (const f of files) {
    fs.readFileSync(f, 'utf-8').split(/\r?\n/).forEach((line, i) => {
      if (/^[^-]*backdrop-filter/.test(line)) v.push(rel(f) + ':' + (i + 1) + '  ' + line.trim().slice(0, 60));
    });
  }
  ok('P2 视图无毛玻璃（玻璃只在 global.scss 与外壳组件）', v, '扫描 ' + files.length + ' 个视图');
}

// —— P3 base/ 不得 import modules/ ——
function checkBaseDependencyDirection() {
  const v = [];
  for (const f of walk(BASE, ['.vue', '.ts'])) {
    fs.readFileSync(f, 'utf-8').split(/\r?\n/).forEach((line, i) => {
      if (/from\s+['"][^'"]*components\/modules\//.test(line)) v.push(rel(f) + ':' + (i + 1) + '  ' + line.trim().slice(0, 70));
    });
  }
  ok('P3 base/ 不依赖 modules/（依赖方向硬约束）', v);
}

// —— P4/P5 棘轮 ——
function checkRatchet() {
  const files = walk(SRC, ['.vue']);
  let toolbar = 0; let inlineTable = 0; let dataTable = 0; let filterBar = 0;
  const hitToolbar = []; const hitTable = [];
  for (const f of files) {
    const r = rel(f);
    const t = fs.readFileSync(f, 'utf-8');
    if (!RATCHET_EXEMPT_TOOLBAR.some((p) => r.startsWith(p)) && /\.toolbar\s*\{|\.search-group\s*\{/.test(t)) { toolbar++; hitToolbar.push(r); }
    if (!RATCHET_EXEMPT_TABLE.includes(r) && /<el-table[\s>]/.test(t)) { inlineTable++; hitTable.push(r); }
    if (/<DataTable/.test(t)) dataTable++;
    if (/<FilterBar/.test(t)) filterBar++;
  }
  ok('P4 自写 .toolbar/.search-group 样式的文件数 <= ' + BASELINE.toolbarViews, toolbar > BASELINE.toolbarViews ? hitToolbar : [], '当前 ' + toolbar);
  ok('P5 内联 <el-table> 的文件数 <= ' + BASELINE.inlineTableView, inlineTable > BASELINE.inlineTableView ? hitTable : [], '当前 ' + inlineTable);
  console.log('参考: 扫描文件 ' + files.length + ' ｜ DataTable 采用 ' + dataTable + ' ｜ FilterBar 采用 ' + filterBar);
}

// —— P6 <style> 块用 $令牌必须声明 lang="scss" ——
function checkScssLang() {
  const v = [];
  const files = walk(SRC, ['.vue']);
  for (const f of files) {
    const t = fs.readFileSync(f, 'utf-8');
    const re = /<style([^>]*)>([\s\S]*?)<\/style>/g; let m;
    while ((m = re.exec(t)) !== null) {
      if (/lang\s*=\s*['"](scss|sass)['"]/.test(m[1])) continue;
      const vars = m[2].match(/\$[a-zA-Z_][\w-]*/g);
      if (vars) v.push(rel(f) + '  未声明 lang="scss" 却引用 ' + vars.length + ' 处 $变量（声明会被浏览器丢弃）');
    }
  }
  ok('P6 <style> 用 $令牌必须写 lang="scss"（否则按纯 CSS 编译、变量被丢弃）', v, '扫描 ' + files.length + ' 个文件');
}

console.log('=== 页面约定门禁 ===');
checkBaseNoBusinessWords();
checkNoBlurInViews();
checkBaseDependencyDirection();
checkRatchet();
checkScssLang();
const total = pass + failures.length;
console.log('');
console.log('SUMMARY: ' + pass + '/' + total + ' checks passed');
if (failures.length) console.log('违规: ' + failures.join(', '));
process.exit(failures.length ? 1 : 0);
