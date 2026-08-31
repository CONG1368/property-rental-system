import { DataTypes, Optional } from 'sequelize';
import { BaseModel } from './BaseModel.js';
import { sequelize } from '../config/database.js';

interface CommonRevenueAttributes {
  id: number;
  propertyId: number | null;
  item: string;
  type: '广告位' | '场地出租' | '公共区域经营' | '停车收益' | '其他';
  amount: number;
  revenueDate: string;
  payer: string;
  status: '应收' | '已入账' | '已核销';
  accountId: number | null;
  notes: string;
  createdAt?: Date;
  updatedAt?: Date;
}
type CommonRevenueCreation = Optional<CommonRevenueAttributes, 'id' | 'createdAt' | 'updatedAt'>;

class CommonRevenue extends BaseModel<CommonRevenueAttributes, CommonRevenueCreation> {}

CommonRevenue.init({
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  propertyId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  item: { type: DataTypes.STRING(200), allowNull: false },
  type: { type: DataTypes.ENUM('广告位', '场地出租', '公共区域经营', '停车收益', '其他'), allowNull: false, defaultValue: '广告位' },
  amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  revenueDate: { type: DataTypes.DATEONLY, allowNull: false },
  payer: { type: DataTypes.STRING(100), defaultValue: '' },
  status: { type: DataTypes.ENUM('应收', '已入账', '已核销'), allowNull: false, defaultValue: '应收' },
  accountId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  notes: { type: DataTypes.TEXT, defaultValue: '' },
}, { sequelize, tableName: 'common_revenues', indexes: [{ fields: ['propertyId'] }, { fields: ['status'] }, { fields: ['type'] }] });

export default CommonRevenue;
