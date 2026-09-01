import { DataTypes } from 'sequelize';
import { BaseModel } from './BaseModel.js';
import { sequelize } from '../config/database.js';

class SystemConfig extends BaseModel {
}
SystemConfig.init({
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  configKey: { type: DataTypes.STRING(50), allowNull: false, unique: true },
  configValue: { type: DataTypes.TEXT, defaultValue: '' },
  description: { type: DataTypes.STRING(200), defaultValue: '' },
  // 系统参数中心扩展元数据
  configGroup: { type: DataTypes.STRING(50), defaultValue: '其他' }, // 分组：打印/业务/安全/其他
  valueType: { type: DataTypes.STRING(20), defaultValue: 'string' }, // string/number/boolean/json
  isSensitive: { type: DataTypes.BOOLEAN, defaultValue: false },     // 敏感值（调用端/审计脱敏）
  builtIn: { type: DataTypes.BOOLEAN, defaultValue: false },         // 内置项（不可删除标识）
  extra: { type: DataTypes.JSON, defaultValue: {} },
}, { sequelize, tableName: 'system_configs' });
export default SystemConfig;
