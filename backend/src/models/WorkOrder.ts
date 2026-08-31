import { DataTypes, Optional } from 'sequelize';
import { BaseModel } from './BaseModel.js';
import { sequelize } from '../config/database.js';

interface WorkOrderAttributes {
  id: number;
  ticketNo: string;
  propertyId: number;
  tenantId: number;
  facilityId: number | null;
  title: string;
  type: '报修' | '维修' | '安装' | '保养' | '其他';
  priority: '紧急' | '高' | '中' | '低';
  status: '待派单' | '已派单' | '处理中' | '待验收' | '已完工' | '已取消';
  reporter: string;
  phone: string;
  description: string;
  images: any[];
  assigneeId: number | null;
  assigneeName: string;
  assignedAt: Date | null;
  finishedAt: Date | null;
  rating: number;
  solution: string;
  cost: number;
  remark: string;
  createdBy: number | null;
  createdAt?: Date; updatedAt?: Date;
}
type WorkOrderCreation = Optional<WorkOrderAttributes, 'id' | 'createdAt' | 'updatedAt'>;

class WorkOrder extends BaseModel<WorkOrderAttributes, WorkOrderCreation> {}

WorkOrder.init({
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  ticketNo: { type: DataTypes.STRING(50), allowNull: false, unique: true },
  propertyId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  tenantId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  facilityId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  title: { type: DataTypes.STRING(200), allowNull: false },
  type: { type: DataTypes.ENUM('报修', '维修', '安装', '保养', '其他'), allowNull: false, defaultValue: '报修' },
  priority: { type: DataTypes.ENUM('紧急', '高', '中', '低'), allowNull: false, defaultValue: '中' },
  status: { type: DataTypes.ENUM('待派单', '已派单', '处理中', '待验收', '已完工', '已取消'), allowNull: false, defaultValue: '待派单' },
  reporter: { type: DataTypes.STRING(50), defaultValue: '' },
  phone: { type: DataTypes.STRING(20), defaultValue: '' },
  description: { type: DataTypes.TEXT, defaultValue: '' },
  images: { type: DataTypes.JSON, defaultValue: [] },
  assigneeId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  assigneeName: { type: DataTypes.STRING(50), defaultValue: '' },
  assignedAt: { type: DataTypes.DATE, allowNull: true },
  finishedAt: { type: DataTypes.DATE, allowNull: true },
  rating: { type: DataTypes.INTEGER, defaultValue: 0 },
  solution: { type: DataTypes.TEXT, defaultValue: '' },
  cost: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  remark: { type: DataTypes.TEXT, defaultValue: '' },
  createdBy: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
}, { sequelize, tableName: 'work_orders', indexes: [{ fields: ['ticketNo'] }, { fields: ['propertyId'] }, { fields: ['tenantId'] }, { fields: ['status'] }] });

export default WorkOrder;
