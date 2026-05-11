import { Sequelize } from 'sequelize';
import mysql2 from 'mysql2/promise';
import { config } from './index';

export const sequelize = new Sequelize({
  host: config.db.host,
  port: config.db.port,
  database: config.db.database,
  username: config.db.username,
  password: config.db.password,
  dialect: 'mysql',
  logging: config.db.logging ? console.log : false,
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
});

export async function connectDatabase(): Promise<void> {
  // First connect without database to create it if needed
  try {
    const conn = await mysql2.createConnection({
      host: config.db.host,
      port: config.db.port,
      user: config.db.username,
      password: config.db.password,
    });
    await conn.query(
      `CREATE DATABASE IF NOT EXISTS \`${config.db.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    console.log(`Database '${config.db.database}' ensured.`);
    await conn.end();
  } catch (err: any) {
    console.error('Failed to ensure database exists:', err.message);
    throw err;
  }

  // Now connect with the target database
  await sequelize.authenticate();
  console.log('Database connected successfully.');
}

export async function initAdminUser(): Promise<void> {
  try {
    const bcrypt = require('bcryptjs');
    const User = (await import('../models/User')).default;
    const existing = await User.findOne({ where: { username: 'admin' } });
    if (!existing) {
      const passwordHash = await bcrypt.hash('admin123', 12);
      await User.create({
        username: 'admin',
        passwordHash,
        displayName: '系统管理员',
        role: '管理员',
        permissions: {},
        status: '正常',
      });
      console.log('Default admin user created (admin / admin123)');
    }
  } catch (err: any) {
    console.error('Failed to init admin user:', err.message);
  }
}
