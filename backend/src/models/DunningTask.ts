import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

interface DunningTaskAttributes {
  id: number; billId: number; level: number; channel: '站内信'|'短信'|'微信'|'邮件'|'电话'|'书面';
  title: string; content: string; sentAt: Date | null;
  status: '待发送'|'已发送'|'失败'; response: string;
  createdAt?: Date; updatedAt?: Date;
}
type DTCreation = Optional<DunningTaskAttributes, 'id'|'createdAt'|'updatedAt'>;
class DunningTask extends Model<DunningTaskAttributes, DTCreation> implements DunningTaskAttributes {
  public id!: number; public billId!: number; public level!: number;
  public channel!: '站内信'|'短信'|'微信'|'邮件'|'电话'|'书面';
  public title!: string; public content!: string; public sentAt!: Date;
  public status!: '待发送'|'已发送'|'失败'; public response!: string;
}
DunningTask.init({
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  billId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  level: { type: DataTypes.INTEGER, allowNull: false },
  channel: { type: DataTypes.ENUM('站内信','短信','微信','邮件','电话','书面'), allowNull: false },
  title: { type: DataTypes.STRING(200), defaultValue: '' },
  content: { type: DataTypes.TEXT, defaultValue: '' },
  sentAt: { type: DataTypes.DATE, allowNull: true },
  status: { type: DataTypes.ENUM('待发送','已发送','失败'), defaultValue: '待发送' },
  response: { type: DataTypes.TEXT, defaultValue: '' },
}, { sequelize, tableName: 'dunning_tasks', indexes: [{fields:['billId']},{fields:['status']},{fields:['level']}] });
export default DunningTask;
