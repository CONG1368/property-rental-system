const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');

// ============================================================
// 全链路回归入口
// 前置条件：先启动 npm run dev（前端 5173 + 后端 3001）
// 顺序要求：permission-regression 必须在 e2e-permission-matrix 之前，
//          因为后者会写入角色权限定制，影响前者的基线断言
// ============================================================

// 纯静态门禁（无需 dev 服务）
const staticTests = ['check-contrast.cjs'];

// 需要 dev 服务的 Node 脚本（按依赖顺序串行）
const nodeTests = [
  'full-e2e-test.js',
  'e2e-newmodules-regression.js',
  'e2e-new-modules.js',
  'verify-dashboard.js',
  'verify-system-settings.js',
  'verify-ux-states.cjs',
  'permission-regression.js',
  'e2e-permission-matrix.js',
  'e2e-confirm-password.js',
];

// TypeScript 脚本（用 backend 的 tsx 运行）
const tsTests = ['verify-external-providers.ts'];

// bash 脚本（后端 API 全量测试，需要 bash + curl）
const bashCandidates = [
  'C:\\Program Files\\Git\\bin\\bash.exe',
  'C:\\Program Files (x86)\\Git\\bin\\bash.exe',
];

console.log('=== 全链路回归开始 ===');
let failed = 0;
const summary = [];

function report(name, status) {
  const ok = status === 0;
  if (!ok) failed++;
  summary.push((ok ? '√ ' : '× ') + name);
  console.log((ok ? '√ ' : '× ') + name + (ok ? ' 通过' : ' 失败'));
}

for (const t of [...staticTests, ...nodeTests]) {
  console.log('\n---------- 运行 ' + t + ' ----------');
  const r = spawnSync(process.execPath, [path.join('scripts', t)], { cwd: root, stdio: 'inherit' });
  report(t, r.status);
}

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
  console.log('\n---------- 跳过 test-api.sh（未找到 Git Bash） ----------');
  summary.push('- test-api.sh 跳过（未找到 bash）');
}

console.log('\n=== 全链路回归结束 ===');
summary.forEach((s) => console.log('  ' + s));
console.log(failed ? '结果: ' + failed + ' 项失败' : '结果: 全部通过');
process.exit(failed ? 1 : 0);
