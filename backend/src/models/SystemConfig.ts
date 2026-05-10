import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';

class SystemConfig extends Model {
  public id!: number; public configKey!: string; public configValue!: string;
  public description!: string;
}
SystemConfig.init({
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  configKey: { type: DataTypes.STRING(50), allowNull: false, unique: true },
  configValue: { type: DataTypes.TEXT, defaultValue: '' },
  description: { type: DataTypes.STRING(200), defaultValue: '' },
}, { sequelize, tableName: 'system_configs' });
export default SystemConfig;
