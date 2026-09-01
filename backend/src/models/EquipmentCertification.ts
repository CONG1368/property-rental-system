import { DataTypes, Optional } from 'sequelize';
import { BaseModel } from './BaseModel.js';
import { sequelize } from '../config/database.js';

interface EquipmentCertificationAttributes {
  id: number;
  equipmentName: string;
  category: string;
  certNo: string;
  inspectionDate: Date | null;
  nextInspectionDate: Date | null;
  status: string;
  agency: string;
  notes: string;
  createdAt?: Date;
}
type EquipmentCertificationCreation = Optional<EquipmentCertificationAttributes, 'id' | 'createdAt'>;

class EquipmentCertification extends BaseModel<EquipmentCertificationAttributes, EquipmentCertificationCreation> {}

EquipmentCertification.init({
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  equipmentName: { type: DataTypes.STRING(100), allowNull: false },
  category: { type: DataTypes.ENUM('电梯', '锅炉', '压力容器', '起重机械', '其他'), allowNull: false, defaultValue: '电梯' },
  certNo: { type: DataTypes.STRING(50), defaultValue: '' },
  inspectionDate: { type: DataTypes.DATEONLY, allowNull: true },
  nextInspectionDate: { type: DataTypes.DATEONLY, allowNull: true },
  status: { type: DataTypes.ENUM('合格', '不合格', '待检', '过期'), allowNull: false, defaultValue: '待检' },
  agency: { type: DataTypes.STRING(100), defaultValue: '' },
  notes: { type: DataTypes.TEXT, defaultValue: '' },
}, {
  sequelize,
  tableName: 'equipment_certifications',
  updatedAt: false,
  indexes: [
    { fields: ['category'] },
    { fields: ['status'] },
    { fields: ['nextInspectionDate'] },
  ],
});

export default EquipmentCertification;
