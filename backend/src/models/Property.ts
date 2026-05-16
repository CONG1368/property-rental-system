import { DataTypes, Optional } from 'sequelize';
import { BaseModel } from './BaseModel.js';
import { sequelize } from '../config/database.js';

interface PropertyAttributes {
  id: number; name: string; type: '公寓'|'厂房'|'商铺'; subType: string;
  area: number; address: string; floor: string; unit: string;
  waterFeeRate: number; electricFeeRate: number; propertyFeeRate: number;
  status: '空置'|'已预订'|'已出租'|'维修中'|'退租中';
  amenities: object; owner: string; notes: string; deletedAt: Date | null;
  createdAt?: Date; updatedAt?: Date;
}

type PropertyCreationAttributes = Optional<PropertyAttributes, 'id' | 'deletedAt' | 'createdAt' | 'updatedAt'>;

class Property extends BaseModel<PropertyAttributes, PropertyCreationAttributes> {
}

Property.init({
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  name: { type: DataTypes.STRING(100), allowNull: false },
  type: { type: DataTypes.ENUM('公寓','厂房','商铺'), allowNull: false },
  subType: { type: DataTypes.STRING(50), defaultValue: '' },
  area: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  address: { type: DataTypes.STRING(255), defaultValue: '' },
  floor: { type: DataTypes.STRING(20), defaultValue: '' },
  unit: { type: DataTypes.STRING(20), defaultValue: '' },
  status: { type: DataTypes.ENUM('空置','已预订','已出租','维修中','退租中'), defaultValue: '空置' },
  waterFeeRate: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  electricFeeRate: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  propertyFeeRate: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  amenities: { type: DataTypes.JSON, defaultValue: {} },
  owner: { type: DataTypes.STRING(100), defaultValue: '' },
  notes: { type: DataTypes.TEXT, defaultValue: '' },
  deletedAt: { type: DataTypes.DATE, allowNull: true },
}, {
  sequelize, tableName: 'properties',
  paranoid: true, deletedAt: 'deletedAt',
  indexes: [{ fields: ['type'] }, { fields: ['status'] }, { fields: ['name'] }],
});

export default Property;
