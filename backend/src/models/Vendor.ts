import { DataTypes, Optional } from 'sequelize';
import { BaseModel } from './BaseModel.js';
import { sequelize } from '../config/database.js';

interface VendorAttributes {
  id: number;
  name: string;
  category: string;
  contact: string;
  phone: string;
  address: string;
  contractNo: string;
  contractStart: Date | null;
  contractEnd: Date | null;
  price: number;
  rating: number;
  status: string;
  notes: string;
  createdAt?: Date;
  updatedAt?: Date;
}
type VendorCreation = Optional<VendorAttributes, 'id' | 'createdAt' | 'updatedAt'>;

class Vendor extends BaseModel<VendorAttributes, VendorCreation> {}

Vendor.init({
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  name: { type: DataTypes.STRING(100), allowNull: false },
  category: { type: DataTypes.ENUM('维保','保洁','安保','绿化','消防','装修','其他'), allowNull: false, defaultValue: '维保' },
  contact: { type: DataTypes.STRING(50), defaultValue: '' },
  phone: { type: DataTypes.STRING(30), defaultValue: '' },
  address: { type: DataTypes.STRING(200), defaultValue: '' },
  contractNo: { type: DataTypes.STRING(50), defaultValue: '' },
  contractStart: { type: DataTypes.DATEONLY, allowNull: true },
  contractEnd: { type: DataTypes.DATEONLY, allowNull: true },
  price: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  rating: { type: DataTypes.INTEGER, defaultValue: 0 },
  status: { type: DataTypes.ENUM('合作中','已暂停','已终止'), allowNull: false, defaultValue: '合作中' },
  notes: { type: DataTypes.TEXT, defaultValue: '' },
}, { sequelize, tableName: 'vendors', indexes: [{ fields: ['name'] }, { fields: ['category'] }, { fields: ['status'] }] });

export default Vendor;
