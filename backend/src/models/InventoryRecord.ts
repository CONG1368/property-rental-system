import { DataTypes, Optional } from 'sequelize';
import { BaseModel } from './BaseModel.js';
import { sequelize } from '../config/database.js';

interface InventoryRecordAttributes {
  id: number;
  materialId: number;
  type: string;
  quantity: number;
  operator: string;
  date: Date | null;
  reason: string;
  notes: string;
  createdAt?: Date;
  updatedAt?: Date;
}
type InventoryRecordCreation = Optional<InventoryRecordAttributes, 'id' | 'createdAt' | 'updatedAt'>;

class InventoryRecord extends BaseModel<InventoryRecordAttributes, InventoryRecordCreation> {}

InventoryRecord.init({
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  materialId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  type: { type: DataTypes.ENUM('入库', '出库', '领用', '盘点'), allowNull: false, defaultValue: '入库' },
  quantity: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
  operator: { type: DataTypes.STRING(50), defaultValue: '' },
  date: { type: DataTypes.DATEONLY, allowNull: true },
  reason: { type: DataTypes.STRING(200), defaultValue: '' },
  notes: { type: DataTypes.TEXT, defaultValue: '' },
}, { sequelize, tableName: 'inventory_records', indexes: [{ fields: ['materialId'] }] });

export default InventoryRecord;
