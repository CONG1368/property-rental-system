import { DataTypes, Optional } from 'sequelize';
import { BaseModel } from './BaseModel.js';
import { sequelize } from '../config/database';

interface ContractTemplateAttributes {
  id: number; name: string; type: '住房'|'厂房'|'商铺';
  content: object; isDefault: boolean; terms: object;
  createdAt?: Date; updatedAt?: Date;
}
type CTCreation = Optional<ContractTemplateAttributes, 'id'|'createdAt'|'updatedAt'>;
class ContractTemplate extends BaseModel<ContractTemplateAttributes, CTCreation> {
}
ContractTemplate.init({
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  name: { type: DataTypes.STRING(100), allowNull: false },
  type: { type: DataTypes.ENUM('住房','厂房','商铺'), allowNull: false },
  content: { type: DataTypes.JSON, defaultValue: {} },
  isDefault: { type: DataTypes.BOOLEAN, defaultValue: false },
  terms: { type: DataTypes.JSON, defaultValue: {} },
}, { sequelize, tableName: 'contract_templates' });
export default ContractTemplate;
