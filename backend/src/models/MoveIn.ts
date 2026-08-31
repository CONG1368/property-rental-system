import { DataTypes, Optional } from 'sequelize';
import { BaseModel } from './BaseModel.js';
import { sequelize } from '../config/database.js';

interface MoveInAttributes {
  id: number;
  contractId: number;
  tenantId: number;
  propertyId: number;
  moveInDate: string | null;
  depositAmount: number;
  checkItems: { item: string; checked: boolean; value: string }[];
  status: '待交接' | '已完成';
  notes: string;
  createdBy: number | null;
  createdAt?: Date; updatedAt?: Date;
}
type MoveInCreation = Optional<MoveInAttributes, 'id' | 'createdAt' | 'updatedAt'>;

class MoveIn extends BaseModel<MoveInAttributes, MoveInCreation> {}

MoveIn.init({
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  contractId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  tenantId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  propertyId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  moveInDate: { type: DataTypes.DATEONLY, allowNull: true },
  depositAmount: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  checkItems: { type: DataTypes.JSON, defaultValue: [] },
  status: { type: DataTypes.ENUM('待交接', '已完成'), allowNull: false, defaultValue: '待交接' },
  notes: { type: DataTypes.TEXT, defaultValue: '' },
  createdBy: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
}, { sequelize, tableName: 'move_ins', indexes: [{ fields: ['contractId'] }, { fields: ['tenantId'] }, { fields: ['propertyId'] }, { fields: ['status'] }] });

export default MoveIn;
