import { DataTypes, Optional } from 'sequelize';
import { BaseModel } from './BaseModel.js';
import { sequelize } from '../config/database.js';

/**
 * 合同条款修订记录（用户 2026-10-11 要求）：
 * 用户上传租户回传的修订版合同后，系统自动拆条比对并存一条记录，
 * 在合同详情页提示「租户改了哪些内容」，用户可逐条查看差异后一键应用到合同。
 * 新表由 sequelize.sync() 直接创建，无需迁移条目。
 */
interface ContractClauseRevisionAttributes {
  id: number; contractId: number;
  sourceFileName: string;   // 上传的文件名
  sourceType: string;       // docx / doc / pdf
  clauseCount: number;      // 解析出的条款数
  addedCount: number; removedCount: number; modifiedCount: number;
  summary: string;          // 「新增 1 条、修改 2 条」
  details: any;             // 逐条提示数组
  diff: any;                // 完整比对结果（含片段级差异）
  parsedClauses: any;       // 上传文件解析出的条款（应用时写入合同）
  status: string;           // 待处理 / 已应用 / 已忽略
  uploadedBy: number | null;
  appliedBy: number | null;
  appliedAt: Date | null;
  notes: string;
  createdAt?: Date; updatedAt?: Date;
}
type RevisionCreation = Optional<ContractClauseRevisionAttributes, 'id' | 'createdAt' | 'updatedAt'>;
class ContractClauseRevision extends BaseModel<ContractClauseRevisionAttributes, RevisionCreation> {}
ContractClauseRevision.init({
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  contractId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  sourceFileName: { type: DataTypes.STRING(255), defaultValue: '' },
  sourceType: { type: DataTypes.STRING(20), defaultValue: '' },
  clauseCount: { type: DataTypes.INTEGER, defaultValue: 0 },
  addedCount: { type: DataTypes.INTEGER, defaultValue: 0 },
  removedCount: { type: DataTypes.INTEGER, defaultValue: 0 },
  modifiedCount: { type: DataTypes.INTEGER, defaultValue: 0 },
  summary: { type: DataTypes.TEXT, defaultValue: '' },
  details: { type: DataTypes.JSON, defaultValue: [] },
  diff: { type: DataTypes.JSON, defaultValue: {} },
  parsedClauses: { type: DataTypes.JSON, defaultValue: [] },
  status: { type: DataTypes.STRING(10), defaultValue: '待处理' },
  uploadedBy: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  appliedBy: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  appliedAt: { type: DataTypes.DATE, allowNull: true },
  notes: { type: DataTypes.TEXT, defaultValue: '' },
}, { sequelize, tableName: 'contract_clause_revisions', indexes: [{ fields: ['contractId'] }, { fields: ['status'] }] });
export default ContractClauseRevision;
