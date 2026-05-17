import { DataTypes, Optional } from 'sequelize';
import { BaseModel } from './BaseModel.js';
import { sequelize } from '../config/database.js';

interface DoorLockKeyAttributes {
  id: number; lockId: number; keyCode: string;
  keyStatus: '在库' | '借出' | '丢失' | '作废';
  holderType: '管理员' | '租客' | '保洁' | '维修' | '中介' | '';
  holderName: string | null; holderPhone: string | null;
  lendTime: Date | null; returnTime: Date | null;
  expectedReturnTime: Date | null; lendReason: string | null;
  createdBy: number | null;
  createdAt?: Date; updatedAt?: Date;
}

type DLKCreation = Optional<DoorLockKeyAttributes, 'id' | 'createdAt' | 'updatedAt'>;

class DoorLockKey extends BaseModel<DoorLockKeyAttributes, DLKCreation> {}

DoorLockKey.init({
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  lockId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  keyCode: { type: DataTypes.STRING(50), allowNull: false },
  keyStatus: { type: DataTypes.ENUM('在库', '借出', '丢失', '作废'), defaultValue: '在库' },
  holderType: { type: DataTypes.ENUM('管理员', '租客', '保洁', '维修', '中介', ''), defaultValue: '' },
  holderName: { type: DataTypes.STRING(50), allowNull: true },
  holderPhone: { type: DataTypes.STRING(20), allowNull: true },
  lendTime: { type: DataTypes.DATE, allowNull: true },
  returnTime: { type: DataTypes.DATE, allowNull: true },
  expectedReturnTime: { type: DataTypes.DATE, allowNull: true },
  lendReason: { type: DataTypes.STRING(200), allowNull: true },
  createdBy: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
}, {
  sequelize, tableName: 'door_lock_keys',
  indexes: [
    { fields: ['lockId'] }, { fields: ['keyStatus'] }, { fields: ['keyCode'] },
  ],
});

export default DoorLockKey;
