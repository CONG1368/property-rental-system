/**
 * 依赖漏洞门禁 —— 生产依赖（--omit=dev）中出现 high/critical 漏洞即失败
 * 用法：node scripts/check-deps-audit.cjs [--level=high|critical]
 *
 * 豁免机制：ALLOWLIST 中的包不计入失败，但必须写明理由与复审期限；
 *   - 过了 until 日期 → 门禁失败，强制重新评估（避免"豁免一次就永久遗忘"）
 *   - 豁免项在实际审计结果中已消失 → 提示可以删除该条目
 * 离线（连不上 registry）时打印告警并跳过，不误报为漏洞。
 */
const { spawnSync } = require('child_process');
const path = require('path');

const root = path.resolve(__dirname, '..');
const SCOPES = ['.', 'backend', 'frontend'];
const ORDER = { info: 0, low: 1, moderate: 2, high: 3, critical: 4 };

const levelArg = (process.argv.find((a) => a.startsWith('--level=')) || '').split('=')[1];
const FAIL_LEVEL = ORDER[levelArg] !== undefined ? ORDER[levelArg] : ORDER.high;

// ============================================================
// 豁免清单：上游无补丁、需要产品决策的项
// ============================================================
const ALLOWLIST = {
  xlsx: {
    reason: 'SheetJS 的 npm 包停更在 0.18.5，官方补丁只在自有 CDN 发布；替换方案（CDN 版 / 统一到 exceljs）评估中',
    until: '2026-12-31',
  },
};

function auditScope(scope) {
  const cwd = path.join(root, scope);
  const r = spawnSync('npm', ['audit', '--omit=dev', '--json'], { cwd, shell: true, encoding: 'utf-8', maxBuffer: 32 * 1024 * 1024 });
  const text = (r.stdout || '').trim();
  const start = text.indexOf('{');
  if (start < 0) return { offline: true, vulns: {} };
  let json;
  try { json = JSON.parse(text.slice(start)); } catch { return { offline: true, vulns: {} }; }
  if (json.error) return { offline: true, vulns: {} };
  return { offline: false, vulns: json.vulnerabilities || {} };
}

console.log('=== 依赖漏洞门禁（生产依赖，>= ' + (levelArg || 'high') + ' 阻断）===');

const blocking = [];
const exempted = [];
const seenAllow = new Set();
let offlineScopes = 0;

for (const scope of SCOPES) {
  const { offline, vulns } = auditScope(scope);
  if (offline) { offlineScopes++; console.log('[' + scope + '] 无法获取审计结果（离线或 registry 不可达），跳过'); continue; }
  const names = Object.keys(vulns);
  const counts = { critical: 0, high: 0, moderate: 0, low: 0 };
  names.forEach((n) => { counts[vulns[n].severity] = (counts[vulns[n].severity] || 0) + 1; });
  console.log('[' + scope + '] 漏洞 ' + names.length + ' 个  critical=' + counts.critical + ' high=' + counts.high + ' moderate=' + counts.moderate + ' low=' + counts.low);

  for (const name of names) {
    const v = vulns[name];
    if ((ORDER[v.severity] ?? 0) < FAIL_LEVEL) continue;
    if (ALLOWLIST[name]) { seenAllow.add(name); exempted.push({ scope, name, severity: v.severity }); continue; }
    blocking.push({ scope, name, severity: v.severity, fix: v.fixAvailable === false ? '上游无补丁' : (v.fixAvailable === true ? 'npm audit fix 可修' : '需大版本升级') });
  }
}

if (exempted.length) {
  console.log('');
  console.log('豁免项（不阻断，但有复审期限）：');
  for (const e of exempted) {
    const a = ALLOWLIST[e.name];
    console.log('  [EXEMPT] ' + e.scope + '/' + e.name + ' (' + e.severity + ') 复审期限 ' + a.until + ' — ' + a.reason);
  }
}

// 豁免过期 → 强制重新评估
const today = new Date().toISOString().slice(0, 10);
const expired = Object.keys(ALLOWLIST).filter((n) => seenAllow.has(n) && ALLOWLIST[n].until < today);
for (const n of expired) {
  blocking.push({ scope: '-', name: n, severity: 'expired', fix: '豁免已于 ' + ALLOWLIST[n].until + ' 到期，请重新评估或延期' });
}
// 豁免已失效（漏洞消失）→ 提示清理，不阻断
for (const n of Object.keys(ALLOWLIST)) {
  if (!seenAllow.has(n) && offlineScopes === 0) console.log('  [INFO] 豁免项 ' + n + ' 已无对应漏洞，可从 ALLOWLIST 移除');
}

console.log('');
if (blocking.length) {
  console.log('FAIL: ' + blocking.length + ' 个需处理的漏洞');
  blocking.forEach((b) => console.log('  - ' + b.scope + '/' + b.name + ' [' + b.severity + '] ' + b.fix));
  console.log('修复：cd <目录> && npm audit fix；大版本升级需评估后手动执行');
  process.exit(1);
}
console.log('PASS: 生产依赖无未豁免的 high/critical 漏洞' + (offlineScopes ? '（有 ' + offlineScopes + ' 个范围因离线跳过）' : ''));
process.exit(0);
