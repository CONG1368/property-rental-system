/**
 * 静态铁律门禁 — 不需要启动任何服务，可在纯 CI 环境（仅 checkout + node）运行
 * 用法: node scripts/check-static-rules.cjs
 *
 * 规则来源：CLAUDE.md 中被标注为「铁律 / 重要陷阱」但此前没有任何自动检查的条目
 *   R1 ANTI-EMOJI          UI 与代码禁用 emoji（仅 avatars.ts 的 legacy 兼容映射豁免）
 *   R2 主题色硬编码          页面禁止出现旧配色字面量（打印模板面向纸质输出，豁免）
 *   R3 版本号硬编码          版本号只能用 __APP_VERSION__ 注入
 *   R4 生产 URL 硬编码       fetch / el-upload action 禁止写死 /api 相对路径（file:// 下必挂）
 *   R5 multer fileFilter    每个 multer 实例必须声明 fileFilter（安全要求）
 *   R6 财务写操作中间件       finance 路由的写端点必须同时挂 requirePermission + auditLog
 *
 * 豁免写法：在违规行尾加注释 ci-allow:<规则号>，例如  // ci-allow:R3
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
let pass = 0;
const failures = [];

function ok(name, violations, scanned) {
  const scale = scanned ? '  [' + scanned + ']' : '';
  if (!violations.length) {
    pass++;
    console.log('PASS: ' + name + scale);
    return;
  }
  failures.push({ name, violations });
  console.log('FAIL: ' + name + '  => ' + violations.length + ' 处');
  violations.slice(0, 12).forEach((v) => console.log('        ' + v));
  if (violations.length > 12) console.log('        ...（其余 ' + (violations.length - 12) + ' 处省略）');
}

function walk(dir, exts, skipDirs) {
  const skip = skipDirs || [];
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const rel = path.relative(root, full).replace(/\\/g, '/');
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue;
      if (skip.some((s) => rel === s || rel.indexOf(s + '/') === 0)) continue;
      out.push.apply(out, walk(full, exts, skip));
    } else if (exts.some((x) => entry.name.endsWith(x))) {
      out.push(full);
    }
  }
  return out;
}

const relOf = (f) => path.relative(root, f).replace(/\\/g, '/');
const allowed = (line, ruleId) => line.indexOf('ci-allow:' + ruleId) >= 0;
const lineNoAt = (txt, idx) => txt.slice(0, idx).split(/\r?\n/).length;

// ============================================================
// R1 ANTI-EMOJI
// 箭头区（U+2190-21FF）在注释里大量用于表达流程，不算 emoji，不纳入
// ============================================================
const EMOJI_RE = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/u;

function checkEmoji() {
  const v = [];
  let scanned = 0;
  for (const f of walk(path.join(root, 'frontend/src'), ['.vue', '.ts'])) {
    scanned++;
    const rel = relOf(f);
    const isAvatars = rel.indexOf('utils/avatars.ts') >= 0;
    let inLegacyMap = false;
    fs.readFileSync(f, 'utf-8').split(/\r?\n/).forEach((line, i) => {
      // avatars.ts 的 legacyEmojiMap 是历史数据兼容映射，块内豁免
      if (isAvatars) {
        if (line.indexOf('legacyEmojiMap') >= 0) inLegacyMap = true;
        else if (inLegacyMap && line.trim() === '};') inLegacyMap = false;
        if (inLegacyMap) return;
      }
      if (EMOJI_RE.test(line) && !allowed(line, 'R1')) {
        v.push(rel + ':' + (i + 1) + '  ' + line.trim().slice(0, 90));
      }
    });
  }
  ok('R1 ANTI-EMOJI（前端源码无 emoji，一律用 Element Plus 线性图标）', v, '扫描 ' + scanned + ' 个前端文件');
}

// ============================================================
// R2 旧主题色硬编码（打印模板豁免）
// ============================================================
const LEGACY_COLORS = ['#0A3D62', '#F6B93B', '#00B894', '#FF6B35', '#82CCDD', '#1a5f8a'];

function checkLegacyColors() {
  const v = [];
  const files = walk(path.join(root, 'frontend/src'), ['.vue', '.ts', '.scss'], ['frontend/src/components/print']);
  for (const f of files) {
    const rel = relOf(f);
    fs.readFileSync(f, 'utf-8').split(/\r?\n/).forEach((line, i) => {
      const low = line.toLowerCase();
      const hit = LEGACY_COLORS.find((c) => low.indexOf(c.toLowerCase()) >= 0);
      if (hit && !allowed(line, 'R2')) v.push(rel + ':' + (i + 1) + '  ' + hit + '  ' + line.trim().slice(0, 80));
    });
  }
  ok('R2 无旧主题色硬编码（湛蓝令牌唯一来源 variables.scss）', v, '扫描 ' + files.length + ' 个文件（打印模板豁免）');
}

// ============================================================
// R3 版本号硬编码
// ============================================================
function checkVersionLiteral() {
  const v = [];
  const files = walk(path.join(root, 'frontend/src'), ['.vue', '.ts'])
    .concat(walk(path.join(root, 'electron'), ['.ts']));
  for (const f of files) {
    const rel = relOf(f);
    if (rel.endsWith('env.d.ts')) continue; // 类型声明
    fs.readFileSync(f, 'utf-8').split(/\r?\n/).forEach((line, i) => {
      if (allowed(line, 'R3')) return;
      if (/(['"])\d+\.\d+\.\d+\1/.test(line) || /\bv\d+\.\d+\.\d+\b/.test(line)) {
        v.push(rel + ':' + (i + 1) + '  ' + line.trim().slice(0, 90));
      }
    });
  }
  ok('R3 无版本号硬编码（统一 __APP_VERSION__ 注入）', v, '扫描 ' + files.length + ' 个文件');
}

// ============================================================
// R4 生产环境 URL 硬编码（Electron file:// 下相对 /api 必然失败）
// ============================================================
function checkHardcodedApiUrl() {
  const v = [];
  let scanned = 0;
  for (const f of walk(path.join(root, 'frontend/src'), ['.vue', '.ts'])) {
    scanned++;
    const rel = relOf(f);
    fs.readFileSync(f, 'utf-8').split(/\r?\n/).forEach((line, i) => {
      if (allowed(line, 'R4')) return;
      const bad =
        /fetch\(\s*['"\x60]\/api/.test(line) ||
        /:?action\s*=\s*['"\x60]\/api/.test(line) ||
        /['"\x60]\/api\/[^'"\x60]*['"\x60]\s*,\s*\{\s*method/.test(line);
      if (bad) v.push(rel + ':' + (i + 1) + '  ' + line.trim().slice(0, 90));
    });
  }
  ok('R4 无生产 URL 硬编码（fetch/el-upload 必须用 apiBaseURL）', v, '扫描 ' + scanned + ' 个前端文件');
}

// ============================================================
// R5 multer 必须有 fileFilter
// ============================================================
function checkMulterFileFilter() {
  const v = [];
  let found = 0;
  for (const f of walk(path.join(root, 'backend/src/routes'), ['.ts'])) {
    const rel = relOf(f);
    const txt = fs.readFileSync(f, 'utf-8');
    const re = /multer\(\s*\{/g;
    let m;
    while ((m = re.exec(txt)) !== null) {
      // 从 multer({ 起截 1200 字符作为配置块作用域
      found++;
      const block = txt.slice(m.index, m.index + 1200);
      if (!/fileFilter\s*:/.test(block)) v.push(rel + ':' + lineNoAt(txt, m.index) + '  multer 实例缺少 fileFilter');
    }
  }
  ok('R5 全部 multer 实例声明 fileFilter（上传类型白名单）', v, '检出 ' + found + ' 个 multer 实例');
}

// ============================================================
// R6 财务写操作中间件齐备
// ============================================================
const FINANCE_ROUTES = [
  'vouchers', 'expenses', 'budgets', 'accounts', 'accountBooks',
  'tax', 'fixedAssets', 'invoices', 'bankReconciliation', 'costAllocation',
];

function checkFinanceGuards() {
  const v = [];
  let endpoints = 0;
  for (const name of FINANCE_ROUTES) {
    const f = path.join(root, 'backend/src/routes', name + '.ts');
    if (!fs.existsSync(f)) { v.push(name + '.ts 不存在（财务路由清单需同步更新）'); continue; }
    const txt = fs.readFileSync(f, 'utf-8');
    const re = /router\.(post|put|patch|delete)\(\s*'([^']*)'([\s\S]*?)(?:async\s*\(|\(req|\(_req)/g;
    let m;
    while ((m = re.exec(txt)) !== null) {
      endpoints++;
      const chain = m[3];
      const miss = [];
      if (chain.indexOf('requirePermission') < 0) miss.push('requirePermission');
      if (chain.indexOf('auditLog') < 0) miss.push('auditLog');
      if (miss.length) {
        v.push(name + '.ts:' + lineNoAt(txt, m.index) + '  ' + m[1].toUpperCase() + ' ' + m[2] + '  缺 ' + miss.join(' + '));
      }
    }
  }
  ok('R6 财务写端点均挂 requirePermission + auditLog', v, '检出 ' + endpoints + ' 个写端点 / ' + FINANCE_ROUTES.length + ' 个财务路由文件');
}

// ============================================================
console.log('=== 静态铁律门禁 ===');
checkEmoji();
checkLegacyColors();
checkVersionLiteral();
checkHardcodedApiUrl();
checkMulterFileFilter();
checkFinanceGuards();

const total = pass + failures.length;
console.log('');
console.log('SUMMARY: ' + pass + '/' + total + ' rules passed');
if (failures.length) {
  console.log('违规规则: ' + failures.map((f) => f.name.split(' ')[0]).join(', '));
  console.log('如确属误报，可在该行加注释 ci-allow:<规则号> 豁免');
}
process.exit(failures.length ? 1 : 0);
