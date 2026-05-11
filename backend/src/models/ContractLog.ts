import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

interface ContractLogAttributes {
  id: number; contractId: number; action: string; oldStatus: string;
  newStatus: string; operatorId: number; notes: string; createdAt?: Date;
}
type CLCreation = Optional<ContractLogAttributes, 'id'|'createdAt'>;
class ContractLog extends Model<ContractLogAttributes, CLCreation> implements ContractLogAttributes {
}
ContractLog.init({
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  contractId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  action: { type: DataTypes.STRING(50), allowNull: false },
  oldStatus: { type: DataTypes.STRING(20), defaultValue: '' },
  newStatus: { type: DataTypes.STRING(20), defaultValue: '' },
  operatorId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  notes: { type: DataTypes.TEXT, defaultValue: '' },
}, { sequelize, tableName: 'contract_logs', updatedAt: false, indexes: [{fields:['contractId']},{fields:['createdAt']}] });
export default ContractLog;
