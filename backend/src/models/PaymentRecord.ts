import { DataTypes, Optional } from 'sequelize';
import { BaseModel } from './BaseModel.js';
import { sequelize } from '../config/database.js';

interface PaymentRecordAttributes {
  id: number; billId: number; amount: number; channel: string;
  transactionNo: string; paidAt: Date; notes: string; createdBy: number;
  createdAt?: Date; updatedAt?: Date;
}
type PCreation = Optional<PaymentRecordAttributes, 'id'|'createdAt'|'updatedAt'>;
class PaymentRecord extends BaseModel<PaymentRecordAttributes, PCreation> {
}
PaymentRecord.init({
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  billId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  amount: { type: DataTypes.DECIMAL(12,2), allowNull: false },
  channel: { type: DataTypes.STRING(20), allowNull: false },
  transactionNo: { type: DataTypes.STRING(100), defaultValue: '' },
  paidAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  notes: { type: DataTypes.TEXT, defaultValue: '' },
  createdBy: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
}, { sequelize, tableName: 'payment_records', indexes: [{fields:['billId']},{fields:['paidAt']}] });
export default PaymentRecord;
