import { DataTypes, Optional } from 'sequelize';
import { BaseModel } from './BaseModel.js';
import { sequelize } from '../config/database';

interface ExpenseAttributes {
  id: number; bookId: number; category: '维修'|'保洁'|'安保'|'绿化'|'办公'|'折旧'|'其他';
  amount: number; allocationRule: object; status: '待审批'|'已批准'|'已付款';
  notes: string; createdBy: number | null;
  createdAt?: Date; updatedAt?: Date;
}
type ECreation = Optional<ExpenseAttributes, 'id'|'createdAt'|'updatedAt'>;
class Expense extends BaseModel<ExpenseAttributes, ECreation> {
}
Expense.init({
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  bookId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  category: { type: DataTypes.ENUM('维修','保洁','安保','绿化','办公','折旧','其他'), allowNull: false },
  amount: { type: DataTypes.DECIMAL(12,2), allowNull: false },
  allocationRule: { type: DataTypes.JSON, defaultValue: {} },
  status: { type: DataTypes.ENUM('待审批','已批准','已付款'), defaultValue: '待审批' },
  notes: { type: DataTypes.TEXT, defaultValue: '' },
  createdBy: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
}, { sequelize, tableName: 'expenses', indexes: [{fields:['bookId']},{fields:['category']},{fields:['status']}] });
export default Expense;
