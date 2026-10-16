import { DataTypes, Optional } from 'sequelize';
import { BaseModel } from './BaseModel.js';
import { sequelize } from '../config/database.js';

/**
 * 常用附件组（用户 2026-10-16 要求：附件除了逐个上传，还要更便捷、可自定义的方案）。
 * 一个组 = 一份「这类合同通常要附哪些材料」的清单（如公寓标准附件包），
 * 应用到合同时写入 billingConfig.attachmentChecklist，起草页/详情页据此提示「还缺哪几件」。
 * 新表由 sequelize.sync() 直接创建，无需迁移条目。
 */
interface AttachmentGroupAttributes {
  id: number;
  name: string;         // 组名，如「公寓标准附件包」
  scope: string;        // 适用业态：全部 / 公寓 / 厂房 / 商铺
  description: string;
  items: any;           // [{ title, required, note }]
  sortOrder: number;
  isBuiltIn: number;    // 1 = 内置（可改不可删）
  createdAt?: Date; updatedAt?: Date;
}
type GroupCreation = Optional<AttachmentGroupAttributes, 'id' | 'createdAt' | 'updatedAt'>;
class AttachmentGroup extends BaseModel<AttachmentGroupAttributes, GroupCreation> {}
AttachmentGroup.init({
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  name: { type: DataTypes.STRING(100), allowNull: false },
  scope: { type: DataTypes.STRING(20), defaultValue: '全部' },
  description: { type: DataTypes.STRING(255), defaultValue: '' },
  items: { type: DataTypes.JSON, defaultValue: [] },
  sortOrder: { type: DataTypes.INTEGER, defaultValue: 0 },
  isBuiltIn: { type: DataTypes.INTEGER, defaultValue: 0 },
}, { sequelize, tableName: 'attachment_groups', indexes: [{ fields: ['scope'] }] })
export default AttachmentGroup;
