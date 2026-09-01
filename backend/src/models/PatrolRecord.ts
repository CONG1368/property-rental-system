import { DataTypes, Optional } from 'sequelize';
import { BaseModel } from './BaseModel.js';
import { sequelize } from '../config/database.js';

interface PatrolRecordAttributes {
  id: number; point: string; route: string;
  patrolDate: Date; patrolTime: string;
  status: '正常' | '异常'; notes: string; inspector: string;
  createdAt?: Date; updatedAt?: Date;
}
type PatrolRecordCreation = Optional<PatrolRecordAttributes, 'id' | 'createdAt' | 'updatedAt'>;

class PatrolRecord extends BaseModel<PatrolRecordAttributes, PatrolRecordCreation> {}

PatrolRecord.init({
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  point: { type: DataTypes.STRING(100), allowNull: false },
  route: { type: DataTypes.STRING(100), allowNull: false },
  patrolDate: { type: DataTypes.DATEONLY, allowNull: false },
  patrolTime: { type: DataTypes.STRING(20), allowNull: false },
  status: { type: DataTypes.ENUM('正常', '异常'), allowNull: false, defaultValue: '正常' },
  notes: { type: DataTypes.TEXT, defaultValue: '' },
  inspector: { type: DataTypes.STRING(50), defaultValue: '' },
}, { sequelize, tableName: 'patrol_records', indexes: [{ fields: ['patrolDate'] }, { fields: ['status'] }] });

export default PatrolRecord;
