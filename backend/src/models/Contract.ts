import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

interface ContractAttributes {
  id: number; contractNo: string; propertyId: number; tenantId: number;
  templateId: number | null; startDate: Date; endDate: Date;
  rentAmount: number; depositAmount: number;
  paymentCycle: '月'|'季'|'年'; billingMode: '固定'|'阶梯'|'抽成';
  billingConfig: object;
  status: '起草中'|'审批中'|'已驳回'|'已签订'|'执行中'|'到期提醒'|'已到期'|'已终止';
  signedAt: Date | null; createdBy: number | null;
  createdAt?: Date; updatedAt?: Date;
}

type ContractCreationAttributes = Optional<ContractAttributes, 'id' | 'createdAt' | 'updatedAt'>;

class Contract extends Model<ContractAttributes, ContractCreationAttributes> implements ContractAttributes {
  public id!: number; public contractNo!: string; public propertyId!: number;
  public tenantId!: number; public templateId!: number;
  public startDate!: Date; public endDate!: Date;
  public rentAmount!: number; public depositAmount!: number;
  public paymentCycle!: '月'|'季'|'年'; public billingMode!: '固定'|'阶梯'|'抽成';
  public billingConfig!: object;
  public status!: '起草中'|'审批中'|'已驳回'|'已签订'|'执行中'|'到期提醒'|'已到期'|'已终止';
  public signedAt!: Date; public createdBy!: number;
}

Contract.init({
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  contractNo: { type: DataTypes.STRING(50), allowNull: false, unique: true },
  propertyId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  tenantId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  templateId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  startDate: { type: DataTypes.DATEONLY, allowNull: false },
  endDate: { type: DataTypes.DATEONLY, allowNull: false },
  rentAmount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  depositAmount: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  paymentCycle: { type: DataTypes.ENUM('月','季','年'), defaultValue: '月' },
  billingMode: { type: DataTypes.ENUM('固定','阶梯','抽成'), defaultValue: '固定' },
  billingConfig: { type: DataTypes.JSON, defaultValue: {} },
  status: { type: DataTypes.ENUM('起草中','审批中','已驳回','已签订','执行中','到期提醒','已到期','已终止'), defaultValue: '起草中' },
  signedAt: { type: DataTypes.DATE, allowNull: true },
  createdBy: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
}, { sequelize, tableName: 'contracts', indexes: [{ fields: ['contractNo'] }, { fields: ['status'] }, { fields: ['propertyId'] }, { fields: ['tenantId'] }] });

export default Contract;
