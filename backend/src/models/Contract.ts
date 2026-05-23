import { DataTypes, Optional } from 'sequelize';
import { BaseModel } from './BaseModel.js';
import { sequelize } from '../config/database.js';

interface ContractAttributes {
  id: number; contractNo: string; propertyId: number; tenantId: number;
  templateId: number | null; startDate: Date; endDate: Date;
  rentAmount: number; depositAmount: number;
  paymentCycle: '月'|'季'|'半年'|'年'|'两年'|'三年'|'五年'; billingMode: '固定'|'阶梯'|'抽成';
  billingConfig: object; clauses: { title: string; content: string; sortOrder: number }[];
  status: '起草中'|'审批中'|'已驳回'|'已签订'|'执行中'|'到期提醒'|'已到期'|'已终止';
  signedAt: Date | null; createdBy: number | null;
  createdAt?: Date; updatedAt?: Date;
}

type ContractCreationAttributes = Optional<ContractAttributes, 'id' | 'createdAt' | 'updatedAt'>;

class Contract extends BaseModel<ContractAttributes, ContractCreationAttributes> {
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
  paymentCycle: { type: DataTypes.ENUM('月','季','半年','年','两年','三年','五年'), defaultValue: '月' },
  billingMode: { type: DataTypes.ENUM('固定','阶梯','抽成'), defaultValue: '固定' },
  billingConfig: { type: DataTypes.JSON, defaultValue: {} },
  status: { type: DataTypes.ENUM('起草中','审批中','已驳回','已签订','执行中','到期提醒','已到期','已终止'), defaultValue: '起草中' },
  signedAt: { type: DataTypes.DATE, allowNull: true },
  createdBy: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  clauses: { type: DataTypes.JSON, defaultValue: [] },
}, { sequelize, tableName: 'contracts', indexes: [{ fields: ['contractNo'] }, { fields: ['status'] }, { fields: ['propertyId'] }, { fields: ['tenantId'] }] });

export default Contract;
