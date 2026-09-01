const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');

// ============================================================
// 全链路回归入口
//   node scripts/run-all-regression.js            全量（需先启动 npm run dev）
//   node scripts/run-all-regression.js --static   只跑无需服务的门禁（CI 可用）
//
// 分三段：
//   A 静态门禁     不需要任何服务，纯 checkout + node 即可跑
//   B 类型/构建门禁 不需要服务，但需要已 npm install
//   C 运行时回归   需要 npm run dev（前端 5173 + 后端 3001）
// 顺序要求：permission-regression 必须在 e2e-permission-matrix 之前，
//          因为后者会写入角色权限定制，影响前者的基线断言
// ============================================================

const STATIC_ONLY = process.argv.slice(2).some((a) => a === '--static' || a === '--static-only');

// A 段：静态门禁（无需服务）
const staticTests = [
  'check-static-rules.cjs', // 6 条铁律：emoji/主题色/版本号/生产URL/multer/财务中间件
  'check-contrast.cjs',     // WCAG 2.1 AA 对比度
  'check-deps-audit.cjs',   // 生产依赖漏洞（需 registry，离线自动跳过）
];

// C 段：需要 dev 服务的 Node 脚本（按依赖顺序串行）
const nodeTests = [
  'full-e2e-test.js',
  'e2e-newmodules-regression.js',
  'e2e-new-modules.js',
  'e2e-uncovered-pages.js',
  'verify-excel-import.js',
  'verify-websocket.js',
  'verify-dashboard.js',
  'verify-system-settings.js',
  'verify-uncovered-api.js',
  'verify-ux-states.cjs',
  'permission-regression.js',
  'e2e-permission-matrix.js',
  'e2e-confirm-password.js',
];

// C 段：TypeScript 脚本（用 backend 的 tsx 运行，实际不需要服务，但归入全量）
const tsTests = ['verify-external-providers.ts'];

// bash 脚本（后端 API 全量测试，需要 bash + curl）
const bashCandidates = [
  'C:\\Program Files\\Git\\bin\\bash.exe',
  'C:\\Program Files (x86)\\Git\\bin\\bash.exe',
];

console.log('=== 全链路回归开始' + (STATIC_ONLY ? '（--static：仅无服务依赖项）' : '') + ' ===');
let failed = 0;
const summary = [];

function report(name, status) {
  const ok = status === 0;
  if (!ok) failed++;
  summary.push((ok ? '√ ' : '× ') + name);
  console.log((ok ? '√ ' : '× ') + name + (ok ? ' 通过' : ' 失败'));
}

function skip(name, why) {
  summary.push('- ' + name + ' 跳过（' + why + '）');
  console.log('- 跳过 ' + name + '（' + why + '）');
}

function runNode(script) {
  console.log('\n---------- 运行 ' + script + ' ----------');
  const r = spawnSync(process.execPath, [path.join('scripts', script)], { cwd: root, stdio: 'inherit' });
  report(script, r.status);
}

function runCmd(label, cmd, args, cwd) {
  console.log('\n---------- 运行 ' + label + ' ----------');
  const r = spawnSync(cmd, args, { cwd, stdio: 'inherit', shell: true });
  report(label, r.status);
}

// ---------- A 段：静态门禁 ----------
console.log('\n########## A 段：静态门禁（无需服务） ##########');
staticTests.forEach(runNode);

// ---------- B 段：类型 / 构建产物门禁 ----------
console.log('\n########## B 段：类型与构建门禁（无需服务） ##########');
runCmd('frontend vue-tsc --noEmit', 'npx', ['vue-tsc', '--noEmit'], path.join(root, 'frontend'));
runCmd('backend tsc --noEmit', 'npx', ['tsc', '--noEmit'], path.join(root, 'backend'));
// 单元测试（纯函数，不连库不起服务，CI 可跑）
runCmd('backend vitest', 'npx', ['vitest', 'run'], path.join(root, 'backend'));
runCmd('frontend vitest', 'npx', ['vitest', 'run'], path.join(root, 'frontend'));

// ESM 产物校验只在已构建时有意义（校验的是 backend/dist）
if (fs.existsSync(path.join(root, 'backend/dist'))) {
  runNode('verify-esm-build.js');
} else {
  skip('verify-esm-build.js', '未发现 backend/dist，先跑 npm run build:backend');
}

if (STATIC_ONLY) {
  console.log('\n=== 全链路回归结束（--static） ===');
  summary.forEach((s) => console.log('  ' + s));
  console.log(failed ? '结果: ' + failed + ' 项失败' : '结果: 全部通过');
  process.exit(failed ? 1 : 0);
}

// ---------- C 段：运行时回归 ----------
console.log('\n########## C 段：运行时回归（需先启动 npm run dev） ##########');
nodeTests.forEach(runNode);

for (const t of tsTests) {
  console.log('\n---------- 运行 ' + t + '（tsx） ----------');
  const r = spawnSync('npx', ['tsx', path.join('..', 'scripts', t)], {
    cwd: path.join(root, 'backend'), stdio: 'inherit', shell: true,
  });
  report(t, r.status);
}

// test-api.sh：找到 bash 才跑，找不到则显式跳过（不计失败）
const bash = bashCandidates.find((p) => fs.existsSync(p));
if (bash) {
  console.log('\n---------- 运行 test-api.sh（bash） ----------');
  const r = spawnSync(bash, ['./test-api.sh'], { cwd: root, stdio: 'inherit' });
  report('test-api.sh', r.status);
} else {
  skip('test-api.sh', '未找到 Git Bash');
}

console.log('\n=== 全链路回归结束 ===');
summary.forEach((s) => console.log('  ' + s));
console.log(failed ? '结果: ' + failed + ' 项失败' : '结果: 全部通过');
process.exit(failed ? 1 : 0);
