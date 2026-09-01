import { DataTypes, Optional } from 'sequelize';
import { BaseModel } from './BaseModel.js';
import { sequelize } from '../config/database.js';

interface ViewingAttributes {
  id: number;
  leadId: number;
  propertyId: number | null;
  viewingDate: Date;
  status: '已预约' | '已完成' | '已取消' | '爽约';
  notes: string;
  createdAt?: Date;
  updatedAt?: Date;
}
type ViewingCreation = Optional<ViewingAttributes, 'id' | 'propertyId' | 'createdAt' | 'updatedAt'>;

class Viewing extends BaseModel<ViewingAttributes, ViewingCreation> {}

Viewing.init({
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  leadId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  propertyId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  viewingDate: { type: DataTypes.DATEONLY, allowNull: false },
  status: { type: DataTypes.ENUM('已预约','已完成','已取消','爽约'), allowNull: false, defaultValue: '已预约' },
  notes: { type: DataTypes.TEXT, defaultValue: '' },
}, { sequelize, tableName: 'viewings', indexes: [{ fields: ['leadId'] }] });

export default Viewing;
