import { DataTypes, Optional } from 'sequelize';
import { BaseModel } from './BaseModel.js';
import { sequelize } from '../config/database.js';

interface DoorLockPasswordAttributes {
  id: number; lockId: number; tenantId: number | null;
  password: string;
  passwordType: '永久' | '临时' | '一次性' | '周期';
  purpose: '入住' | '保洁' | '维修' | '访客' | '管理员';
  startTime: Date | null; endTime: Date | null;
  isActive: boolean; usedCount: number; maxUseCount: number;
  createdBy: number | null; notes: string | null;
  createdAt?: Date; updatedAt?: Date;
}

type DLPCreation = Optional<DoorLockPasswordAttributes, 'id' | 'createdAt' | 'updatedAt'>;

class DoorLockPassword extends BaseModel<DoorLockPasswordAttributes, DLPCreation> {}

DoorLockPassword.init({
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  lockId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  tenantId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  password: { type: DataTypes.STRING(20), allowNull: false },
  passwordType: { type: DataTypes.ENUM('永久', '临时', '一次性', '周期'), defaultValue: '临时' },
  purpose: { type: DataTypes.ENUM('入住', '保洁', '维修', '访客', '管理员'), defaultValue: '入住' },
  startTime: { type: DataTypes.DATE, allowNull: true },
  endTime: { type: DataTypes.DATE, allowNull: true },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
  usedCount: { type: DataTypes.INTEGER, defaultValue: 0 },
  maxUseCount: { type: DataTypes.INTEGER, defaultValue: 0 },
  createdBy: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  notes: { type: DataTypes.STRING(200), allowNull: true },
}, {
  sequelize, tableName: 'door_lock_passwords',
  indexes: [
    { fields: ['lockId'] }, { fields: ['tenantId'] },
    { fields: ['isActive'] }, { fields: ['endTime'] },
  ],
});

export default DoorLockPassword;
