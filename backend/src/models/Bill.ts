import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

interface BillAttributes {
  id: number; contractId: number; billNo: string; period: string;
  rentAmount: number; utilityAmount: number; otherAmount: number;
  totalAmount: number; dueDate: Date; paidDate: Date | null;
  status: '未缴'|'部分缴'|'已缴'|'逾期'; paymentChannel: string | null;
  createdAt?: Date; updatedAt?: Date;
}
type BCreation = Optional<BillAttributes, 'id'|'createdAt'|'updatedAt'>;
class Bill extends Model<BillAttributes, BCreation> implements BillAttributes {
}
Bill.init({
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  contractId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  billNo: { type: DataTypes.STRING(50), allowNull: false },
  period: { type: DataTypes.STRING(7), allowNull: false },
  rentAmount: { type: DataTypes.DECIMAL(12,2), defaultValue: 0 },
  utilityAmount: { type: DataTypes.DECIMAL(12,2), defaultValue: 0 },
  otherAmount: { type: DataTypes.DECIMAL(12,2), defaultValue: 0 },
  totalAmount: { type: DataTypes.DECIMAL(12,2), defaultValue: 0 },
  dueDate: { type: DataTypes.DATEONLY, allowNull: false },
  paidDate: { type: DataTypes.DATEONLY, allowNull: true },
  status: { type: DataTypes.ENUM('未缴','部分缴','已缴','逾期'), defaultValue: '未缴' },
  paymentChannel: { type: DataTypes.STRING(20), allowNull: true },
}, { sequelize, tableName: 'bills', indexes: [{fields:['contractId']},{fields:['status']},{fields:['dueDate']}] });
export default Bill;
