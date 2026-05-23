/**
 * 构建后验证 — 检查所有编译产物的 ESM import 路径是否有效
 * 用法: node scripts/verify-esm-build.js
 */
const fs = require('fs');
const path = require('path');

const distDir = path.resolve(__dirname, '../backend/dist');

if (!fs.existsSync(distDir)) {
  console.error('[Verify] 错误: backend/dist/ 目录不存在，请先运行 tsc 编译');
  process.exit(1);
}

function findAllJsFiles(dir) {
  const result = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules') {
      result.push(...findAllJsFiles(full));
    } else if (entry.name.endsWith('.js')) {
      result.push(full);
    }
  }
  return result;
}

// 匹配 import ... from './relative' 或 import('./relative') 中的相对路径
const importPattern = /(?:from\s+['"]|import\(['"])(\.\.?\/[^'"]+)(?:['"])/g;

const allFiles = findAllJsFiles(distDir);
let warnings = 0;

for (const filePath of allFiles) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const fileDir = path.dirname(filePath);

  let match;
  while ((match = importPattern.exec(content)) !== null) {
    const importPath = match[1];
    const relative = path.relative(distDir, filePath);

    // 尝试多种可能的文件扩展名
    const candidates = [
      path.resolve(fileDir, importPath),
      path.resolve(fileDir, importPath + '.js'),
      path.resolve(fileDir, importPath, 'index.js'),
    ];

    const found = candidates.some(c => fs.existsSync(c));
    if (!found) {
      console.warn(`[Verify] 警告: ${relative} → ${importPath} (目标不存在)`);
      warnings++;
    }
  }
}

const totalFiles = allFiles.length;
console.log(`[Verify] 扫描 ${totalFiles} 个文件`);

if (warnings > 0) {
  console.warn(`[Verify] ${warnings} 个 import 路径无法解析 — 建议检查但构建可继续`);
} else {
  console.log('[Verify] 所有 ESM import 路径均有效');
}
