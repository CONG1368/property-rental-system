import { DataTypes, Optional } from 'sequelize';
import { BaseModel } from './BaseModel.js';
import { sequelize } from '../config/database.js';

interface DoorLockAttributes {
  id: number; propertyId: number; name: string;
  category: '智能门锁' | '传统门锁';
  lockType: string; manufacturer: string; model: string;
  sn: string; installDate: Date | null; status: string;
  // 智能门锁专属
  deviceId: string | null; battery: number | null;
  firmwareVersion: string | null; ipAddress: string | null;
  lastOnlineAt: Date | null;
  // 传统门锁专属
  lockCylinder: string | null; material: string | null;
  keyType: string | null; totalKeyCount: number;
  notes: string | null; deletedAt: Date | null;
  createdAt?: Date; updatedAt?: Date;
}

type DoorLockCreation = Optional<DoorLockAttributes, 'id' | 'createdAt' | 'updatedAt'>;

class DoorLock extends BaseModel<DoorLockAttributes, DoorLockCreation> {}

DoorLock.init({
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  propertyId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  name: { type: DataTypes.STRING(100), allowNull: false },
  category: { type: DataTypes.ENUM('智能门锁', '传统门锁'), allowNull: false },
  lockType: { type: DataTypes.STRING(50), defaultValue: '' },
  manufacturer: { type: DataTypes.STRING(50), defaultValue: '' },
  model: { type: DataTypes.STRING(50), defaultValue: '' },
  sn: { type: DataTypes.STRING(100), defaultValue: '' },
  installDate: { type: DataTypes.DATEONLY, allowNull: true },
  status: { type: DataTypes.STRING(50), defaultValue: '正常' },
  deviceId: { type: DataTypes.STRING(100), allowNull: true },
  battery: { type: DataTypes.INTEGER, allowNull: true },
  firmwareVersion: { type: DataTypes.STRING(20), allowNull: true },
  ipAddress: { type: DataTypes.STRING(45), allowNull: true },
  lastOnlineAt: { type: DataTypes.DATE, allowNull: true },
  lockCylinder: { type: DataTypes.STRING(50), allowNull: true },
  material: { type: DataTypes.STRING(50), allowNull: true },
  keyType: { type: DataTypes.STRING(50), allowNull: true },
  totalKeyCount: { type: DataTypes.INTEGER, defaultValue: 0 },
  notes: { type: DataTypes.TEXT, allowNull: true },
  deletedAt: { type: DataTypes.DATE, allowNull: true },
}, {
  sequelize, tableName: 'door_locks', paranoid: true, deletedAt: 'deletedAt',
  indexes: [
    { fields: ['propertyId'] }, { fields: ['category'] },
    { fields: ['status'] }, { fields: ['name'] },
  ],
});

export default DoorLock;
