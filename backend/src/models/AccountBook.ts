import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

interface AccountBookAttributes {
  id: number; name: string; companyName: string; startDate: Date; endDate: Date;
  currency: string; isActive: boolean; settings: object;
  createdAt?: Date; updatedAt?: Date;
}
type ABCreation = Optional<AccountBookAttributes, 'id'|'createdAt'|'updatedAt'>;
class AccountBook extends Model<AccountBookAttributes, ABCreation> implements AccountBookAttributes {
}
AccountBook.init({
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  name: { type: DataTypes.STRING(100), allowNull: false },
  companyName: { type: DataTypes.STRING(200), defaultValue: '' },
  startDate: { type: DataTypes.DATEONLY, allowNull: false },
  endDate: { type: DataTypes.DATEONLY, allowNull: false },
  currency: { type: DataTypes.STRING(10), defaultValue: 'CNY' },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
  settings: { type: DataTypes.JSON, defaultValue: {} },
}, { sequelize, tableName: 'account_books' });
export default AccountBook;
