import { DataTypes, Optional } from 'sequelize';
import { BaseModel } from './BaseModel.js';
import { sequelize } from '../config/database.js';

/**
 * 账单费用明细（用户 2026-10-10 要求，方案 B）：
 * 合同里配的费用项逐条落到账单上，账单详情/打印按明细展示，账面不再只有四个固定费用列。
 * 单行金额 = 单价 × 数量 × (月数 || 1)：元/月 用数量存月数、月数留 0；元/㎡/月 用数量存面积、月数存覆盖月数。
 */
interface BillItemAttributes {
  id: number; billId: number;
  name: string;      // 费用名称
  unit: string;      // 计价单位：元/月、元/㎡/月、元/吨、元/度、元/次、元/年、元/季、一次性、手工
  unitPrice: number; // 单价
  quantity: number;  // 计费数量（月数 / 面积 / 用量 / 期数）
  months: number;    // 覆盖月数（仅 元/㎡/月 这类需要，其他留 0）
  amount: number;    // 本行金额
  source: string;    // 来源：合同 / 抄表 / 手工
  remark: string;    // 说明，如「88.5 ㎡ × 12 个月」
  sortOrder: number;
  createdAt?: Date; updatedAt?: Date;
}
type BillItemCreation = Optional<BillItemAttributes, 'id' | 'createdAt' | 'updatedAt'>;
class BillItem extends BaseModel<BillItemAttributes, BillItemCreation> {}
BillItem.init({
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  billId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  name: { type: DataTypes.STRING(50), allowNull: false },
  unit: { type: DataTypes.STRING(20), defaultValue: '' },
  unitPrice: { type: DataTypes.DECIMAL(12, 4), defaultValue: 0 },
  quantity: { type: DataTypes.DECIMAL(12, 4), defaultValue: 0 },
  months: { type: DataTypes.INTEGER, defaultValue: 0 },
  amount: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  source: { type: DataTypes.STRING(10), defaultValue: '合同' },
  remark: { type: DataTypes.STRING(120), defaultValue: '' },
  sortOrder: { type: DataTypes.INTEGER, defaultValue: 0 },
}, { sequelize, tableName: 'bill_items', indexes: [{ fields: ['billId'] }] });
export default BillItem;
