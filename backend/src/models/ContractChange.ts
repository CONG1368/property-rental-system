import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

interface ContractChangeAttributes {
  id: number; contractId: number; changeType: '租金调整'|'租期变更'|'提前退租'|'条款补充';
  beforeData: object; afterData: object; reason: string;
  status: '审批中'|'已通过'|'已驳回'; createdBy: number; approvedBy: number | null;
  createdAt?: Date; updatedAt?: Date;
}
type CHCreation = Optional<ContractChangeAttributes, 'id'|'createdAt'|'updatedAt'>;
class ContractChange extends Model<ContractChangeAttributes, CHCreation> implements ContractChangeAttributes {
}
ContractChange.init({
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  contractId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  changeType: { type: DataTypes.ENUM('租金调整','租期变更','提前退租','条款补充'), allowNull: false },
  beforeData: { type: DataTypes.JSON, defaultValue: {} },
  afterData: { type: DataTypes.JSON, defaultValue: {} },
  reason: { type: DataTypes.TEXT, defaultValue: '' },
  status: { type: DataTypes.ENUM('审批中','已通过','已驳回'), defaultValue: '审批中' },
  createdBy: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  approvedBy: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
}, { sequelize, tableName: 'contract_changes', indexes: [{fields:['contractId']},{fields:['status']}] });
export default ContractChange;
