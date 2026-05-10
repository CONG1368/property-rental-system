import { Sequelize } from 'sequelize';
import { config } from './index';

export const sequelize = new Sequelize({
  host: config.db.host,
  port: config.db.port,
  database: config.db.database,
  username: config.db.username,
  password: config.db.password,
  dialect: config.db.dialect,
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
  await sequelize.authenticate();
  console.log('Database connected successfully.');
}
