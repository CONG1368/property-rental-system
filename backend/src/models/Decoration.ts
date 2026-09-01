import { DataTypes, Optional } from 'sequelize';
import { BaseModel } from './BaseModel.js';
import { sequelize } from '../config/database.js';

interface DecorationAttributes {
  id: number; contractId: number | null; tenantId: number | null; propertyId: number | null;
  applicant: string; applyDate: Date | null;
  type: '装修' | '改造' | '安装';
  content: string; company: string;
  status: '待审批' | '审批中' | '已批准' | '已驳回' | '施工中' | '已完工' | '已验收';
  startDate: Date | null; endDate: Date | null;
  depositAmount: number; inspector: string; remark: string; createdBy: number | null;
  createdAt?: Date; updatedAt?: Date;
}
type DecorationCreation = Optional<DecorationAttributes, 'id' | 'createdAt' | 'updatedAt'>;

class Decoration extends BaseModel<DecorationAttributes, DecorationCreation> {}

Decoration.init({
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  contractId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  tenantId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  propertyId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  applicant: { type: DataTypes.STRING(100), allowNull: false },
  applyDate: { type: DataTypes.DATEONLY, allowNull: true },
  type: { type: DataTypes.ENUM('装修', '改造', '安装'), allowNull: false, defaultValue: '装修' },
  content: { type: DataTypes.TEXT, defaultValue: '' },
  company: { type: DataTypes.STRING(100), defaultValue: '' },
  status: { type: DataTypes.ENUM('待审批', '审批中', '已批准', '已驳回', '施工中', '已完工', '已验收'), allowNull: false, defaultValue: '待审批' },
  startDate: { type: DataTypes.DATEONLY, allowNull: true },
  endDate: { type: DataTypes.DATEONLY, allowNull: true },
  depositAmount: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  inspector: { type: DataTypes.STRING(50), defaultValue: '' },
  remark: { type: DataTypes.TEXT, defaultValue: '' },
  createdBy: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
}, { sequelize, tableName: 'decorations', indexes: [{ fields: ['status'] }, { fields: ['propertyId'] }, { fields: ['tenantId'] }] });

export default Decoration;
