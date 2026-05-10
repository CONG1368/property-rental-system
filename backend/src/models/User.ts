import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';
import bcrypt from 'bcryptjs';

interface UserAttributes {
  id: number; username: string; passwordHash: string; displayName: string;
  role: string; permissions: object; lastLogin: Date | null; status: string;
  createdAt?: Date; updatedAt?: Date;
}

type UserCreationAttributes = Optional<UserAttributes, 'id' | 'lastLogin' | 'createdAt' | 'updatedAt'>;

class User extends Model<UserAttributes, UserCreationAttributes> implements UserAttributes {
  public id!: number; public username!: string; public passwordHash!: string;
  public displayName!: string; public role!: string; public permissions!: object;
  public lastLogin!: Date | null; public status!: string;

  async validatePassword(password: string): Promise<boolean> {
    return bcrypt.compare(password, this.passwordHash);
  }

  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
  }
}

User.init({
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  username: { type: DataTypes.STRING(50), allowNull: false, unique: true },
  passwordHash: { type: DataTypes.STRING(255), allowNull: false },
  displayName: { type: DataTypes.STRING(50), allowNull: false },
  role: { type: DataTypes.ENUM('管理员','收租主管','收租员','财务主管','会计','出纳','合同主管','法务','总经理'), allowNull: false },
  permissions: { type: DataTypes.JSON, defaultValue: {} },
  lastLogin: { type: DataTypes.DATE, allowNull: true },
  status: { type: DataTypes.STRING(20), defaultValue: '正常' },
}, { sequelize, tableName: 'users' });

export default User;
