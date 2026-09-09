/**
 * 房源楼栋/楼层信息回填脚本（幂等，可重复运行）。
 *
 * 用途：
 *   对 buildingName 为空的存量房源，从房源名提取「楼栋」（优先按数字房号规则严格解析，
 *   解析不出则宽松剥离尾缀提取楼栋）；对 floor 为空的房源从名字提取楼层（厂房无房号，
 *   但需显示租户租的是哪一层）。
 *
 * 约束：
 *   - 只填「楼栋」「楼层」两个字段；「房号」不自动生成（由用户表格/表单输入提供）。
 *   - 不覆盖已填值（buildingName/floor 有值则跳过）；软删除(deletedAt)记录跳过。
 *   - 幂等：已填充的记录再次运行不会重复处理。
 *
 * 运行：
 *   cd backend && npx tsx ../scripts/backfill-property-building.ts            # 默认开发库
 *   cd backend && npx tsx ../scripts/backfill-property-building.ts D:/path/database.sqlite   # 指定库
 *
 * 输出：统计「解析出楼栋/楼层」的行数与明细。
 */
import path from 'path';
import fs from 'fs';
import { createRequire } from 'module';

// better-sqlite3 在 backend/node_modules，运行脚本时 cwd 应为 backend
const require = createRequire(path.join(process.cwd(), 'package.json'));

// 目标库文件（默认 backend/data/database.sqlite；可用参数覆盖）
const dbFile = process.argv[2] || path.join(process.cwd(), 'data', 'database.sqlite');
if (!fs.existsSync(dbFile)) {
  console.error('[回填] 数据库文件不存在: ' + dbFile);
  console.error('   用法: npx tsx ../scripts/backfill-property-building.ts [sqlite路径]');
  process.exit(1);
}

const Database = require('better-sqlite3');
const db = new Database(dbFile);

// 严格数字房号解析（与 migration/路由一致）
function parseRoomNumberFromName(name: string): { buildingName: string; roomNumber: string } {
  const n = String(name || '').trim();
  if (!n) return { buildingName: '', roomNumber: '' };
  const floorBased = n.match(/^(.*?)(\d+F-\d+)$/);
  if (floorBased) return { buildingName: floorBased[1], roomNumber: floorBased[2] };
  const sequential = n.match(/^(.*?)(\d+)$/);
  if (sequential) return { buildingName: sequential[1], roomNumber: sequential[2] };
  return { buildingName: '', roomNumber: '' };
}

// 宽松楼栋提取：剥离用途/楼层/号厂房/房号尾缀
function extractBuilding(name: string): string {
  const n = String(name || '').trim();
  if (!n) return '';
  let s = n;
  s = s.replace(/[-—]+\S+$/, '');
  s = s.replace(/(\d+F-\d+)$/, '');
  s = s.replace(/(\d+层|首层|[\d一二三四五六七八九十]+号厂房?|\d+号厂房?|[\d一二三四五六七八九十]+层)$/, '');
  s = s.replace(/(\d+F)$/, '');
  s = s.replace(/(\d+)$/, '');
  return s.trim();
}

function extractFloor(name: string, existingFloor: string): string {
  if (String(existingFloor || '').trim()) return existingFloor;
  const n = String(name || '').trim();
  if (n.includes('首层')) return '首层';
  const m = n.match(/(\d+层|[\d一二三四五六七八九十]+层)/);
  return m ? m[1] : '';
}

const rows = db.prepare("SELECT id, name, buildingName, roomNumber, floor FROM properties WHERE ((buildingName IS NULL OR buildingName = '') OR (floor IS NULL OR floor = '')) AND deletedAt IS NULL").all() as any[];
console.log('[回填] 待处理记录数: ' + rows.length + '（库: ' + dbFile + '）');

let updatedBuilding = 0;
let updatedFloor = 0;
const log: string[] = [];

for (const row of rows) {
  const name = String(row.name || '').trim();
  if (!name) continue;
  // 防御：跳过自动化回归/测试残留命名（只可能在开发库出现，实际业务库不会有）
  if (/^(Test-Prop|CT-Prop)/i.test(name)) continue;

  // 楼栋：优先严格解析，其次宽松提取，再次保留原值
  let buildingName = String(row.buildingName || '').trim();
  const strict = parseRoomNumberFromName(name);
  const loose = extractBuilding(name);
  if (!buildingName) {
    buildingName = strict.buildingName || loose;
  }

  // 楼层：已有则不覆盖，否则从名字提取
  let floor = String(row.floor || '').trim();
  if (!floor) floor = extractFloor(name, row.floor);

  const set: Record<string, string> = {};
  if (buildingName && buildingName !== String(row.buildingName || '').trim()) {
    set.buildingName = buildingName;
    updatedBuilding++;
  }
  if (floor && floor !== String(row.floor || '').trim()) {
    set.floor = floor;
    updatedFloor++;
  }

  if (Object.keys(set).length > 0) {
    db.prepare("UPDATE properties SET buildingName = ?, floor = ? WHERE id = ?").run(set.buildingName ?? String(row.buildingName||'').trim(), set.floor ?? String(row.floor||'').trim(), row.id);
    log.push("id=" + row.id + " name=\"" + name + "\" -> 楼栋\"" + (set.buildingName || '') + "\" 楼层\"" + (set.floor || '') + "\"");
  }
}

console.log('[回填] 楼栋更新: ' + updatedBuilding + ' 条，楼层更新: ' + updatedFloor + ' 条');
if (log.length) {
  console.log('[回填] 明细:');
  for (const l of log) console.log('  ' + l);
} else {
  console.log('[回填] 无需更新（已有楼栋/楼层的记录均已填写）。');
}

db.close();
console.log('[回填] 完成。');