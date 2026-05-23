import { DataTypes, Optional } from 'sequelize';
import { BaseModel } from './BaseModel.js';
import { sequelize } from '../config/database.js';

interface IdCardReadLogAttributes {
  id: number;
  readerId: number | null;
  operatorId: number;
  method: '读卡器' | 'OCR';
  result: '成功' | '失败';
  idNumber: string;
  errorMessage: string;
  tenantId: number | null;
  createdAt?: Date;
}

type IdCardReadLogCreationAttributes = Optional<IdCardReadLogAttributes, 'id' | 'createdAt'>;

class IdCardReadLog extends BaseModel<IdCardReadLogAttributes, IdCardReadLogCreationAttributes> {}

IdCardReadLog.init({
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  readerId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  operatorId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  method: { type: DataTypes.ENUM('读卡器', 'OCR'), defaultValue: '读卡器' },
  result: { type: DataTypes.ENUM('成功', '失败'), allowNull: false },
  idNumber: { type: DataTypes.STRING(20), defaultValue: '' },
  errorMessage: { type: DataTypes.STRING(200), defaultValue: '' },
  tenantId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
}, {
  sequelize,
  tableName: 'id_card_read_logs',
  indexes: [{ fields: ['readerId'] }, { fields: ['operatorId'] }, { fields: ['result'] }],
  updatedAt: false,
});

export default IdCardReadLog;
