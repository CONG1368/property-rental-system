import { DataTypes, Optional } from 'sequelize';
import { BaseModel } from './BaseModel.js';
import { sequelize } from '../config/database.js';
import bcrypt from 'bcryptjs';

interface UserAttributes {
  id: number; username: string; passwordHash: string; displayName: string;
  role: string; permissions: object; lastLogin: Date | null; status: string;
  createdAt: Date; updatedAt: Date;
}

type UserCreationAttributes = Optional<UserAttributes, 'id' | 'lastLogin' | 'createdAt' | 'updatedAt'>;

class User extends BaseModel<UserAttributes, UserCreationAttributes> {
  // 使用 get() 访问 Sequelize 属性，避免 declare 字段遮蔽
  getPasswordHash(): string { return this.get('passwordHash') as string; }

  async validatePassword(password: string): Promise<boolean> {
    const hash = this.getPasswordHash();
    if (!hash) return false;
    return bcrypt.compare(password, hash);
  }

  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
  }
}

User.init({
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  username: { type: DataTypes.STRING(50), allowNull: false, unique: true },
  passwordHash: { type: DataTypes.STRING(255), allowNull: false },
  displayName: { type: DataTypes.STRING(50), allowNull: false },
  role: { type: DataTypes.STRING(50), allowNull: false, defaultValue: '收租员' },
  permissions: { type: DataTypes.JSON, defaultValue: {} },
  lastLogin: { type: DataTypes.DATE, allowNull: true },
  status: { type: DataTypes.STRING(20), defaultValue: '正常' },
  createdAt: { type: DataTypes.DATE },
  updatedAt: { type: DataTypes.DATE },
}, { sequelize, tableName: 'users' });

export default User;
