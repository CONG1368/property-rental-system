import { DataTypes, Optional } from 'sequelize';
import { BaseModel } from './BaseModel.js';
import { sequelize } from '../config/database.js';

interface TenantAttributes {
  // 证件类型/证件号/手机号为选填（用户 2026-10-10 要求）：不填即空串
  id: number; name: string; idType: string; idNumber: string;
  phone: string; email: string; wechat: string; contactPerson: string;
  creditScore: number; creditGrade: 'A'|'B'|'C'|'D';
  status: '待入住'|'在租中'|'已退租'; attachments: object; notes: string;
  gender: string; birthDate: string; ethnicity: string;
  idAddress: string; idIssuingAuthority: string;
  idValidFrom: string; idValidTo: string;
  idPhoto: string;
  pendingClauses?: { title: string; content: string; sortOrder: number }[];
  loginPin: string;
  createdAt?: Date; updatedAt?: Date;
}

type TenantCreationAttributes = Optional<TenantAttributes, 'id' | 'loginPin' | 'createdAt' | 'updatedAt'>;

class Tenant extends BaseModel<TenantAttributes, TenantCreationAttributes> {
}

Tenant.init({
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  name: { type: DataTypes.STRING(100), allowNull: false },
  // 证件类型改为普通字符串：允许留空（默认空串），不再强绑「身份证」枚举与 NOT NULL
  idType: { type: DataTypes.STRING(20), defaultValue: '' },
  idNumber: { type: DataTypes.STRING(50), defaultValue: '' },
  phone: { type: DataTypes.STRING(20), defaultValue: '' },
  email: { type: DataTypes.STRING(100), defaultValue: '' },
  wechat: { type: DataTypes.STRING(50), defaultValue: '' },
  contactPerson: { type: DataTypes.STRING(50), defaultValue: '' },
  creditScore: { type: DataTypes.INTEGER, defaultValue: 60 },
  creditGrade: { type: DataTypes.ENUM('A','B','C','D'), defaultValue: 'C' },
  status: { type: DataTypes.ENUM('待入住','在租中','已退租'), defaultValue: '待入住' },
  attachments: { type: DataTypes.JSON, defaultValue: {} },
  notes: { type: DataTypes.TEXT, defaultValue: '' },
  gender: { type: DataTypes.STRING(10), defaultValue: '' },
  birthDate: { type: DataTypes.STRING(10), defaultValue: '' },
  ethnicity: { type: DataTypes.STRING(20), defaultValue: '' },
  idAddress: { type: DataTypes.STRING(200), defaultValue: '' },
  idIssuingAuthority: { type: DataTypes.STRING(100), defaultValue: '' },
  idValidFrom: { type: DataTypes.STRING(10), defaultValue: '' },
  idValidTo: { type: DataTypes.STRING(10), defaultValue: '' },
  idPhoto: { type: DataTypes.TEXT, defaultValue: '' },
  pendingClauses: { type: DataTypes.JSON, defaultValue: [] },
  loginPin: { type: DataTypes.STRING(6), defaultValue: '' },
}, { sequelize, tableName: 'tenants', indexes: [{ fields: ['phone'] }, { fields: ['creditGrade'] }, { fields: ['name'] }] });

export default Tenant;
