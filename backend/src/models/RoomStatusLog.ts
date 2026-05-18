import { DataTypes, Optional } from 'sequelize';
import { BaseModel } from './BaseModel.js';
import { sequelize } from '../config/database.js';

interface RoomStatusLogAttributes {
  id: number;
  propertyId: number;
  oldStatus: string;
  newStatus: string;
  action: 'manual' | 'contract_link' | 'batch' | 'system';
  operatorId: number;
  notes: string;
  linkedContractId: number | null;
  linkedTenantId: number | null;
  createdAt?: Date;
}

type RSLCreation = Optional<RoomStatusLogAttributes, 'id' | 'createdAt'>;

class RoomStatusLog extends BaseModel<RoomStatusLogAttributes, RSLCreation> {}

RoomStatusLog.init({
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  propertyId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  oldStatus: { type: DataTypes.STRING(20), defaultValue: '' },
  newStatus: { type: DataTypes.STRING(20), defaultValue: '' },
  action: { type: DataTypes.STRING(20), allowNull: false },
  operatorId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  notes: { type: DataTypes.TEXT, defaultValue: '' },
  linkedContractId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  linkedTenantId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
}, {
  sequelize,
  tableName: 'room_status_logs',
  updatedAt: false,
  indexes: [
    { fields: ['propertyId'] },
    { fields: ['createdAt'] },
  ],
});

export default RoomStatusLog;
