import { DataTypes, Optional } from 'sequelize';
import { BaseModel } from './BaseModel.js';
import { sequelize } from '../config/database.js';

interface RolePermissionAttributes {
  id: number; role: string; module: string; actions: string[];
  createdAt?: Date; updatedAt?: Date;
}
type RPCreation = Optional<RolePermissionAttributes, 'id' | 'createdAt' | 'updatedAt'>;
class RolePermission extends BaseModel<RolePermissionAttributes, RPCreation> {}
RolePermission.init({
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  role: { type: DataTypes.STRING(50), allowNull: false },
  module: { type: DataTypes.STRING(50), allowNull: false },
  actions: { type: DataTypes.JSON, defaultValue: [] },
}, { sequelize, tableName: 'role_permissions', indexes: [{ unique: true, fields: ['role', 'module'] }] });
export default RolePermission;
