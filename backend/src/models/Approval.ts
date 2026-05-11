import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

interface ApprovalAttributes {
  id: number; contractId: number; nodeName: string; approverId: number;
  status: '待审批'|'已通过'|'已驳回'|'已转审'; opinion: string;
  approvedAt: Date | null; createdAt?: Date; updatedAt?: Date;
}
type ACreation = Optional<ApprovalAttributes, 'id'|'createdAt'|'updatedAt'>;
class Approval extends Model<ApprovalAttributes, ACreation> implements ApprovalAttributes {
}
Approval.init({
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  contractId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  nodeName: { type: DataTypes.STRING(50), allowNull: false },
  approverId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  status: { type: DataTypes.ENUM('待审批','已通过','已驳回','已转审'), defaultValue: '待审批' },
  opinion: { type: DataTypes.TEXT, defaultValue: '' },
  approvedAt: { type: DataTypes.DATE, allowNull: true },
}, { sequelize, tableName: 'approvals', indexes: [{fields:['contractId']},{fields:['approverId']},{fields:['status']}] });
export default Approval;
