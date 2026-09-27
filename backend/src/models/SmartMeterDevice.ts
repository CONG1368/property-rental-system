import { DataTypes, Optional } from 'sequelize';
import { BaseModel } from './BaseModel.js';
import { sequelize } from '../config/database.js';
interface SmartMeterDeviceAttributes {
  id: number; platformId: string; meterNo: string; name: string; area: string;
  meterType: '水' | '电'; currentReading: number; totalUsage: number; status: string;
  lastSyncAt: Date | null; createdAt?: Date; updatedAt?: Date;
}
type Creation = Optional<SmartMeterDeviceAttributes, 'id' | 'createdAt' | 'updatedAt'>;
class SmartMeterDevice extends BaseModel<SmartMeterDeviceAttributes, Creation> {}
SmartMeterDevice.init({
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  platformId: { type: DataTypes.STRING(64), allowNull: false, unique: true },
  meterNo: { type: DataTypes.STRING(50), allowNull: false },
  name: { type: DataTypes.STRING(100), defaultValue: '' },
  area: { type: DataTypes.STRING(100), defaultValue: '' },
  meterType: { type: DataTypes.ENUM('水', '电'), defaultValue: '电' },
  currentReading: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  totalUsage: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  status: { type: DataTypes.STRING(30), defaultValue: '' },
  lastSyncAt: { type: DataTypes.DATE, allowNull: true },
}, { sequelize, tableName: 'smart_meter_devices', indexes: [{ fields: ['meterNo'] }, { fields: ['area'] }] });
export default SmartMeterDevice;
