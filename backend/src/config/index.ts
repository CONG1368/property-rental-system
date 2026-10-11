import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../.env') });

const dbDialect = (process.env.DB_DIALECT || 'sqlite') as 'sqlite' | 'mysql';

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),

  // 数据库：默认 SQLite（零配置），可选 MySQL
  db: dbDialect === 'mysql' ? {
    dialect: 'mysql' as const,
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    database: process.env.DB_NAME || 'property_rental',
    username: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    logging: false,
  } : {
    dialect: 'sqlite' as const,
    storage: process.env.DB_STORAGE || path.join(__dirname, '../../data/database.sqlite'),
    logging: false,
  },

  // Redis：可选，不可用时退化
  redis: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    enabled: process.env.REDIS_ENABLED !== 'false',
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'property-rental-jwt-secret-key-2026',
    // 有效期可由 .env 覆盖（审计第 7 项：原先写死 4 小时 / 7 天），单位：秒
    accessExpiry: parseInt(process.env.JWT_ACCESS_EXPIRES_SECONDS || '14400', 10),    // 默认 4 小时
    refreshExpiry: parseInt(process.env.JWT_REFRESH_EXPIRES_SECONDS || '604800', 10), // 默认 7 天
  },

  upload: {
    dir: process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads'),
    allowedTypes: [
      'image/jpeg', 'image/png', 'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ],
  },
};
