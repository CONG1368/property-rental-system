import { DataTypes } from 'sequelize';
import { BaseModel } from './BaseModel.js';
import { sequelize } from '../config/database';

class DictType extends BaseModel {
}
DictType.init({
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  code: { type: DataTypes.STRING(50), allowNull: false, unique: true },
  name: { type: DataTypes.STRING(100), allowNull: false },
}, { sequelize, tableName: 'dict_types' });
export default DictType;
