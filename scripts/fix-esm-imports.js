/**
 * 批量修复 ESM 导入路径 — 给缺少后缀的本地导入加上 .js 或 /index.js
 * 用法: node scripts/fix-esm-imports.js
 */
const fs = require('fs');
const path = require('path');

const srcDir = path.resolve(__dirname, '../backend/src');

function findAllTsFiles(dir) {
  const result = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      result.push(...findAllTsFiles(full));
    } else if (entry.name.endsWith('.ts')) {
      result.push(full);
    }
  }
  return result;
}

function resolveImportPath(importPath, currentFileDir) {
  // 去掉可能的 .js 或 .ts 后缀来分析
  let clean = importPath;
  if (clean.endsWith('.js')) clean = clean.slice(0, -3);
  if (clean.endsWith('.ts')) clean = clean.slice(0, -3);

  const target = path.resolve(currentFileDir, clean);

  // 情况1: 有对应的 .ts 文件
  if (fs.existsSync(target + '.ts')) {
    return importPath.endsWith('.js') ? null : (clean + '.js'); // 已经是.js就跳过
  }

  // 情况2: 是目录，有 index.ts
  if (fs.existsSync(path.join(target, 'index.ts'))) {
    const expected = clean + '/index.js';
    return importPath === expected ? null : expected;
  }

  // 情况3: 已经正确（有.js后缀且文件存在）
  if (importPath.endsWith('.js') && fs.existsSync(path.resolve(currentFileDir, importPath))) {
    return null;
  }

  console.warn(`  [WARN] 无法解析: ${importPath} (from ${currentFileDir})`);
  return null;
}

const allFiles = findAllTsFiles(srcDir);
let fixedCount = 0;
let fileCount = 0;

for (const filePath of allFiles) {
  let content = fs.readFileSync(filePath, 'utf-8');
  const currentFileDir = path.dirname(filePath);
  let changed = false;

  // 匹配所有本地导入: from './xxx' 或 from '../xxx' 或 require('./xxx')
  const importRegex = /(from\s+['"])(\.\.?\/[^'"]+)(['"])/g;

  content = content.replace(importRegex, (match, prefix, importPath, suffix) => {
    const resolved = resolveImportPath(importPath, currentFileDir);
    if (resolved && resolved !== importPath) {
      changed = true;
      return prefix + resolved + suffix;
    }
    return match;
  });

  if (changed) {
    fs.writeFileSync(filePath, content, 'utf-8');
    fixedCount++;
    const rel = path.relative(srcDir, filePath);
    console.log(`[FIXED] ${rel}`);
  }
  fileCount++;
}

console.log(`\n扫描文件: ${fileCount}  修复文件: ${fixedCount}`);
