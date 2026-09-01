import { DataTypes, Optional } from 'sequelize';
import { BaseModel } from './BaseModel.js';
import { sequelize } from '../config/database.js';

interface ProjectAttributes {
  id: number; name: string; code: string;
  type: '产业园' | '写字楼' | '住宅' | '商业综合体' | '厂房' | '公寓';
  address: string; managerName: string; managerPhone: string;
  status: '运营中' | '筹备中' | '已停用';
  startDate: string | null; notes: string;
  createdAt?: Date; updatedAt?: Date;
}
type ProjectCreation = Optional<ProjectAttributes, 'id' | 'createdAt' | 'updatedAt'>;
class Project extends BaseModel<ProjectAttributes, ProjectCreation> {}
Project.init({
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  name: { type: DataTypes.STRING(100), allowNull: false },
  code: { type: DataTypes.STRING(50), defaultValue: '' },
  type: { type: DataTypes.ENUM('产业园', '写字楼', '住宅', '商业综合体', '厂房', '公寓'), allowNull: false, defaultValue: '产业园' },
  address: { type: DataTypes.STRING(255), defaultValue: '' },
  managerName: { type: DataTypes.STRING(50), defaultValue: '' },
  managerPhone: { type: DataTypes.STRING(20), defaultValue: '' },
  status: { type: DataTypes.ENUM('运营中', '筹备中', '已停用'), allowNull: false, defaultValue: '运营中' },
  startDate: { type: DataTypes.DATEONLY, allowNull: true },
  notes: { type: DataTypes.TEXT, defaultValue: '' },
}, { sequelize, tableName: 'projects', indexes: [{ fields: ['name'] }, { fields: ['type'] }, { fields: ['status'] }] });
export default Project;
