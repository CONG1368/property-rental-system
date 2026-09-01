import { DataTypes, Optional } from 'sequelize';
import { BaseModel } from './BaseModel.js';
import { sequelize } from '../config/database.js';

interface ApprovalRequestAttributes {
  id: number; bizType: string; bizId: number | null; bizNo: string; title: string;
  applicantId: number | null; applicantName: string; amount: number;
  status: '待审批' | '审批中' | '已通过' | '已驳回';
  currentStep: number; currentRole: string;
  comment: string; createdAt?: Date; updatedAt?: Date;
}
type ARCreation = Optional<ApprovalRequestAttributes, 'id' | 'createdAt' | 'updatedAt'>;
class ApprovalRequest extends BaseModel<ApprovalRequestAttributes, ARCreation> {}
ApprovalRequest.init({
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  bizType: { type: DataTypes.STRING(50), allowNull: false },
  bizId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  bizNo: { type: DataTypes.STRING(60), defaultValue: '' },
  title: { type: DataTypes.STRING(160), allowNull: false },
  applicantId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  applicantName: { type: DataTypes.STRING(50), defaultValue: '' },
  amount: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  status: { type: DataTypes.ENUM('待审批', '审批中', '已通过', '已驳回'), allowNull: false, defaultValue: '待审批' },
  currentStep: { type: DataTypes.INTEGER, defaultValue: 0 },
  currentRole: { type: DataTypes.STRING(50), defaultValue: '' },
  comment: { type: DataTypes.TEXT, defaultValue: '' },
}, { sequelize, tableName: 'approval_requests', indexes: [{ fields: ['bizType'] }, { fields: ['status'] }, { fields: ['currentRole'] }, { fields: ['applicantId'] }] });
export default ApprovalRequest;
