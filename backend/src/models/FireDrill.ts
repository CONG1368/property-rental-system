import { DataTypes, Optional } from 'sequelize';
import { BaseModel } from './BaseModel.js';
import { sequelize } from '../config/database.js';

interface FireDrillAttributes {
  id: number; propertyId: number; drillDate: Date; type: string;
  organizer: string; participantCount: number; duration: number;
  evacuationTime: number | null; score: number;
  summary: string; issues: string; improvementPlan: string;
  attachments: object; createdAt?: Date; updatedAt?: Date;
}
type FireDrillCreation = Optional<FireDrillAttributes, 'id' | 'createdAt' | 'updatedAt'>;

class FireDrill extends BaseModel<FireDrillAttributes, FireDrillCreation> {}

FireDrill.init({
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  propertyId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  drillDate: { type: DataTypes.DATEONLY, allowNull: false },
  type: { type: DataTypes.ENUM('疏散演练','灭火演练','综合演练','桌面推演'), allowNull: false, defaultValue: '综合演练' },
  organizer: { type: DataTypes.STRING(50), defaultValue: '' },
  participantCount: { type: DataTypes.INTEGER, defaultValue: 0 },
  duration: { type: DataTypes.INTEGER, defaultValue: 0 },
  evacuationTime: { type: DataTypes.INTEGER, allowNull: true },
  score: { type: DataTypes.INTEGER, defaultValue: 0 },
  summary: { type: DataTypes.TEXT, defaultValue: '' },
  issues: { type: DataTypes.TEXT, defaultValue: '' },
  improvementPlan: { type: DataTypes.TEXT, defaultValue: '' },
  attachments: { type: DataTypes.JSON, defaultValue: [] },
}, { sequelize, tableName: 'fire_drills', indexes: [{ fields: ['propertyId'] }, { fields: ['drillDate'] }] });

export default FireDrill;
