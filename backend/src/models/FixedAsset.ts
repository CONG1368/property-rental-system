import { DataTypes, Optional } from 'sequelize';
import { BaseModel } from './BaseModel.js';
import { sequelize } from '../config/database';

interface FixedAssetAttributes {
  id: number; bookId: number; name: string; category: string;
  originalValue: number; residualValue: number; usefulMonths: number;
  monthlyDepreciation: number; accumulatedDepreciation: number;
  startDate: Date; status: string;
  createdAt?: Date; updatedAt?: Date;
}
type FACreation = Optional<FixedAssetAttributes, 'id'|'createdAt'|'updatedAt'>;
class FixedAsset extends BaseModel<FixedAssetAttributes, FACreation> {
}
FixedAsset.init({
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  bookId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  name: { type: DataTypes.STRING(100), allowNull: false },
  category: { type: DataTypes.STRING(50), defaultValue: '' },
  originalValue: { type: DataTypes.DECIMAL(12,2), allowNull: false },
  residualValue: { type: DataTypes.DECIMAL(12,2), defaultValue: 0 },
  usefulMonths: { type: DataTypes.INTEGER, allowNull: false },
  monthlyDepreciation: { type: DataTypes.DECIMAL(12,2), defaultValue: 0 },
  accumulatedDepreciation: { type: DataTypes.DECIMAL(12,2), defaultValue: 0 },
  startDate: { type: DataTypes.DATEONLY, allowNull: false },
  status: { type: DataTypes.STRING(20), defaultValue: '使用中' },
}, { sequelize, tableName: 'fixed_assets', indexes: [{fields:['bookId']},{fields:['status']}] });
export default FixedAsset;
