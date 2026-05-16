import { DataTypes, Optional } from 'sequelize';
import { BaseModel } from './BaseModel.js';
import { sequelize } from '../config/database.js';

interface NotificationAttributes {
  id: number; recipientId: number; recipientType: 'user'|'tenant';
  channel: string; title: string; content: string;
  isRead: boolean; readAt: Date | null;
  linkType: string | null; linkId: number | null;
  createdAt?: Date; updatedAt?: Date;
}
type NCreation = Optional<NotificationAttributes, 'id'|'createdAt'|'updatedAt'>;
class Notification extends BaseModel<NotificationAttributes, NCreation> {
}
Notification.init({
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  recipientId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  recipientType: { type: DataTypes.ENUM('user','tenant'), allowNull: false },
  channel: { type: DataTypes.STRING(20), defaultValue: '站内信' },
  title: { type: DataTypes.STRING(200), defaultValue: '' },
  content: { type: DataTypes.TEXT, defaultValue: '' },
  isRead: { type: DataTypes.BOOLEAN, defaultValue: false },
  readAt: { type: DataTypes.DATE, allowNull: true },
  linkType: { type: DataTypes.STRING(50), allowNull: true },
  linkId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
}, { sequelize, tableName: 'notifications', indexes: [{fields:['recipientId']},{fields:['isRead']},{fields:['linkType','linkId']}] });
export default Notification;
