import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

interface VoucherAttributes {
  id: number; bookId: number; voucherNo: string; date: Date; period: string;
  type: '收'|'付'|'转'; summary: string;
  status: '草稿'|'待复核'|'待审核'|'已过账'|'已作废';
  createdBy: number | null; reviewedBy: number | null; approvedBy: number | null;
  createdAt?: Date; updatedAt?: Date;
}
type VCreation = Optional<VoucherAttributes, 'id'|'createdAt'|'updatedAt'>;
class Voucher extends Model<VoucherAttributes, VCreation> implements VoucherAttributes {
}
Voucher.init({
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  bookId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  voucherNo: { type: DataTypes.STRING(50), allowNull: false },
  date: { type: DataTypes.DATEONLY, allowNull: false },
  period: { type: DataTypes.STRING(7), allowNull: false },
  type: { type: DataTypes.ENUM('收','付','转'), allowNull: false },
  summary: { type: DataTypes.TEXT, defaultValue: '' },
  status: { type: DataTypes.ENUM('草稿','待复核','待审核','已过账','已作废'), defaultValue: '草稿' },
  createdBy: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  reviewedBy: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  approvedBy: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
}, { sequelize, tableName: 'vouchers', indexes: [{fields:['bookId']},{fields:['status']},{fields:['period']}] });
export default Voucher;
