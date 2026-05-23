import { DataTypes, Optional } from 'sequelize';
import { BaseModel } from './BaseModel.js';
import { sequelize } from '../config/database.js';

interface IdCardReaderAttributes {
  id: number;
  name: string;
  brand: '华视' | '新中新' | '普天' | '精伦' | '中控' | '其他';
  model: string;
  interfaceType: 'USB' | '串口' | '蓝牙' | 'WiFi';
  port: string;
  status: '在线' | '离线' | '故障' | '未激活';
  lastReadAt: Date | null;
  firmwareVersion: string;
  createdAt?: Date;
  updatedAt?: Date;
}

type IdCardReaderCreationAttributes = Optional<IdCardReaderAttributes, 'id' | 'createdAt' | 'updatedAt'>;

class IdCardReader extends BaseModel<IdCardReaderAttributes, IdCardReaderCreationAttributes> {}

IdCardReader.init({
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  name: { type: DataTypes.STRING(100), allowNull: false },
  brand: { type: DataTypes.ENUM('华视', '新中新', '普天', '精伦', '中控', '其他'), allowNull: false },
  model: { type: DataTypes.STRING(50), defaultValue: '' },
  interfaceType: { type: DataTypes.ENUM('USB', '串口', '蓝牙', 'WiFi'), defaultValue: 'USB' },
  port: { type: DataTypes.STRING(50), defaultValue: '' },
  status: { type: DataTypes.ENUM('在线', '离线', '故障', '未激活'), defaultValue: '未激活' },
  lastReadAt: { type: DataTypes.DATE, allowNull: true },
  firmwareVersion: { type: DataTypes.STRING(30), defaultValue: '' },
}, {
  sequelize,
  tableName: 'id_card_readers',
  indexes: [{ fields: ['status'] }, { fields: ['brand'] }],
});

export default IdCardReader;
