/**
 * 构建期生成 backend/src/build-version.ts —— 把根 package.json 的版本号烘进后端编译产物。
 *
 * 为什么不能运行时读：生产打包后后端跑在 app.asar 里，package.json 被归档后
 * fs.readFileSync 读不到（asar 不是普通目录），导致 /overview 版本恒为"未知"。
 */
const fs = require('fs');
const path = require('path');

// 脚本位于 scripts/，项目根 = 上一级（scripts -> 仓库根）
const root = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf-8'));
const version = pkg.version || '0.0.0';

const content = [
  '/**',
  ' * 构建期注入：根 package.json 的版本号（由 scripts/gen-build-version.cjs 生成，勿手改）',
  ' */',
  "export const BUILD_VERSION = '" + version + "';",
  '',
].join('\n');

const target = path.join(root, 'backend', 'src', 'build-version.ts');
fs.writeFileSync(target, content, 'utf-8');
console.log('[gen-version] BUILD_VERSION=' + version + ' -> ' + path.relative(root, target));
