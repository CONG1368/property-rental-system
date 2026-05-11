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
    storage: path.join(__dirname, '../../data/database.sqlite'),
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
    accessExpiry: '4h',
    refreshExpiry: '7d',
  },

  upload: {
    dir: path.join(__dirname, '../../uploads'),
    maxSize: 10 * 1024 * 1024,
    allowedTypes: [
      'image/jpeg', 'image/png', 'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ],
  },
};
