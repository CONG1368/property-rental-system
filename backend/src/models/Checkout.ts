import { DataTypes, Optional } from 'sequelize';
import { BaseModel } from './BaseModel.js';
import { sequelize } from '../config/database.js';

interface CheckoutAttributes {
  id: number;
  contractId: number; tenantId: number; propertyId: number;
  applyDate: string; reason: string;
  status: '待处理' | '已受理' | '交接中' | '已完成' | '已取消';
  handoverDate: string | null;
  checklist: { item: string; ok: boolean }[];
  costs: { name: string; amount: number; type: string }[];
  depositRefundAmount: number; settlement: object;
  notes: string; createdBy: number | null;
  createdAt?: Date; updatedAt?: Date;
}
type CheckoutCreation = Optional<CheckoutAttributes, 'id' | 'createdAt' | 'updatedAt'>;

class Checkout extends BaseModel<CheckoutAttributes, CheckoutCreation> {}

Checkout.init({
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  contractId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  tenantId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  propertyId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  applyDate: { type: DataTypes.DATEONLY, allowNull: false },
  reason: { type: DataTypes.STRING(300), defaultValue: '' },
  status: { type: DataTypes.ENUM('待处理', '已受理', '交接中', '已完成', '已取消'), allowNull: false, defaultValue: '待处理' },
  handoverDate: { type: DataTypes.DATEONLY, allowNull: true },
  checklist: { type: DataTypes.JSON, defaultValue: [] },
  costs: { type: DataTypes.JSON, defaultValue: [] },
  depositRefundAmount: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  settlement: { type: DataTypes.JSON, defaultValue: {} },
  notes: { type: DataTypes.TEXT, defaultValue: '' },
  createdBy: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
}, { sequelize, tableName: 'checkouts', indexes: [{ fields: ['contractId'] }, { fields: ['tenantId'] }, { fields: ['propertyId'] }, { fields: ['status'] }] });

export default Checkout;
