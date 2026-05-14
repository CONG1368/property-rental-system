import { DataTypes } from 'sequelize';
import { BaseModel } from './BaseModel.js';
import { sequelize } from '../config/database';

class DictItem extends BaseModel {
}
DictItem.init({
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  typeCode: { type: DataTypes.STRING(50), allowNull: false },
  code: { type: DataTypes.STRING(50), allowNull: false },
  name: { type: DataTypes.STRING(100), allowNull: false },
  sortOrder: { type: DataTypes.INTEGER, defaultValue: 0 },
  isEnabled: { type: DataTypes.BOOLEAN, defaultValue: true },
  extra: { type: DataTypes.JSON, defaultValue: {} },
}, { sequelize, tableName: 'dict_items', indexes: [{fields:['typeCode']}] });
export default DictItem;
