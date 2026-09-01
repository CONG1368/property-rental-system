import { DataTypes, Optional } from 'sequelize';
import { BaseModel } from './BaseModel.js';
import { sequelize } from '../config/database.js';

interface InvoiceAttributes {
  id: number;
  invoiceNo: string;
  title: string;
  type: string;
  amount: number;
  taxRate: number;
  taxAmount: number;
  invoiceDate: string | null;
  buyerName: string;
  buyerTaxNo: string;
  sellerCompany: string;
  status: string;
  channel: string;
  billId: number | null;
  contractId: number | null;
  tenantId: number | null;
  notes: string;
  createdBy: number | null;
  createdAt?: Date;
  updatedAt?: Date;
}
type InvoiceCreation = Optional<InvoiceAttributes, 'id' | 'createdAt' | 'updatedAt'>;

class Invoice extends BaseModel<InvoiceAttributes, InvoiceCreation> {}

Invoice.init({
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  invoiceNo: { type: DataTypes.STRING(50), allowNull: false, unique: true },
  title: { type: DataTypes.STRING(200), allowNull: false },
  type: { type: DataTypes.ENUM('增值税专用发票', '增值税普通发票', '电子发票', '收据'), allowNull: false, defaultValue: '增值税普通发票' },
  amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
  taxRate: { type: DataTypes.DECIMAL(5, 4), allowNull: false, defaultValue: 0.06 },
  taxAmount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
  invoiceDate: { type: DataTypes.DATEONLY, allowNull: true },
  buyerName: { type: DataTypes.STRING(200), allowNull: false, defaultValue: '' },
  buyerTaxNo: { type: DataTypes.STRING(50), defaultValue: '' },
  sellerCompany: { type: DataTypes.STRING(200), defaultValue: '' },
  status: { type: DataTypes.ENUM('待开票', '已开票', '已作废', '已红冲'), allowNull: false, defaultValue: '待开票' },
  channel: { type: DataTypes.ENUM('纸质', '电子'), allowNull: false, defaultValue: '电子' },
  billId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  contractId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  tenantId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  notes: { type: DataTypes.TEXT, defaultValue: '' },
  createdBy: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
}, {
  sequelize,
  tableName: 'invoices',
  indexes: [
    { fields: ['invoiceNo'] },
    { fields: ['status'] },
    { fields: ['type'] },
  ],
});

export default Invoice;
