import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

interface NotificationAttributes {
  id: number; recipientId: number; recipientType: 'user'|'tenant';
  channel: string; title: string; content: string;
  isRead: boolean; readAt: Date | null; createdAt?: Date; updatedAt?: Date;
}
type NCreation = Optional<NotificationAttributes, 'id'|'createdAt'|'updatedAt'>;
class Notification extends Model<NotificationAttributes, NCreation> implements NotificationAttributes {
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
}, { sequelize, tableName: 'notifications', indexes: [{fields:['recipientId']},{fields:['isRead']}] });
export default Notification;
