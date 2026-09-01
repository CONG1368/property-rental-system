import { DataTypes, Optional } from 'sequelize';
import { BaseModel } from './BaseModel.js';
import { sequelize } from '../config/database.js';

interface LeadAttributes {
  id: number;
  propertyId: number | null;
  name: string;
  phone: string;
  source: '58同城' | '贝壳' | '小红书' | '抖音' | '线下' | '转介绍' | '其他';
  interestType: '公寓' | '厂房' | '商铺';
  interestedArea: number;
  budget: number;
  status: '新线索' | '已联系' | '已看房' | '已成交' | '已流失';
  nextFollowDate: Date | null;
  remark: string;
  createdBy: number | null;
  createdAt?: Date;
  updatedAt?: Date;
}
type LeadCreation = Optional<LeadAttributes, 'id' | 'propertyId' | 'nextFollowDate' | 'createdBy' | 'createdAt' | 'updatedAt'>;

class Lead extends BaseModel<LeadAttributes, LeadCreation> {}

Lead.init({
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  propertyId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  name: { type: DataTypes.STRING(100), allowNull: false },
  phone: { type: DataTypes.STRING(30), allowNull: false, defaultValue: '' },
  source: { type: DataTypes.ENUM('58同城','贝壳','小红书','抖音','线下','转介绍','其他'), allowNull: false, defaultValue: '其他' },
  interestType: { type: DataTypes.ENUM('公寓','厂房','商铺'), allowNull: false, defaultValue: '公寓' },
  interestedArea: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
  budget: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
  status: { type: DataTypes.ENUM('新线索','已联系','已看房','已成交','已流失'), allowNull: false, defaultValue: '新线索' },
  nextFollowDate: { type: DataTypes.DATEONLY, allowNull: true },
  remark: { type: DataTypes.TEXT, defaultValue: '' },
  createdBy: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
}, { sequelize, tableName: 'leads', indexes: [{ fields: ['status'] }, { fields: ['source'] }, { fields: ['propertyId'] }] });

export default Lead;
