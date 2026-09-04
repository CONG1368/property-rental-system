import { DataTypes, Optional } from 'sequelize';
import { BaseModel } from './BaseModel.js';
import { sequelize } from '../config/database.js';
interface SmartMeterRechargeAttributes {
  id: number; orderNo: string; tenantName: string; tenantPhone: string; amount: number;
  channel: string; rechargeTime: string; status: string; lastSyncAt: Date | null; createdAt?: Date; updatedAt?: Date;
}
type Creation = Optional<SmartMeterRechargeAttributes, 'id' | 'createdAt' | 'updatedAt'>;
class SmartMeterRecharge extends BaseModel<SmartMeterRechargeAttributes, Creation> {}
SmartMeterRecharge.init({
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  orderNo: { type: DataTypes.STRING(64), allowNull: false, unique: true },
  tenantName: { type: DataTypes.STRING(80), defaultValue: '' }, tenantPhone: { type: DataTypes.STRING(30), defaultValue: '' },
  amount: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 }, channel: { type: DataTypes.STRING(40), defaultValue: '' },
  rechargeTime: { type: DataTypes.STRING(30), defaultValue: '' }, status: { type: DataTypes.STRING(30), defaultValue: '' },
  lastSyncAt: { type: DataTypes.DATE, allowNull: true },
}, { sequelize, tableName: 'smart_meter_recharges', indexes: [{ fields: ['tenantPhone'] }, { fields: ['rechargeTime'] }] });
export default SmartMeterRecharge;
