import { DataTypes, Optional } from 'sequelize';
import { BaseModel } from './BaseModel.js';
import { sequelize } from '../config/database.js';

interface AnnouncementAttributes {
  id: number;
  title: string;
  category: string;
  content: string;
  publisher: string;
  publishDate: Date | null;
  status: string;
  target: string;
  propertyId: number | null;
  notes: string;
  createdAt?: Date;
  updatedAt?: Date;
}
type AnnouncementCreation = Optional<AnnouncementAttributes, 'id' | 'createdAt' | 'updatedAt'>;

class Announcement extends BaseModel<AnnouncementAttributes, AnnouncementCreation> {}

Announcement.init({
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  title: { type: DataTypes.STRING(200), allowNull: false },
  category: { type: DataTypes.ENUM('公告', '通知', '活动', '租务提示'), allowNull: false, defaultValue: '公告' },
  content: { type: DataTypes.TEXT, defaultValue: '' },
  publisher: { type: DataTypes.STRING(50), defaultValue: '' },
  publishDate: { type: DataTypes.DATEONLY, allowNull: true },
  status: { type: DataTypes.ENUM('草稿', '已发布', '已撤回'), allowNull: false, defaultValue: '草稿' },
  target: { type: DataTypes.ENUM('全体租客', '全体业主', '指定房源', '全体'), allowNull: false, defaultValue: '全体' },
  propertyId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  notes: { type: DataTypes.TEXT, defaultValue: '' },
}, { sequelize, tableName: 'announcements', indexes: [{ fields: ['category'] }, { fields: ['status'] }, { fields: ['publishDate'] }] });

export default Announcement;
