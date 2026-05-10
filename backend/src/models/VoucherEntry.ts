import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

interface VoucherEntryAttributes {
  id: number; voucherId: number; accountId: number; summary: string;
  debitAmount: number; creditAmount: number; contractId: number | null;
  billId: number | null; createdAt?: Date;
}
type VECreation = Optional<VoucherEntryAttributes, 'id'|'createdAt'>;
class VoucherEntry extends Model<VoucherEntryAttributes, VECreation> implements VoucherEntryAttributes {
  public id!: number; public voucherId!: number; public accountId!: number;
  public summary!: string; public debitAmount!: number; public creditAmount!: number;
  public contractId!: number; public billId!: number;
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
