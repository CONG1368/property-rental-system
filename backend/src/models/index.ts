import User from './User';
import Property from './Property';
import Tenant from './Tenant';
import Contract from './Contract';
import Bill from './Bill';
import PaymentRecord from './PaymentRecord';
import Voucher from './Voucher';
import VoucherEntry from './VoucherEntry';
import AccountBook from './AccountBook';
import ChartOfAccount from './ChartOfAccount';
import Budget from './Budget';
import Expense from './Expense';
import FixedAsset from './FixedAsset';
import ContractTemplate from './ContractTemplate';
import ContractClause from './ContractClause';
import ContractChange from './ContractChange';
import ContractLog from './ContractLog';
import Approval from './Approval';
import DunningTask from './DunningTask';
import Notification from './Notification';
import AuditLog from './AuditLog';

// ====== 房源 <-> 合同 ======
Property.hasMany(Contract, { foreignKey: 'propertyId', as: 'contracts' });
Contract.belongsTo(Property, { foreignKey: 'propertyId', as: 'property' });

// ====== 租客 <-> 合同 ======
Tenant.hasMany(Contract, { foreignKey: 'tenantId', as: 'contracts' });
Contract.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });

// ====== 合同 <-> 账单 ======
Contract.hasMany(Bill, { foreignKey: 'contractId', as: 'bills' });
Bill.belongsTo(Contract, { foreignKey: 'contractId', as: 'contract' });

// ====== 账单 <-> 收款记录 ======
Bill.hasMany(PaymentRecord, { foreignKey: 'billId', as: 'paymentRecords' });
PaymentRecord.belongsTo(Bill, { foreignKey: 'billId', as: 'bill' });

// ====== 账单 <-> 催缴任务 ======
Bill.hasMany(DunningTask, { foreignKey: 'billId', as: 'dunningTasks' });
DunningTask.belongsTo(Bill, { foreignKey: 'billId', as: 'bill' });

// ====== 账套 <-> 科目 ======
AccountBook.hasMany(ChartOfAccount, { foreignKey: 'bookId', as: 'accounts' });
ChartOfAccount.belongsTo(AccountBook, { foreignKey: 'bookId', as: 'book' });

// 科目自关联（父子层级）
ChartOfAccount.belongsTo(ChartOfAccount, { foreignKey: 'parentId', as: 'parent' });
ChartOfAccount.hasMany(ChartOfAccount, { foreignKey: 'parentId', as: 'children' });

// ====== 账套 <-> 凭证 ======
AccountBook.hasMany(Voucher, { foreignKey: 'bookId', as: 'vouchers' });
Voucher.belongsTo(AccountBook, { foreignKey: 'bookId', as: 'book' });

// ====== 凭证 <-> 凭证分录 ======
Voucher.hasMany(VoucherEntry, { foreignKey: 'voucherId', as: 'entries' });
VoucherEntry.belongsTo(Voucher, { foreignKey: 'voucherId', as: 'voucher' });

// ====== 科目 <-> 凭证分录 ======
ChartOfAccount.hasMany(VoucherEntry, { foreignKey: 'accountId', as: 'entries' });
VoucherEntry.belongsTo(ChartOfAccount, { foreignKey: 'accountId', as: 'account' });

// ====== 合同 <-> 审批 ======
Contract.hasMany(Approval, { foreignKey: 'contractId', as: 'approvals' });
Approval.belongsTo(Contract, { foreignKey: 'contractId', as: 'contract' });

// ====== User 引用关系 ======
User.hasMany(Voucher, { foreignKey: 'createdBy', as: 'createdVouchers' });
User.hasMany(Approval, { foreignKey: 'approverId', as: 'approvals' });
User.hasMany(AuditLog, { foreignKey: 'userId', as: 'auditLogs' });
User.hasMany(Budget, { foreignKey: 'createdBy', as: 'createdBudgets' });
User.hasMany(Contract, { foreignKey: 'createdBy', as: 'createdContracts' });

// ====== 合同模板 <-> 合同条款 ======
ContractTemplate.hasMany(ContractClause, { foreignKey: 'templateId', as: 'clauses' });
ContractClause.belongsTo(ContractTemplate, { foreignKey: 'templateId', as: 'template' });

// ====== 合同模板 <-> 合同 ======
ContractTemplate.hasMany(Contract, { foreignKey: 'templateId', as: 'contracts' });
Contract.belongsTo(ContractTemplate, { foreignKey: 'templateId', as: 'template' });

// ====== 合同 <-> 合同变更 ======
Contract.hasMany(ContractChange, { foreignKey: 'contractId', as: 'changes' });
ContractChange.belongsTo(Contract, { foreignKey: 'contractId', as: 'contract' });

// ====== 合同 <-> 合同日志 ======
Contract.hasMany(ContractLog, { foreignKey: 'contractId', as: 'logs' });
ContractLog.belongsTo(Contract, { foreignKey: 'contractId', as: 'contract' });

// ====== 账套 <-> 预算 ======
AccountBook.hasMany(Budget, { foreignKey: 'bookId', as: 'budgets' });
Budget.belongsTo(AccountBook, { foreignKey: 'bookId', as: 'book' });
Budget.belongsTo(ChartOfAccount, { foreignKey: 'accountId', as: 'account' });

// ====== 账套 <-> 费用 ======
AccountBook.hasMany(Expense, { foreignKey: 'bookId', as: 'expenses' });
Expense.belongsTo(AccountBook, { foreignKey: 'bookId', as: 'book' });

// ====== 账套 <-> 固定资产 ======
AccountBook.hasMany(FixedAsset, { foreignKey: 'bookId', as: 'fixedAssets' });
FixedAsset.belongsTo(AccountBook, { foreignKey: 'bookId', as: 'book' });

export {
  User, Property, Tenant, Contract, Bill, PaymentRecord,
  Voucher, VoucherEntry, AccountBook, ChartOfAccount,
  Budget, Expense, FixedAsset, ContractTemplate, ContractClause,
  ContractChange, ContractLog, Approval, DunningTask,
  Notification, AuditLog,
};
