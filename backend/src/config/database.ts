import { Sequelize } from 'sequelize';
import mysql2 from 'mysql2/promise';
import { config } from './index.js';

export const sequelize = new Sequelize({
  host: config.db.host,
  port: config.db.port,
  database: config.db.database,
  username: config.db.username,
  password: config.db.password,
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
  pool: {
    max: 10,
    min: 2,
    acquire: 30000,
    idle: 10000,
  },
  retry: {
    max: 5,
    match: ['ECONNREFUSED', 'ER_ACCESS_DENIED_ERROR', 'ENOTFOUND'],
  },
});

async function ensureDatabase(): Promise<void> {
  let conn;
  try {
    conn = await mysql2.createConnection({
      host: config.db.host,
      port: config.db.port,
      user: config.db.username,
      password: config.db.password,
      connectTimeout: 5000,
    });
    await conn.query(
      `CREATE DATABASE IF NOT EXISTS \`${config.db.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    console.log(`[DB] Database '${config.db.database}' ready`);
  } catch (err: any) {
    if (err.code === 'ECONNREFUSED') {
      console.error('[DB] Cannot connect to MySQL. Please start MySQL service first:');
      console.error('     net start MySQL80   (or MySQL)');
    } else if (err.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('[DB] MySQL access denied. Check DB_USER/DB_PASSWORD in .env file');
    } else {
      console.error('[DB] MySQL error:', err.message);
    }
    throw err;
  } finally {
    if (conn) await conn.end().catch(() => {});
  }
}

export async function connectDatabase(): Promise<void> {
  await ensureDatabase();

  for (let i = 0; i < 5; i++) {
    try {
      await sequelize.authenticate();
      console.log('[DB] Connected to MySQL successfully');
      return;
    } catch (err: any) {
      if (i < 4) {
        console.log(`[DB] Retrying connection (${i + 1}/5)...`);
        await new Promise(r => setTimeout(r, 2000));
      } else {
        console.error('[DB] Failed to connect after 5 retries');
        throw err;
      }
    }
  }
}

export async function initAdminUser(): Promise<void> {
  try {
    const bcrypt = await import('bcryptjs');
    const UserModule = await import('../models/User.js');
    const User = UserModule.default;
    const existing = await User.findOne({ where: { username: 'admin' } });
    if (!existing) {
      const passwordHash = await bcrypt.default.hash('admin123', 12);
      await User.create({
        username: 'admin',
        passwordHash,
        displayName: '系统管理员',
        role: '管理员',
        permissions: {},
        status: '正常',
      });
      console.log('[DB] Default admin user created (admin / admin123)');
    }
  } catch (err: any) {
    console.error('[DB] Failed to init admin user:', err.message);
  }
}
