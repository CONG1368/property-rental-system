import { DataTypes, Optional } from 'sequelize';
import { BaseModel } from './BaseModel.js';
import { sequelize } from '../config/database.js';

interface FlowStep { order: number; role: string; label: string; }
interface FlowDefinitionAttributes {
  id: number; name: string; bizType: string;
  steps: FlowStep[];
  status: '启用' | '停用';
  notes: string; createdBy: number | null;
  createdAt?: Date; updatedAt?: Date;
}
type FlowCreation = Optional<FlowDefinitionAttributes, 'id' | 'createdAt' | 'updatedAt'>;
class FlowDefinition extends BaseModel<FlowDefinitionAttributes, FlowCreation> {}
FlowDefinition.init({
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  name: { type: DataTypes.STRING(100), allowNull: false },
  bizType: { type: DataTypes.STRING(50), allowNull: false },
  steps: { type: DataTypes.JSON, defaultValue: [] },
  status: { type: DataTypes.ENUM('启用', '停用'), allowNull: false, defaultValue: '启用' },
  notes: { type: DataTypes.TEXT, defaultValue: '' },
  createdBy: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
}, { sequelize, tableName: 'flow_definitions', indexes: [{ fields: ['bizType'] }, { fields: ['status'] }] });
export default FlowDefinition;
