import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

interface ContractClauseAttributes {
  id: number; templateId: number; title: string; content: string;
  type: '标准'|'可选'|'风险'; sortOrder: number; isRequired: boolean;
  createdAt?: Date; updatedAt?: Date;
}
type CCCreation = Optional<ContractClauseAttributes, 'id'|'createdAt'|'updatedAt'>;
class ContractClause extends Model<ContractClauseAttributes, CCCreation> implements ContractClauseAttributes {
  public id!: number; public templateId!: number; public title!: string;
  public content!: string; public type!: '标准'|'可选'|'风险';
  public sortOrder!: number; public isRequired!: boolean;
}
ContractClause.init({
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  templateId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  title: { type: DataTypes.STRING(200), allowNull: false },
  content: { type: DataTypes.TEXT, defaultValue: '' },
  type: { type: DataTypes.ENUM('标准','可选','风险'), defaultValue: '标准' },
  sortOrder: { type: DataTypes.INTEGER, defaultValue: 0 },
  isRequired: { type: DataTypes.BOOLEAN, defaultValue: false },
}, { sequelize, tableName: 'contract_clauses', indexes: [{fields:['templateId']}] });
export default ContractClause;
