const { spawnSync } = require('child_process');
const path = require('path');
const root = path.resolve(__dirname, '..');
const tests = ['full-e2e-test.js', 'e2e-newmodules-regression.js'];
console.log('=== 全量回归开始 ===');
let failed = 0;
for (const t of tests) {
  console.log('\n---------- 运行 ' + t + ' ----------');
  const r = spawnSync(process.execPath, [path.join('scripts', t)], { cwd: root, stdio: 'inherit' });
  if (r.status !== 0) { failed++; console.log('✗ ' + t + ' 失败'); } else { console.log('✓ ' + t + ' 通过'); }
}
console.log('\n=== 全量回归结束: ' + (failed ? failed + ' 个失败' : '全部通过') + ' ===');
process.exit(failed ? 1 : 0);
