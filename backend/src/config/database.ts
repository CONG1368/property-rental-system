import { Sequelize } from 'sequelize';
import { config } from './index.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isSQLite = config.db.dialect === 'sqlite';

// SQLite: 确保 data 目录存在
if (isSQLite && config.db.storage) {
  const dir = path.dirname(config.db.storage);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export const sequelize = isSQLite
  ? new Sequelize({
      dialect: 'sqlite',
      storage: (config.db as any).storage,
      logging: false,
      define: {
        timestamps: true,
        underscored: false,
        paranoid: false,
      },
    })
  : new Sequelize({
      host: (config.db as any).host,
      port: (config.db as any).port,
      database: (config.db as any).database,
      username: (config.db as any).username,
      password: (config.db as any).password,
      dialect: 'mysql',
      logging: false,
      timezone: '+08:00',
      define: {
        charset: 'utf8mb4',
        collate: 'utf8mb4_unicode_ci',
        timestamps: true,
        underscored: false,
        paranoid: false,
      },
      pool: { max: 10, min: 2, acquire: 30000, idle: 10000 },
      retry: { max: 5, match: ['ECONNREFUSED', 'ER_ACCESS_DENIED_ERROR'] },
    });

export async function connectDatabase(): Promise<void> {
  if (isSQLite) {
    await sequelize.authenticate();
    console.log('[DB] SQLite connected');
    return;
  }

  // MySQL: ensure database exists
  try {
    const mysql2 = await import('mysql2/promise');
    const conn = await mysql2.default.createConnection({
      host: (config.db as any).host,
      port: (config.db as any).port,
      user: (config.db as any).username,
      password: (config.db as any).password,
      connectTimeout: 5000,
    });
    await conn.query(
      `CREATE DATABASE IF NOT EXISTS \`${(config.db as any).database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    console.log(`[DB] Database '${(config.db as any).database}' ready`);
    await conn.end();
  } catch (err: any) {
    if (err.code === 'ECONNREFUSED') {
      console.error('[DB] MySQL not running. Start it with: net start MySQL80');
    }
    throw err;
  }

  // Retry connection
  for (let i = 0; i < 5; i++) {
    try {
      await sequelize.authenticate();
      console.log('[DB] MySQL connected');
      return;
    } catch (err: any) {
      if (i < 4) {
        console.log(`[DB] Retrying connection (${i + 1}/5)...`);
        await new Promise(r => setTimeout(r, 2000));
      } else {
        throw err;
      }
    }
  }
}

export async function initAdminUser(): Promise<void> {
  try {
    const bcryptMod = await import('bcryptjs');
    const bcrypt = bcryptMod.default;
    const UserModule = await import('../models/User.js');
    const User = UserModule.default;
    const existing = await User.findOne({ where: { username: 'admin' } });
    if (!existing) {
      const hash = await bcrypt.hash('admin123', 12);
      await User.create({
        username: 'admin',
        passwordHash: hash,
        displayName: '系统管理员',
        role: '管理员',
        permissions: {},
        status: '正常',
      });
      console.log('[DB] Admin user created (admin / admin123)');
    }
  } catch (err: any) {
    console.error('[DB] Failed to init admin:', err.message);
  }
}
