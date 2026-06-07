import { DataTypes, Optional } from 'sequelize';
import { BaseModel } from './BaseModel.js';
import { sequelize } from '../config/database.js';

interface FireEquipmentAttributes {
  id: number; propertyId: number; name: string; category: string;
  model: string; quantity: number; location: string;
  purchaseDate: Date | null; expiryDate: Date | null;
  lastCheckDate: Date | null; nextCheckDate: Date | null;
  status: string; manufacturer: string; certificateNo: string; notes: string;
  createdAt?: Date; updatedAt?: Date;
}
type FireEquipmentCreation = Optional<FireEquipmentAttributes, 'id' | 'createdAt' | 'updatedAt'>;

class FireEquipment extends BaseModel<FireEquipmentAttributes, FireEquipmentCreation> {}

FireEquipment.init({
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  propertyId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  name: { type: DataTypes.STRING(100), allowNull: false },
  category: { type: DataTypes.ENUM('灭火器','消火栓','烟感报警器','应急照明','疏散标志','防火门','自动喷淋','其他'), allowNull: false, defaultValue: '灭火器' },
  model: { type: DataTypes.STRING(50), defaultValue: '' },
  quantity: { type: DataTypes.INTEGER, defaultValue: 1 },
  location: { type: DataTypes.STRING(100), defaultValue: '' },
  purchaseDate: { type: DataTypes.DATEONLY, allowNull: true },
  expiryDate: { type: DataTypes.DATEONLY, allowNull: true },
  lastCheckDate: { type: DataTypes.DATEONLY, allowNull: true },
  nextCheckDate: { type: DataTypes.DATEONLY, allowNull: true },
  status: { type: DataTypes.ENUM('正常','即将过期','已过期','待维修','已报废'), allowNull: false, defaultValue: '正常' },
  manufacturer: { type: DataTypes.STRING(100), defaultValue: '' },
  certificateNo: { type: DataTypes.STRING(50), defaultValue: '' },
  notes: { type: DataTypes.TEXT, defaultValue: '' },
}, { sequelize, tableName: 'fire_equipment', indexes: [{ fields: ['propertyId'] }, { fields: ['status'] }, { fields: ['category'] }] });

export default FireEquipment;
