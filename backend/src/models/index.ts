import User from './User.js';
import Property from './Property.js';
import Tenant from './Tenant.js';
import Contract from './Contract.js';
import Bill from './Bill.js';
import PaymentRecord from './PaymentRecord.js';
import Voucher from './Voucher.js';
import VoucherEntry from './VoucherEntry.js';
import AccountBook from './AccountBook.js';
import ChartOfAccount from './ChartOfAccount.js';
import Budget from './Budget.js';
import Expense from './Expense.js';
import FixedAsset from './FixedAsset.js';
import ContractTemplate from './ContractTemplate.js';
import ContractClause from './ContractClause.js';
import ContractChange from './ContractChange.js';
import ContractLog from './ContractLog.js';
import Approval from './Approval.js';
import DunningTask from './DunningTask.js';
import Notification from './Notification.js';
import AuditLog from './AuditLog.js';
import DoorLock from './DoorLock.js';
import DoorLockPassword from './DoorLockPassword.js';
import DoorLockKey from './DoorLockKey.js';
import DoorLockLog from './DoorLockLog.js';
import RoomStatusLog from './RoomStatusLog.js';
import IdCardReader from './IdCardReader.js';
import IdCardReadLog from './IdCardReadLog.js';

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

// ====== 房源 <-> 门锁 ======
Property.hasMany(DoorLock, { foreignKey: 'propertyId', as: 'doorLocks' });
DoorLock.belongsTo(Property, { foreignKey: 'propertyId', as: 'property' });

// ====== 门锁 <-> 密码 ======
DoorLock.hasMany(DoorLockPassword, { foreignKey: 'lockId', as: 'passwords' });
DoorLockPassword.belongsTo(DoorLock, { foreignKey: 'lockId', as: 'lock' });

// ====== 门锁 <-> 钥匙 ======
DoorLock.hasMany(DoorLockKey, { foreignKey: 'lockId', as: 'keys' });
DoorLockKey.belongsTo(DoorLock, { foreignKey: 'lockId', as: 'lock' });

// ====== 门锁 <-> 日志 ======
DoorLock.hasMany(DoorLockLog, { foreignKey: 'lockId', as: 'logs' });
DoorLockLog.belongsTo(DoorLock, { foreignKey: 'lockId', as: 'lock' });

// ====== 租客 <-> 门锁密码 ======
Tenant.hasMany(DoorLockPassword, { foreignKey: 'tenantId', as: 'lockPasswords' });
DoorLockPassword.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });

// ====== 房源 <-> 房态变更日志 ======
Property.hasMany(RoomStatusLog, { foreignKey: 'propertyId', as: 'statusLogs' });
RoomStatusLog.belongsTo(Property, { foreignKey: 'propertyId', as: 'property' });

// ====== 用户 <-> 房态变更日志 ======
User.hasMany(RoomStatusLog, { foreignKey: 'operatorId', as: 'roomStatusLogs' });
RoomStatusLog.belongsTo(User, { foreignKey: 'operatorId', as: 'operator' });

// ====== 用户 <-> 门锁密码/钥匙/日志 ======
User.hasMany(DoorLockPassword, { foreignKey: 'createdBy', as: 'createdLockPasswords' });
User.hasMany(DoorLockKey, { foreignKey: 'createdBy', as: 'managedKeys' });
User.hasMany(DoorLockLog, { foreignKey: 'operatorId', as: 'lockLogs' });

// ====== 身份证读卡器 <-> 读卡日志 ======
IdCardReader.hasMany(IdCardReadLog, { foreignKey: 'readerId', as: 'readLogs' });
IdCardReadLog.belongsTo(IdCardReader, { foreignKey: 'readerId', as: 'reader' });

export {
  User, Property, Tenant, Contract, Bill, PaymentRecord,
  Voucher, VoucherEntry, AccountBook, ChartOfAccount,
  Budget, Expense, FixedAsset, ContractTemplate, ContractClause,
  ContractChange, ContractLog, Approval, DunningTask,
  Notification, AuditLog, DoorLock, DoorLockPassword,
  DoorLockKey, DoorLockLog, RoomStatusLog, IdCardReader, IdCardReadLog,
};
