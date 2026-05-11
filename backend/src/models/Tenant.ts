import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

interface TenantAttributes {
  id: number; name: string; idType: '身份证'|'营业执照'|'护照'; idNumber: string;
  phone: string; email: string; wechat: string; contactPerson: string;
  creditScore: number; creditGrade: 'A'|'B'|'C'|'D';
  status: '待入住'|'在租中'|'已退租'; attachments: object; notes: string;
  createdAt?: Date; updatedAt?: Date;
}

type TenantCreationAttributes = Optional<TenantAttributes, 'id' | 'createdAt' | 'updatedAt'>;

class Tenant extends Model<TenantAttributes, TenantCreationAttributes> implements TenantAttributes {
}

Tenant.init({
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  name: { type: DataTypes.STRING(100), allowNull: false },
  idType: { type: DataTypes.ENUM('身份证','营业执照','护照'), allowNull: false },
  idNumber: { type: DataTypes.STRING(50), allowNull: false },
  phone: { type: DataTypes.STRING(20), defaultValue: '' },
  email: { type: DataTypes.STRING(100), defaultValue: '' },
  wechat: { type: DataTypes.STRING(50), defaultValue: '' },
  contactPerson: { type: DataTypes.STRING(50), defaultValue: '' },
  creditScore: { type: DataTypes.INTEGER, defaultValue: 60 },
  creditGrade: { type: DataTypes.ENUM('A','B','C','D'), defaultValue: 'C' },
  status: { type: DataTypes.ENUM('待入住','在租中','已退租'), defaultValue: '待入住' },
  attachments: { type: DataTypes.JSON, defaultValue: {} },
  notes: { type: DataTypes.TEXT, defaultValue: '' },
}, { sequelize, tableName: 'tenants', indexes: [{ fields: ['phone'] }, { fields: ['creditGrade'] }, { fields: ['name'] }] });

export default Tenant;
