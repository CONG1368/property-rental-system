import { DataTypes, Optional } from 'sequelize';
import { BaseModel } from './BaseModel.js';
import { sequelize } from '../config/database.js';

interface PropertyTaskAttributes {
  id: number;
  type: string;
  area: string;
  frequency: string;
  assignee: string;
  scheduleDate: Date | null;
  status: string;
  result: string;
  qualityScore: number;
  inspector: string;
  remark: string;
  createdBy: number | null;
  createdAt?: Date;
  updatedAt?: Date;
}

type PropertyTaskCreation = Optional<PropertyTaskAttributes, 'id' | 'createdAt' | 'updatedAt'>;

class PropertyTask extends BaseModel<PropertyTaskAttributes, PropertyTaskCreation> {}

PropertyTask.init({
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  type: { type: DataTypes.ENUM('保洁', '绿化', '安保', '消杀'), allowNull: false, defaultValue: '保洁' },
  area: { type: DataTypes.STRING(100), allowNull: false },
  frequency: { type: DataTypes.ENUM('单次', '每日', '每周', '每月'), allowNull: false, defaultValue: '单次' },
  assignee: { type: DataTypes.STRING(50), defaultValue: '' },
  scheduleDate: { type: DataTypes.DATEONLY, allowNull: true },
  status: { type: DataTypes.ENUM('待执行', '进行中', '已完成', '已逾期'), allowNull: false, defaultValue: '待执行' },
  result: { type: DataTypes.ENUM('合格', '不合格', '待整改'), allowNull: false, defaultValue: '合格' },
  qualityScore: { type: DataTypes.INTEGER, defaultValue: 0 },
  inspector: { type: DataTypes.STRING(50), defaultValue: '' },
  remark: { type: DataTypes.TEXT, defaultValue: '' },
  createdBy: { type: DataTypes.INTEGER, allowNull: true },
}, {
  sequelize,
  tableName: 'property_tasks',
  indexes: [{ fields: ['type'] }, { fields: ['status'] }, { fields: ['assignee'] }],
});

export default PropertyTask;
