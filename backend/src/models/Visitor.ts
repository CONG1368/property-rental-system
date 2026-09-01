import { DataTypes, Optional } from 'sequelize';
import { BaseModel } from './BaseModel.js';
import { sequelize } from '../config/database.js';

interface VisitorAttributes {
  id: number; name: string; idNumber: string; phone: string;
  visitTarget: string; purpose: string; plateNumber: string;
  visitTime: Date; leaveTime: Date | null;
  status: '在访' | '已离开'; notes: string;
  createdAt?: Date; updatedAt?: Date;
}
type VisitorCreation = Optional<VisitorAttributes, 'id' | 'createdAt' | 'updatedAt'>;

class Visitor extends BaseModel<VisitorAttributes, VisitorCreation> {}

Visitor.init({
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  name: { type: DataTypes.STRING(50), allowNull: false },
  idNumber: { type: DataTypes.STRING(30), defaultValue: '' },
  phone: { type: DataTypes.STRING(20), defaultValue: '' },
  visitTarget: { type: DataTypes.STRING(100), defaultValue: '' },
  purpose: { type: DataTypes.STRING(100), defaultValue: '' },
  plateNumber: { type: DataTypes.STRING(20), defaultValue: '' },
  visitTime: { type: DataTypes.DATEONLY, allowNull: false },
  leaveTime: { type: DataTypes.DATEONLY, allowNull: true },
  status: { type: DataTypes.ENUM('在访', '已离开'), allowNull: false, defaultValue: '在访' },
  notes: { type: DataTypes.TEXT, defaultValue: '' },
}, { sequelize, tableName: 'visitors', indexes: [{ fields: ['visitTime'] }, { fields: ['status'] }] });

export default Visitor;
