import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

interface AuditLogAttributes {
  id: number; userId: number; action: string; module: string;
  targetType: string; targetId: string; detail: string; ip: string;
  createdAt?: Date;
}
type ALCreation = Optional<AuditLogAttributes, 'id'|'createdAt'>;
class AuditLog extends Model<AuditLogAttributes, ALCreation> implements AuditLogAttributes {
  public id!: number; public userId!: number; public action!: string;
  public module!: string; public targetType!: string; public targetId!: string;
  public detail!: string; public ip!: string;
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
