const { spawnSync } = require('child_process');
const path = require('path');
const root = path.resolve(__dirname, '..');

// 需要 dev 服务在跑的浏览器/接口回归
const nodeTests = [
  'full-e2e-test.js',
  'e2e-newmodules-regression.js',
  'verify-dashboard.js',
  'verify-system-settings.js',
  'verify-ux-states.cjs',
];
// 纯静态门禁（无需 dev 服务）
const staticTests = ['check-contrast.cjs'];
// TypeScript 脚本（用 backend 的 tsx 运行）
const tsTests = ['verify-external-providers.ts'];

console.log('=== 全量回归开始 ===');
let failed = 0;

function report(name, status) {
  if (status !== 0) { failed++; console.log('✗ ' + name + ' 失败'); }
  else { console.log('√ ' + name + ' 通过'); }
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

console.log('\n=== 全量回归结束: ' + (failed ? failed + ' 个失败' : '全部通过') + ' ===');
process.exit(failed ? 1 : 0);
