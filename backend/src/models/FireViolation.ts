import { DataTypes, Optional } from 'sequelize';
import { BaseModel } from './BaseModel.js';
import { sequelize } from '../config/database.js';

interface FireViolationAttributes {
  id: number; propertyId: number; tenantId: number | null; inspectionId: number | null;
  violationDate: Date; category: string; severity: string;
  description: string; rectificationRequirement: string;
  deadline: Date | null; rectifiedDate: Date | null;
  penaltyAmount: number; penaltyStatus: string;
  status: string; rectificationEvidence: object;
  operatorId: number | null; createdAt?: Date; updatedAt?: Date;
}
type FireViolationCreation = Optional<FireViolationAttributes, 'id' | 'createdAt' | 'updatedAt'>;

class FireViolation extends BaseModel<FireViolationAttributes, FireViolationCreation> {}

FireViolation.init({
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  propertyId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  tenantId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  inspectionId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  violationDate: { type: DataTypes.DATEONLY, allowNull: false },
  category: { type: DataTypes.ENUM('器材缺失','通道堵塞','电气隐患','易燃易爆','擅自改造','其他'), allowNull: false, defaultValue: '其他' },
  severity: { type: DataTypes.ENUM('一般隐患','重大隐患','紧急'), allowNull: false, defaultValue: '一般隐患' },
  description: { type: DataTypes.TEXT, allowNull: false },
  rectificationRequirement: { type: DataTypes.TEXT, defaultValue: '' },
  deadline: { type: DataTypes.DATEONLY, allowNull: true },
  rectifiedDate: { type: DataTypes.DATEONLY, allowNull: true },
  penaltyAmount: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  penaltyStatus: { type: DataTypes.ENUM('无罚款','待缴','已缴','豁免'), defaultValue: '无罚款' },
  status: { type: DataTypes.ENUM('待整改','整改中','已整改','逾期未改','已关闭'), allowNull: false, defaultValue: '待整改' },
  rectificationEvidence: { type: DataTypes.JSON, defaultValue: [] },
  operatorId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
}, { sequelize, tableName: 'fire_violations', indexes: [{ fields: ['propertyId'] }, { fields: ['status'] }, { fields: ['severity'] }] });

export default FireViolation;
