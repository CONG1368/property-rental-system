import { DataTypes, Optional } from 'sequelize';
import { BaseModel } from './BaseModel.js';
import { sequelize } from '../config/database.js';

interface MeterPlatformLinkAttributes {
  id: number; platformDeviceId: string; meterNo: string; meterId: number | null;
  linkStatus: 'linked' | 'pending'; platformReading: number; syncedAt: Date | null; mappedBy: number | null;
  createdAt?: Date; updatedAt?: Date;
}
type Creation = Optional<MeterPlatformLinkAttributes, 'id' | 'createdAt' | 'updatedAt'>;
class MeterPlatformLink extends BaseModel<MeterPlatformLinkAttributes, Creation> {}
MeterPlatformLink.init({
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  platformDeviceId: { type: DataTypes.STRING(64), allowNull: false, unique: true },
  meterNo: { type: DataTypes.STRING(50), allowNull: false },
  meterId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  linkStatus: { type: DataTypes.ENUM('linked', 'pending'), defaultValue: 'pending' },
  platformReading: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  syncedAt: { type: DataTypes.DATE, allowNull: true },
  mappedBy: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
}, { sequelize, tableName: 'meter_platform_links', indexes: [{ fields: ['meterNo'] }, { fields: ['meterId'] }, { fields: ['linkStatus'] }] });
export default MeterPlatformLink;
