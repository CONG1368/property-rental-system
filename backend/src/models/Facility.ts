import { DataTypes, Optional } from 'sequelize';
import { BaseModel } from './BaseModel.js';
import { sequelize } from '../config/database.js';

interface FacilityAttributes {
  id: number;
  propertyId: number | null;
  name: string;
  code: string;
  category: string;
  brand: string;
  model: string;
  location: string;
  installDate: Date | null;
  status: string;
  lastMaintainDate: Date | null;
  nextMaintainDate: Date | null;
  maintainer: string;
  notes: string;
  createdAt?: Date;
  updatedAt?: Date;
}
type FacilityCreation = Optional<FacilityAttributes, 'id' | 'createdAt' | 'updatedAt'>;

class Facility extends BaseModel<FacilityAttributes, FacilityCreation> {}

Facility.init({
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  propertyId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  name: { type: DataTypes.STRING(100), allowNull: false },
  code: { type: DataTypes.STRING(50), defaultValue: '' },
  category: { type: DataTypes.ENUM('电梯','水泵','配电','空调','消防','安防','给排水','其他'), allowNull: false, defaultValue: '电梯' },
  brand: { type: DataTypes.STRING(50), defaultValue: '' },
  model: { type: DataTypes.STRING(50), defaultValue: '' },
  location: { type: DataTypes.STRING(100), defaultValue: '' },
  installDate: { type: DataTypes.DATEONLY, allowNull: true },
  status: { type: DataTypes.ENUM('正常','保养中','维修中','停用','故障'), allowNull: false, defaultValue: '正常' },
  lastMaintainDate: { type: DataTypes.DATEONLY, allowNull: true },
  nextMaintainDate: { type: DataTypes.DATEONLY, allowNull: true },
  maintainer: { type: DataTypes.STRING(100), defaultValue: '' },
  notes: { type: DataTypes.TEXT, defaultValue: '' },
}, { sequelize, tableName: 'facilities', indexes: [{ fields: ['propertyId'] }, { fields: ['status'] }, { fields: ['category'] }] });

export default Facility;
