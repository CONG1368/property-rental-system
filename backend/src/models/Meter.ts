import { DataTypes, Optional } from 'sequelize';
import { BaseModel } from './BaseModel.js';
import { sequelize } from '../config/database.js';

interface MeterAttributes {
  id: number; propertyId: number; tenantId: number;
  type: '水' | '电' | '燃气'; unit: string; meterNo: string;
  lastReading: number; lastReadingDate: Date | null; pricePerUnit: number; notes: string;
  createdAt?: Date; updatedAt?: Date;
}
type MeterCreation = Optional<MeterAttributes, 'id' | 'createdAt' | 'updatedAt'>;

class Meter extends BaseModel<MeterAttributes, MeterCreation> {}

Meter.init({
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  propertyId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  tenantId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  type: { type: DataTypes.ENUM('水', '电', '燃气'), allowNull: false, defaultValue: '电' },
  unit: { type: DataTypes.STRING(20), defaultValue: '度' },
  meterNo: { type: DataTypes.STRING(50), defaultValue: '' },
  lastReading: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  lastReadingDate: { type: DataTypes.DATEONLY, allowNull: true },
  pricePerUnit: { type: DataTypes.DECIMAL(10, 4), defaultValue: 0 },
  notes: { type: DataTypes.TEXT, defaultValue: '' },
}, { sequelize, tableName: 'meters', indexes: [{ fields: ['propertyId'] }, { fields: ['tenantId'] }, { fields: ['type'] }, { fields: ['meterNo'] }] });

export default Meter;
