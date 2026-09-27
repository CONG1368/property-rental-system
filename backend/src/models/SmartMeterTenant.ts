import { DataTypes, Optional } from 'sequelize';
import { BaseModel } from './BaseModel.js';
import { sequelize } from '../config/database.js';
interface SmartMeterTenantAttributes {
  id: number; platformId: string; name: string; phone: string; balance: number;
  deviceCount: number; status: string; lastSyncAt: Date | null; createdAt?: Date; updatedAt?: Date;
}
type Creation = Optional<SmartMeterTenantAttributes, 'id' | 'createdAt' | 'updatedAt'>;
class SmartMeterTenant extends BaseModel<SmartMeterTenantAttributes, Creation> {}
SmartMeterTenant.init({
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  platformId: { type: DataTypes.STRING(64), allowNull: false, unique: true },
  name: { type: DataTypes.STRING(80), defaultValue: '' }, phone: { type: DataTypes.STRING(30), defaultValue: '' },
  balance: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 }, deviceCount: { type: DataTypes.INTEGER, defaultValue: 0 },
  status: { type: DataTypes.STRING(30), defaultValue: '' }, lastSyncAt: { type: DataTypes.DATE, allowNull: true },
}, { sequelize, tableName: 'smart_meter_tenants', indexes: [{ fields: ['phone'] }] });
export default SmartMeterTenant;
