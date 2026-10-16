import { DataTypes, Optional } from 'sequelize';
import { BaseModel } from './BaseModel.js';
import { sequelize } from '../config/database.js';

/**
 * 手机上传会话（用户 2026-10-16：附件便捷化第 ⑧ 项——手机扫码/打开链接直接上传到合同）。
 * 电脑端生成一次性 token 与局域网地址，手机在浏览器打开即可拍照或选文件上传，免装 App、免登录。
 * 新表由 sequelize.sync() 直接创建，无需迁移条目。
 */
interface AttachmentUploadSessionAttributes {
  id: number;
  token: string;
  contractId: number;
  createdBy: number | null;
  expiresAt: Date;
  status: string;      // 待上传 / 已上传 / 待审核 / 已过期
  mode: string;        // direct＝上传即挂到附件（现场业务员用）；review＝进待审核箱（租户自助上传，需审核）
  uploadedCount: number;
  files: any;          // [{ name, path, size, uploadedAt }]
  createdAt?: Date; updatedAt?: Date;
}
type SessionCreation = Optional<AttachmentUploadSessionAttributes, 'id' | 'createdAt' | 'updatedAt'>;
class AttachmentUploadSession extends BaseModel<AttachmentUploadSessionAttributes, SessionCreation> {}
AttachmentUploadSession.init({
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  token: { type: DataTypes.STRING(64), allowNull: false, unique: true },
  contractId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  createdBy: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  expiresAt: { type: DataTypes.DATE, allowNull: false },
  status: { type: DataTypes.STRING(10), defaultValue: '待上传' },
  mode: { type: DataTypes.STRING(10), defaultValue: 'direct' },
  uploadedCount: { type: DataTypes.INTEGER, defaultValue: 0 },
  files: { type: DataTypes.JSON, defaultValue: [] },
}, { sequelize, tableName: 'attachment_upload_sessions', indexes: [{ fields: ['token'] }, { fields: ['contractId'] }] })
export default AttachmentUploadSession;
