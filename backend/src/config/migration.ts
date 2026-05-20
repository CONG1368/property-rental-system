import { sequelize } from './database.js';
import { config } from './index.js';

interface ColumnMigration {
  tableName: string;
  columns: {
    name: string;
    sqliteType: string;
    defaultValue: string;
  }[];
}

const MIGRATION_DEFINITIONS: ColumnMigration[] = [
  {
    tableName: 'bills',
    columns: [
      { name: 'periodMonths', sqliteType: 'INTEGER', defaultValue: '1' },
    ],
  },
  {
    tableName: 'contracts',
    columns: [
      { name: 'clauses', sqliteType: 'TEXT', defaultValue: "'[]'" },
    ],
  },
  {
    tableName: 'properties',
    columns: [
      { name: 'buildingName', sqliteType: 'VARCHAR(50)', defaultValue: "''" },
      { name: 'roomNumber', sqliteType: 'VARCHAR(20)', defaultValue: "''" },
      { name: 'buildingOrder', sqliteType: 'INTEGER', defaultValue: '0' },
      { name: 'floorOrder', sqliteType: 'INTEGER', defaultValue: '0' },
    ],
  },
  {
    tableName: 'tenants',
    columns: [
      { name: 'gender', sqliteType: 'VARCHAR(10)', defaultValue: "''" },
      { name: 'birthDate', sqliteType: 'VARCHAR(10)', defaultValue: "''" },
      { name: 'ethnicity', sqliteType: 'VARCHAR(20)', defaultValue: "''" },
      { name: 'idAddress', sqliteType: 'VARCHAR(200)', defaultValue: "''" },
      { name: 'idIssuingAuthority', sqliteType: 'VARCHAR(100)', defaultValue: "''" },
      { name: 'idValidFrom', sqliteType: 'VARCHAR(10)', defaultValue: "''" },
      { name: 'idValidTo', sqliteType: 'VARCHAR(10)', defaultValue: "''" },
      { name: 'idPhoto', sqliteType: 'TEXT', defaultValue: "''" },
    ],
  },
];

async function checkTableExists(tableName: string): Promise<boolean> {
  const dialect = sequelize.getDialect();
  if (dialect === 'sqlite') {
    const [rows] = await sequelize.query(
      `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
      { replacements: [tableName] }
    );
    return (rows as any[]).length > 0;
  }
  const [rows] = await sequelize.query(
    `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_NAME=? AND TABLE_SCHEMA=?`,
    { replacements: [tableName, (config.db as any).database] }
  );
  return (rows as any[]).length > 0;
}

async function addColumnIfNotExists(
  tableName: string,
  columnName: string,
  sqliteType: string,
  defaultValue: string
): Promise<boolean> {
  const dialect = sequelize.getDialect();

  if (dialect === 'sqlite') {
    // PRAGMA table_info 检查列是否已存在
    const [columns] = await sequelize.query(`PRAGMA table_info(${tableName})`);
    const exists = (columns as any[]).some((col: any) => col.name === columnName);
    if (exists) return false;

    await sequelize.query(
      `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${sqliteType} DEFAULT ${defaultValue}`
    );
    return true;
  }

  // MySQL: 直接尝试，失败则忽略重复列错误
  try {
    await sequelize.query(
      `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${sqliteType} DEFAULT ${defaultValue}`
    );
    return true;
  } catch (e: any) {
    if (e.message?.includes('Duplicate column') || e.message?.includes('already exists')) {
      return false;
    }
    throw e;
  }
}

/**
 * 数据回填：为已有房源从 name 字段解析出 buildingName 和 roomNumber
 * 仅处理 buildingName 为空的记录，避免覆盖已设置的值
 */
async function backfillPropertyRoomInfo(): Promise<void> {
  try {
    const tableExists = await checkTableExists('properties');
    if (!tableExists) return;

    // 查询 buildingName 为空但 name 不为空的房源
    const [emptyRows] = await sequelize.query(
      `SELECT id, name, floor FROM properties WHERE (buildingName IS NULL OR buildingName = '') AND name IS NOT NULL AND name != '' AND deletedAt IS NULL`
    );
    const rows = emptyRows as any[];
    if (!rows || rows.length === 0) return;

    let updated = 0;
    for (const row of rows) {
      const name: string = row.name || '';
      let buildingName = '';
      let roomNumber = '';

      // 模式1：楼层命名法 — 名称以 XF-YY 结尾（如 "万象汇商铺1F-08"）
      const floorBasedMatch = name.match(/^(.*?)(\d+F-\d+)$/);
      if (floorBasedMatch) {
        buildingName = floorBasedMatch[1];
        roomNumber = floorBasedMatch[2];
      } else {
        // 模式2：顺次命名法 — 名称以纯数字结尾（如 "翡翠湾A座201"、"翡翠湾B座1503"）
        const sequentialMatch = name.match(/^(.*?)(\d+)$/);
        if (sequentialMatch) {
          buildingName = sequentialMatch[1];
          roomNumber = sequentialMatch[2];
        }
      }

      if (buildingName || roomNumber) {
        await sequelize.query(
          `UPDATE properties SET buildingName = ?, roomNumber = ? WHERE id = ?`,
          { replacements: [buildingName, roomNumber, row.id] }
        );
        updated++;
      }
    }

    if (updated > 0) {
      console.log(`[Migration] ✓ 回填 ${updated} 间房源的楼栋/房号信息`);
    }
  } catch (err: any) {
    console.error(`[Migration] ✗ 回填楼栋/房号信息失败: ${err.message}`);
  }
}

export async function runAllMigrations(): Promise<void> {
  console.log('[Migration] 检查数据库 Schema...');

  let appliedTotal = 0;
  let skippedTotal = 0;

  for (const migration of MIGRATION_DEFINITIONS) {
    // 检查表是否存在（新表由 sync 创建，这里跳过）
    const tableExists = await checkTableExists(migration.tableName);
    if (!tableExists) {
      console.log(`[Migration] 表 ${migration.tableName} 尚不存在，将由 sync() 创建`);
      continue;
    }

    for (const col of migration.columns) {
      try {
        const applied = await addColumnIfNotExists(
          migration.tableName,
          col.name,
          col.sqliteType,
          col.defaultValue
        );
        if (applied) {
          appliedTotal++;
          console.log(`[Migration] ✓ 添加列 ${migration.tableName}.${col.name}`);
        } else {
          skippedTotal++;
        }
      } catch (err: any) {
        console.error(`[Migration] ✗ 添加列 ${migration.tableName}.${col.name} 失败: ${err.message}`);
      }
    }
  }

  console.log(`[Migration] 完成 — 新增 ${appliedTotal} 列，跳过 ${skippedTotal} 列（已存在）`);

  // 数据回填：为已有房源补充 buildingName / roomNumber（从 name 字段解析）
  await backfillPropertyRoomInfo();
}
