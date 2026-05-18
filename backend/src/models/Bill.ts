import { DataTypes, Optional } from 'sequelize';
import { BaseModel } from './BaseModel.js';
import { sequelize } from '../config/database.js';

interface BillAttributes {
  id: number; contractId: number; billNo: string; period: string;
  rentAmount: number; waterFee: number; electricFee: number; utilityAmount: number;
  propertyFee: number; otherAmount: number; lateFee: number;
  totalAmount: number; dueDate: Date; paidDate: Date | null;
  status: '未缴'|'部分缴'|'已缴'|'逾期'; paymentChannel: string | null;
  periodMonths: number;
  createdAt?: Date; updatedAt?: Date;
}
type BCreation = Optional<BillAttributes, 'id'|'createdAt'|'updatedAt'>;
class Bill extends BaseModel<BillAttributes, BCreation> {
}
Bill.init({
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  contractId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  billNo: { type: DataTypes.STRING(50), allowNull: false },
  period: { type: DataTypes.STRING(20), allowNull: false },
  rentAmount: { type: DataTypes.DECIMAL(12,2), defaultValue: 0 },
  waterFee: { type: DataTypes.DECIMAL(10,2), defaultValue: 0 },
  electricFee: { type: DataTypes.DECIMAL(10,2), defaultValue: 0 },
  utilityAmount: { type: DataTypes.DECIMAL(12,2), defaultValue: 0 },
  propertyFee: { type: DataTypes.DECIMAL(10,2), defaultValue: 0 },
  otherAmount: { type: DataTypes.DECIMAL(12,2), defaultValue: 0 },
  lateFee: { type: DataTypes.DECIMAL(10,2), defaultValue: 0 },
  totalAmount: { type: DataTypes.DECIMAL(12,2), defaultValue: 0 },
  dueDate: { type: DataTypes.DATEONLY, allowNull: false },
  paidDate: { type: DataTypes.DATEONLY, allowNull: true },
  status: { type: DataTypes.ENUM('未缴','部分缴','已缴','逾期'), defaultValue: '未缴' },
  paymentChannel: { type: DataTypes.STRING(20), allowNull: true },
  periodMonths: { type: DataTypes.INTEGER.UNSIGNED, defaultValue: 1 },
}, { sequelize, tableName: 'bills', indexes: [{fields:['contractId']},{fields:['status']},{fields:['dueDate']}] });
export default Bill;
