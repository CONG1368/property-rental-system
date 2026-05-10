import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

interface ChartOfAccountAttributes {
  id: number; bookId: number; code: string; name: string; parentId: number | null;
  type: '资产'|'负债'|'所有者权益'|'收入'|'费用'; level: number;
  direction: '借'|'贷'; isEnabled: boolean;
  createdAt?: Date; updatedAt?: Date;
}
type COACreation = Optional<ChartOfAccountAttributes, 'id'|'createdAt'|'updatedAt'>;
class ChartOfAccount extends Model<ChartOfAccountAttributes, COACreation> implements ChartOfAccountAttributes {
  public id!: number; public bookId!: number; public code!: string; public name!: string;
  public parentId!: number; public type!: '资产'|'负债'|'所有者权益'|'收入'|'费用';
  public level!: number; public direction!: '借'|'贷'; public isEnabled!: boolean;
}
ChartOfAccount.init({
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  bookId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  code: { type: DataTypes.STRING(20), allowNull: false },
  name: { type: DataTypes.STRING(100), allowNull: false },
  parentId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  type: { type: DataTypes.ENUM('资产','负债','所有者权益','收入','费用'), allowNull: false },
  level: { type: DataTypes.INTEGER, defaultValue: 1 },
  direction: { type: DataTypes.ENUM('借','贷'), defaultValue: '借' },
  isEnabled: { type: DataTypes.BOOLEAN, defaultValue: true },
}, { sequelize, tableName: 'chart_of_accounts', indexes: [{fields:['bookId']},{fields:['code']},{fields:['parentId']}] });
export default ChartOfAccount;
