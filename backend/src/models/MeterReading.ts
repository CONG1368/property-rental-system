import { DataTypes, Optional } from 'sequelize';
import { BaseModel } from './BaseModel.js';
import { sequelize } from '../config/database.js';

interface MeterReadingAttributes {
  id: number; meterId: number; propertyId: number; tenantId: number;
  type: string; period: string; previousReading: number; currentReading: number;
  usage: number; pricePerUnit: number; amount: number; reader: string;
  readDate: Date | null; billed: '未生成' | '已生成';
  createdAt?: Date; updatedAt?: Date;
}
type MeterReadingCreation = Optional<MeterReadingAttributes, 'id' | 'createdAt' | 'updatedAt'>;

class MeterReading extends BaseModel<MeterReadingAttributes, MeterReadingCreation> {}

MeterReading.init({
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  meterId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  propertyId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  tenantId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  type: { type: DataTypes.STRING(20), allowNull: false },
  period: { type: DataTypes.STRING(7), allowNull: false },
  previousReading: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  currentReading: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  usage: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  pricePerUnit: { type: DataTypes.DECIMAL(10, 4), defaultValue: 0 },
  amount: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  reader: { type: DataTypes.STRING(50), defaultValue: '' },
  readDate: { type: DataTypes.DATEONLY, allowNull: true },
  billed: { type: DataTypes.ENUM('未生成', '已生成'), allowNull: false, defaultValue: '未生成' },
}, { sequelize, tableName: 'meter_readings', indexes: [{ fields: ['meterId'] }, { fields: ['period'] }, { fields: ['billed'] }] });

export default MeterReading;
