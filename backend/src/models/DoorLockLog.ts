import { DataTypes, Optional } from 'sequelize';
import { BaseModel } from './BaseModel.js';
import { sequelize } from '../config/database.js';

interface DoorLockLogAttributes {
  id: number; lockId: number;
  operationType: string;
  operatorId: number | null; operatorName: string | null;
  operatorType: '系统' | '管理员' | '租客' | '保洁' | '维修' | '未知';
  result: '成功' | '失败'; detail: string | null;
  ipAddress: string | null; createdAt?: Date; updatedAt?: Date;
}

type DLLCreation = Optional<DoorLockLogAttributes, 'id' | 'createdAt' | 'updatedAt'>;

class DoorLockLog extends BaseModel<DoorLockLogAttributes, DLLCreation> {}

DoorLockLog.init({
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  lockId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  operationType: { type: DataTypes.STRING(50), allowNull: false },
  operatorId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  operatorName: { type: DataTypes.STRING(50), allowNull: true },
  operatorType: { type: DataTypes.ENUM('系统', '管理员', '租客', '保洁', '维修', '未知'), defaultValue: '未知' },
  result: { type: DataTypes.ENUM('成功', '失败'), defaultValue: '成功' },
  detail: { type: DataTypes.STRING(500), allowNull: true },
  ipAddress: { type: DataTypes.STRING(45), allowNull: true },
}, {
  sequelize, tableName: 'door_lock_logs',
  indexes: [
    { fields: ['lockId'] }, { fields: ['operationType'] }, { fields: ['createdAt'] },
  ],
});

export default DoorLockLog;
