import { DataTypes, Optional } from 'sequelize';
import { BaseModel } from './BaseModel.js';
import { sequelize } from '../config/database.js';

interface DepositAttributes {
  id: number;
  contractId: number; tenantId: number; propertyId: number;
  amount: number; refundedAmount: number; deductionAmount: number;
  status: '在管' | '部分退还' | '已退还' | '已抵扣' | '已冻结';
  paidDate: Date | null; refundDate: Date | null; refundReason: string;
  notes: string; createdBy: number | null;
  createdAt?: Date; updatedAt?: Date;
}
type DepositCreation = Optional<DepositAttributes, 'id' | 'createdAt' | 'updatedAt'>;

class Deposit extends BaseModel<DepositAttributes, DepositCreation> {}

Deposit.init({
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  contractId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  tenantId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  propertyId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  refundedAmount: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  deductionAmount: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  status: { type: DataTypes.ENUM('在管', '部分退还', '已退还', '已抵扣', '已冻结'), allowNull: false, defaultValue: '在管' },
  paidDate: { type: DataTypes.DATEONLY, allowNull: true },
  refundDate: { type: DataTypes.DATEONLY, allowNull: true },
  refundReason: { type: DataTypes.STRING(200), defaultValue: '' },
  notes: { type: DataTypes.TEXT, defaultValue: '' },
  createdBy: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
}, { sequelize, tableName: 'deposits', indexes: [{ fields: ['contractId'] }, { fields: ['tenantId'] }, { fields: ['propertyId'] }, { fields: ['status'] }] });

export default Deposit;
