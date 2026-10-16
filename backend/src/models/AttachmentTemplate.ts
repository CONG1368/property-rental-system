import { DataTypes, Optional } from 'sequelize';
import { BaseModel } from './BaseModel.js';
import { sequelize } from '../config/database.js';

/**
 * 附件单据模板（用户 2026-10-16：附件便捷化第 ①②③ 项）。
 * 一份模板＝一张可一键生成的单据（房屋交接单/消防安全责任书/押金收据…）或一份系统记录导出
 * （消防器材台账/账单明细…）。文档标题、字段、条款都可含占位符（${tenantName} 等），
 * 由前端用合同/租客/房源数据渲染成 Word 后直接作为附件上传——不需要用户自己找文件、扫描。
 * 新表由 sequelize.sync() 直接创建，无需迁移条目。
 */
interface AttachmentTemplateAttributes {
  id: number;
  name: string;         // 模板名，如「房屋交接单」
  category: string;     // 标准单据 / 系统记录 / 自定义
  scope: string;        // 适用业态：全部 / 公寓 / 厂房 / 商铺
  description: string;
  docTitle: string;     // 文档标题（可含占位符）
  intro: string;        // 开头说明（可含占位符）
  fields: any;          // [{ label, value }]，value 可含占位符
  clauses: any;         // 条款段落（可含占位符）
  signatures: any;      // [{ label, name }]，如 甲方/乙方
  dataSource: string;   // 系统记录数据源键（空=普通单据）：fire-equipment / bills / contract-clauses
  tableColumns: any;    // 系统记录表格列 [{ key, label }]
  sortOrder: number;
  isBuiltIn: number;
  createdAt?: Date; updatedAt?: Date;
}
type TemplateCreation = Optional<AttachmentTemplateAttributes, 'id' | 'createdAt' | 'updatedAt'>;
class AttachmentTemplate extends BaseModel<AttachmentTemplateAttributes, TemplateCreation> {}
AttachmentTemplate.init({
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  name: { type: DataTypes.STRING(100), allowNull: false },
  category: { type: DataTypes.STRING(20), defaultValue: '标准单据' },
  scope: { type: DataTypes.STRING(20), defaultValue: '全部' },
  description: { type: DataTypes.STRING(255), defaultValue: '' },
  docTitle: { type: DataTypes.STRING(120), defaultValue: '' },
  intro: { type: DataTypes.TEXT, defaultValue: '' },
  fields: { type: DataTypes.JSON, defaultValue: [] },
  clauses: { type: DataTypes.JSON, defaultValue: [] },
  signatures: { type: DataTypes.JSON, defaultValue: [] },
  dataSource: { type: DataTypes.STRING(40), defaultValue: '' },
  tableColumns: { type: DataTypes.JSON, defaultValue: [] },
  sortOrder: { type: DataTypes.INTEGER, defaultValue: 100 },
  isBuiltIn: { type: DataTypes.INTEGER, defaultValue: 0 },
}, { sequelize, tableName: 'attachment_templates', indexes: [{ fields: ['category'] }, { fields: ['scope'] }] })
export default AttachmentTemplate;
