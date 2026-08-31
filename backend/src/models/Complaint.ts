import { DataTypes, Optional } from 'sequelize';
import { BaseModel } from './BaseModel.js';
import { sequelize } from '../config/database.js';

interface ComplaintAttributes {
  id: number; propertyId: number | null; tenantId: number | null;
  title: string; type: '投诉' | '建议' | '咨询' | '表扬';
  channel: '电话' | '线上' | '前台' | '其他';
  content: string; reporter: string; phone: string;
  status: '待受理' | '处理中' | '已回复' | '已解决' | '已关闭';
  assignee: string; response: string; responseAt: Date | null;
  satisfaction: number | null; createdAt?: Date; updatedAt?: Date;
}
type ComplaintCreation = Optional<ComplaintAttributes, 'id' | 'createdAt' | 'updatedAt'>;
class Complaint extends BaseModel<ComplaintAttributes, ComplaintCreation> {}
Complaint.init({
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  propertyId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  tenantId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  title: { type: DataTypes.STRING(100), allowNull: false },
  type: { type: DataTypes.ENUM('投诉', '建议', '咨询', '表扬'), allowNull: false, defaultValue: '投诉' },
  channel: { type: DataTypes.ENUM('电话', '线上', '前台', '其他'), allowNull: false, defaultValue: '电话' },
  content: { type: DataTypes.TEXT, defaultValue: '' },
  reporter: { type: DataTypes.STRING(50), defaultValue: '' },
  phone: { type: DataTypes.STRING(20), defaultValue: '' },
  status: { type: DataTypes.ENUM('待受理', '处理中', '已回复', '已解决', '已关闭'), allowNull: false, defaultValue: '待受理' },
  assignee: { type: DataTypes.STRING(50), defaultValue: '' },
  response: { type: DataTypes.TEXT, defaultValue: '' },
  responseAt: { type: DataTypes.DATE, allowNull: true },
  satisfaction: { type: DataTypes.INTEGER, allowNull: true },
}, { sequelize, tableName: 'complaints', indexes: [{ fields: ['propertyId'] }, { fields: ['status'] }, { fields: ['type'] }] });
export default Complaint;
