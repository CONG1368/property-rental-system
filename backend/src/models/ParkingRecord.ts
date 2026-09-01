import { DataTypes, Optional } from 'sequelize';
import { BaseModel } from './BaseModel.js';
import { sequelize } from '../config/database.js';

interface ParkingRecordAttributes {
  id: number; spaceId: number; tenantId: number | null; plateNumber: string;
  type: '临停' | '月租'; amount: number; startTime: Date; endTime: Date | null;
  status: '进行中' | '已结束' | '已支付'; notes: string;
  createdAt?: Date; updatedAt?: Date;
}
type PRecordCreation = Optional<ParkingRecordAttributes, 'id' | 'createdAt' | 'updatedAt'>;
class ParkingRecord extends BaseModel<ParkingRecordAttributes, PRecordCreation> {}
ParkingRecord.init({
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  spaceId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  tenantId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  plateNumber: { type: DataTypes.STRING(20), allowNull: false },
  type: { type: DataTypes.ENUM('临停', '月租'), allowNull: false, defaultValue: '临停' },
  amount: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  startTime: { type: DataTypes.DATE, allowNull: false },
  endTime: { type: DataTypes.DATE, allowNull: true },
  status: { type: DataTypes.ENUM('进行中', '已结束', '已支付'), allowNull: false, defaultValue: '进行中' },
  notes: { type: DataTypes.TEXT, defaultValue: '' },
}, { sequelize, tableName: 'parking_records', indexes: [{ fields: ['spaceId'] }, { fields: ['status'] }] });
export default ParkingRecord;
