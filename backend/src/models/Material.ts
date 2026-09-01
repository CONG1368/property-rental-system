import { DataTypes, Optional } from 'sequelize';
import { BaseModel } from './BaseModel.js';
import { sequelize } from '../config/database.js';

interface MaterialAttributes {
  id: number;
  name: string;
  category: string;
  spec: string;
  unit: string;
  quantity: number;
  minQuantity: number;
  location: string;
  price: number;
  supplier: string;
  status: string;
  notes: string;
  createdAt?: Date;
  updatedAt?: Date;
}
type MaterialCreation = Optional<MaterialAttributes, 'id' | 'createdAt' | 'updatedAt'>;

class Material extends BaseModel<MaterialAttributes, MaterialCreation> {}

Material.init({
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  name: { type: DataTypes.STRING(100), allowNull: false },
  category: { type: DataTypes.ENUM('耗材', '备件', '工具', '劳保', '其他'), allowNull: false, defaultValue: '耗材' },
  spec: { type: DataTypes.STRING(100), defaultValue: '' },
  unit: { type: DataTypes.STRING(20), defaultValue: '' },
  quantity: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
  minQuantity: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
  location: { type: DataTypes.STRING(100), defaultValue: '' },
  price: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
  supplier: { type: DataTypes.STRING(100), defaultValue: '' },
  status: { type: DataTypes.ENUM('正常', '低库存', '耗尽'), allowNull: false, defaultValue: '正常' },
  notes: { type: DataTypes.TEXT, defaultValue: '' },
}, { sequelize, tableName: 'materials', indexes: [{ fields: ['name'] }, { fields: ['category'] }, { fields: ['status'] }] });

export default Material;
