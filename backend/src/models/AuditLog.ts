import { DataTypes, Optional } from 'sequelize';
import { BaseModel } from './BaseModel.js';
import { sequelize } from '../config/database.js';

interface AuditLogAttributes {
  id: number; userId: number; action: string; module: string;
  targetType: string; targetId: string; detail: string; ip: string;
  createdAt?: Date;
}
type ALCreation = Optional<AuditLogAttributes, 'id'|'createdAt'>;
class AuditLog extends BaseModel<AuditLogAttributes, ALCreation> {
}
AuditLog.init({
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  userId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  action: { type: DataTypes.STRING(50), allowNull: false },
  module: { type: DataTypes.STRING(50), defaultValue: '' },
  targetType: { type: DataTypes.STRING(50), defaultValue: '' },
  targetId: { type: DataTypes.STRING(50), defaultValue: '' },
  detail: { type: DataTypes.TEXT, defaultValue: '' },
  ip: { type: DataTypes.STRING(50), defaultValue: '' },
}, { sequelize, tableName: 'audit_logs', updatedAt: false, indexes: [{fields:['userId']},{fields:['module']},{fields:['createdAt']}] });
export default AuditLog;
