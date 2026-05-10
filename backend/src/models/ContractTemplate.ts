import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

interface ContractTemplateAttributes {
  id: number; name: string; type: '住房'|'厂房'|'商铺';
  content: object; isDefault: boolean; terms: object;
  createdAt?: Date; updatedAt?: Date;
}
type CTCreation = Optional<ContractTemplateAttributes, 'id'|'createdAt'|'updatedAt'>;
class ContractTemplate extends Model<ContractTemplateAttributes, CTCreation> implements ContractTemplateAttributes {
  public id!: number; public name!: string; public type!: '住房'|'厂房'|'商铺';
  public content!: object; public isDefault!: boolean; public terms!: object;
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
