import { DataTypes, Optional } from 'sequelize';
import { BaseModel } from './BaseModel.js';
import { sequelize } from '../config/database';

interface VoucherEntryAttributes {
  id: number; voucherId: number; accountId: number; summary: string;
  debitAmount: number; creditAmount: number; contractId: number | null;
  billId: number | null; createdAt?: Date;
}
type VECreation = Optional<VoucherEntryAttributes, 'id'|'createdAt'>;
class VoucherEntry extends BaseModel<VoucherEntryAttributes, VECreation> {
}
VoucherEntry.init({
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  voucherId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  accountId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  summary: { type: DataTypes.TEXT, defaultValue: '' },
  debitAmount: { type: DataTypes.DECIMAL(12,2), defaultValue: 0 },
  creditAmount: { type: DataTypes.DECIMAL(12,2), defaultValue: 0 },
  contractId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  billId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
}, { sequelize, tableName: 'voucher_entries', updatedAt: false, indexes: [{fields:['voucherId']},{fields:['accountId']}] });
export default VoucherEntry;
