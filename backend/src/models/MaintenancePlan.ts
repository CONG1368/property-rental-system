import { DataTypes, Optional } from 'sequelize';
import { BaseModel } from './BaseModel.js';
import { sequelize } from '../config/database.js';

interface MaintenancePlanAttributes {
  id: number;
  facilityId: number | null;
  name: string;
  cycleType: string;
  cycleMonths: number;
  nextRunDate: Date | null;
  status: string;
  assignee: string;
  content: string;
  createdBy: number | null;
  createdAt?: Date;
  updatedAt?: Date;
}
type MaintenancePlanCreation = Optional<MaintenancePlanAttributes, 'id' | 'createdAt' | 'updatedAt'>;

class MaintenancePlan extends BaseModel<MaintenancePlanAttributes, MaintenancePlanCreation> {}

MaintenancePlan.init({
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  facilityId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  name: { type: DataTypes.STRING(100), allowNull: false },
  cycleType: { type: DataTypes.ENUM('月', '季', '半年', '年'), allowNull: false, defaultValue: '月' },
  cycleMonths: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
  nextRunDate: { type: DataTypes.DATEONLY, allowNull: true },
  status: { type: DataTypes.ENUM('启用', '停用'), allowNull: false, defaultValue: '启用' },
  assignee: { type: DataTypes.STRING(100), defaultValue: '' },
  content: { type: DataTypes.TEXT, defaultValue: '' },
  createdBy: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
}, {
  sequelize,
  tableName: 'maintenance_plans',
  indexes: [{ fields: ['facilityId'] }, { fields: ['status'] }],
});

export default MaintenancePlan;
