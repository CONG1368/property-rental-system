import { DataTypes, Optional } from 'sequelize';
import { BaseModel } from './BaseModel.js';
import { sequelize } from '../config/database.js';

interface FireInspectionAttributes {
  id: number; propertyId: number; inspectorId: number;
  inspectionDate: Date; type: string; result: string;
  overallScore: number;
  fireExtinguisherOk: boolean; smokeAlarmOk: boolean; emergencyLightOk: boolean;
  escapeRouteOk: boolean; electricalOk: boolean; flammableOk: boolean;
  notes: string; nextInspectionDate: Date | null;
  attachments: object; createdAt?: Date; updatedAt?: Date;
}
type FireInspectionCreation = Optional<FireInspectionAttributes, 'id' | 'createdAt' | 'updatedAt'>;

class FireInspection extends BaseModel<FireInspectionAttributes, FireInspectionCreation> {}

FireInspection.init({
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  propertyId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  inspectorId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  inspectionDate: { type: DataTypes.DATEONLY, allowNull: false },
  type: { type: DataTypes.ENUM('日常巡查','专项检查','季度检查','年度检查','突击检查'), allowNull: false, defaultValue: '日常巡查' },
  result: { type: DataTypes.ENUM('合格','不合格','限期整改'), allowNull: false, defaultValue: '合格' },
  overallScore: { type: DataTypes.INTEGER, defaultValue: 100 },
  fireExtinguisherOk: { type: DataTypes.BOOLEAN, defaultValue: true },
  smokeAlarmOk: { type: DataTypes.BOOLEAN, defaultValue: true },
  emergencyLightOk: { type: DataTypes.BOOLEAN, defaultValue: true },
  escapeRouteOk: { type: DataTypes.BOOLEAN, defaultValue: true },
  electricalOk: { type: DataTypes.BOOLEAN, defaultValue: true },
  flammableOk: { type: DataTypes.BOOLEAN, defaultValue: true },
  notes: { type: DataTypes.TEXT, defaultValue: '' },
  nextInspectionDate: { type: DataTypes.DATEONLY, allowNull: true },
  attachments: { type: DataTypes.JSON, defaultValue: [] },
}, { sequelize, tableName: 'fire_inspections', indexes: [{ fields: ['propertyId'] }, { fields: ['result'] }, { fields: ['inspectionDate'] }] });

export default FireInspection;
