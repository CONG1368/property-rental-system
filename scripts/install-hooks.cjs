/**
 * 安装本地 Git 门禁钩子：把 core.hooksPath 指向仓库内的 .githooks/
 * 用法：npm run hooks:install（postinstall 也会自动调用）
 * 设计：任何异常都只告警不失败——没有 .git 目录（如打包环境）或没有 git 命令时静默跳过
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

try {
  if (!fs.existsSync(path.join(root, '.git'))) {
    console.log('[hooks] 非 git 工作区，跳过钩子安装');
    process.exit(0);
  }
  execFileSync('git', ['config', 'core.hooksPath', '.githooks'], { cwd: root, stdio: 'pipe' });
  console.log('[hooks] 已启用本地门禁钩子：pre-commit（静态铁律+对比度）、pre-push（npm run test:static）');
  console.log('[hooks] 紧急绕过：git commit --no-verify / git push --no-verify（CI 仍会检查）');
} catch (err) {
  console.log('[hooks] 钩子安装跳过：' + (err && err.message ? String(err.message).slice(0, 120) : err));
}
process.exit(0);
