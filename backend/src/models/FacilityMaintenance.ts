import { DataTypes, Optional } from 'sequelize';
import { BaseModel } from './BaseModel.js';
import { sequelize } from '../config/database.js';

interface FacilityMaintenanceAttributes {
  id: number;
  facilityId: number;
  type: string;
  date: Date;
  performer: string;
  content: string;
  result: string;
  cost: number;
  nextDate: Date | null;
  notes: string;
  createdAt?: Date;
  updatedAt?: Date;
}
type FacilityMaintenanceCreation = Optional<FacilityMaintenanceAttributes, 'id' | 'createdAt' | 'updatedAt'>;

class FacilityMaintenance extends BaseModel<FacilityMaintenanceAttributes, FacilityMaintenanceCreation> {}

FacilityMaintenance.init({
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  facilityId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  type: { type: DataTypes.ENUM('巡检','保养','维修'), allowNull: false, defaultValue: '巡检' },
  date: { type: DataTypes.DATEONLY, allowNull: false },
  performer: { type: DataTypes.STRING(100), defaultValue: '' },
  content: { type: DataTypes.TEXT, defaultValue: '' },
  result: { type: DataTypes.ENUM('正常','异常','已修复'), allowNull: false, defaultValue: '正常' },
  cost: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  nextDate: { type: DataTypes.DATEONLY, allowNull: true },
  notes: { type: DataTypes.TEXT, defaultValue: '' },
}, { sequelize, tableName: 'facility_maintenances', indexes: [{ fields: ['facilityId'] }] });

export default FacilityMaintenance;
