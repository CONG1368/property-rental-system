import { DataTypes, Optional } from 'sequelize';
import { BaseModel } from './BaseModel.js';
import { sequelize } from '../config/database.js';

interface ResidentAttributes {
  id: number; propertyId: number | null; name: string;
  type: '业主' | '住户' | '家属';
  // 证件类型/证件号为选填（用户 2026-10-10 要求）：不填即空串，与租客档案口径一致
  idType: string; idNumber: string; phone: string;
  isOwner: boolean; relation: string; company: string; moveInDate: string | null;
  status: '在住' | '已搬离'; notes: string; createdAt?: Date; updatedAt?: Date;
}
type ResidentCreation = Optional<ResidentAttributes, 'id' | 'createdAt' | 'updatedAt'>;
class Resident extends BaseModel<ResidentAttributes, ResidentCreation> {}
Resident.init({
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  propertyId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  name: { type: DataTypes.STRING(100), allowNull: false },
  type: { type: DataTypes.ENUM('业主', '住户', '家属'), allowNull: false, defaultValue: '业主' },
  // 证件类型改为普通字符串：允许留空（默认空串），不再强绑「身份证」枚举与 NOT NULL
  idType: { type: DataTypes.STRING(20), defaultValue: '' },
  idNumber: { type: DataTypes.STRING(50), defaultValue: '' },
  phone: { type: DataTypes.STRING(20), defaultValue: '' },
  isOwner: { type: DataTypes.BOOLEAN, defaultValue: false },
  relation: { type: DataTypes.STRING(50), defaultValue: '' },
  company: { type: DataTypes.STRING(100), defaultValue: '' },
  moveInDate: { type: DataTypes.DATEONLY, allowNull: true },
  status: { type: DataTypes.ENUM('在住', '已搬离'), allowNull: false, defaultValue: '在住' },
  notes: { type: DataTypes.TEXT, defaultValue: '' },
}, { sequelize, tableName: 'residents', indexes: [{ fields: ['propertyId'] }, { fields: ['name'] }, { fields: ['status'] }] });
export default Resident;
