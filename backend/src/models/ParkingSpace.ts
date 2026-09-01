import { DataTypes, Optional } from 'sequelize';
import { BaseModel } from './BaseModel.js';
import { sequelize } from '../config/database.js';

interface ParkingSpaceAttributes {
  id: number; propertyId: number | null; spaceNo: string;
  location: '地面' | '地下' | '露天'; type: '月租' | '临停' | '专用' | '公共';
  status: '空闲' | '占用' | '月租' | '维修' | '停用';
  pricePerMonth: number; plateNumber: string; bindingTenantId: number | null;
  notes: string; createdAt?: Date; updatedAt?: Date;
}
type PSpaceCreation = Optional<ParkingSpaceAttributes, 'id' | 'createdAt' | 'updatedAt'>;
class ParkingSpace extends BaseModel<ParkingSpaceAttributes, PSpaceCreation> {}
ParkingSpace.init({
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  propertyId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  spaceNo: { type: DataTypes.STRING(50), allowNull: false },
  location: { type: DataTypes.ENUM('地面', '地下', '露天'), allowNull: false, defaultValue: '地面' },
  type: { type: DataTypes.ENUM('月租', '临停', '专用', '公共'), allowNull: false, defaultValue: '月租' },
  status: { type: DataTypes.ENUM('空闲', '占用', '月租', '维修', '停用'), allowNull: false, defaultValue: '空闲' },
  pricePerMonth: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  plateNumber: { type: DataTypes.STRING(20), defaultValue: '' },
  bindingTenantId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  notes: { type: DataTypes.TEXT, defaultValue: '' },
}, { sequelize, tableName: 'parking_spaces', indexes: [{ fields: ['propertyId'] }, { fields: ['spaceNo'] }, { fields: ['status'] }] });
export default ParkingSpace;
