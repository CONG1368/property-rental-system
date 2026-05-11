import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

interface BudgetAttributes {
  id: number; bookId: number; accountId: number; year: number; month: number | null;
  budgetAmount: number; actualAmount: number;
  status: '编制中'|'待审核'|'已批准'; createdBy: number | null;
  createdAt?: Date; updatedAt?: Date;
}
type BCreation = Optional<BudgetAttributes, 'id'|'createdAt'|'updatedAt'>;
class Budget extends Model<BudgetAttributes, BCreation> implements BudgetAttributes {
}
Budget.init({
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  bookId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  accountId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  year: { type: DataTypes.INTEGER, allowNull: false },
  month: { type: DataTypes.INTEGER, allowNull: true },
  budgetAmount: { type: DataTypes.DECIMAL(14,2), allowNull: false },
  actualAmount: { type: DataTypes.DECIMAL(14,2), defaultValue: 0 },
  status: { type: DataTypes.ENUM('编制中','待审核','已批准'), defaultValue: '编制中' },
  createdBy: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
}, { sequelize, tableName: 'budgets', indexes: [{fields:['bookId']},{fields:['year']},{fields:['accountId']}] });
export default Budget;
