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
import FireInspection from './FireInspection.js';
import FireEquipment from './FireEquipment.js';
import FireViolation from './FireViolation.js';
import FireDrill from './FireDrill.js';
import Deposit from './Deposit.js';
import Checkout from './Checkout.js';
import ParkingSpace from './ParkingSpace.js';
import ParkingRecord from './ParkingRecord.js';
import Complaint from './Complaint.js';
import Resident from './Resident.js';
import Facility from './Facility.js';
import FacilityMaintenance from './FacilityMaintenance.js';
import WorkOrder from './WorkOrder.js';
import Vendor from './Vendor.js';
import Meter from './Meter.js';
import MeterReading from './MeterReading.js';
import Announcement from './Announcement.js';
import CommonRevenue from './CommonRevenue.js';
import Material from './Material.js';
import InventoryRecord from './InventoryRecord.js';
import Invoice from './Invoice.js';
import Project from './Project.js';
import Lead from './Lead.js';
import Viewing from './Viewing.js';
import MoveIn from './MoveIn.js';
import Decoration from './Decoration.js';
import MaintenancePlan from './MaintenancePlan.js';
import FlowDefinition from './FlowDefinition.js';
import ApprovalRequest from './ApprovalRequest.js';
import PropertyTask from './PropertyTask.js';
import RolePermission from './RolePermission.js';
import PatrolRecord from './PatrolRecord.js';
import Visitor from './Visitor.js';
import EquipmentCertification from './EquipmentCertification.js';

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

// ====== 房源 <-> 消防检查/器材/违规/演练 ======
Property.hasMany(FireInspection, { foreignKey: 'propertyId', as: 'fireInspections' });
FireInspection.belongsTo(Property, { foreignKey: 'propertyId', as: 'property' });
Property.hasMany(FireEquipment, { foreignKey: 'propertyId', as: 'fireEquipment' });
FireEquipment.belongsTo(Property, { foreignKey: 'propertyId', as: 'property' });
Property.hasMany(FireViolation, { foreignKey: 'propertyId', as: 'fireViolations' });
FireViolation.belongsTo(Property, { foreignKey: 'propertyId', as: 'property' });
Property.hasMany(FireDrill, { foreignKey: 'propertyId', as: 'fireDrills' });
FireDrill.belongsTo(Property, { foreignKey: 'propertyId', as: 'property' });

// ====== 租客 <-> 消防违规 ======
Tenant.hasMany(FireViolation, { foreignKey: 'tenantId', as: 'fireViolations' });
FireViolation.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });

// ====== 用户 <-> 消防检查 ======
User.hasMany(FireInspection, { foreignKey: 'inspectorId', as: 'fireInspections' });
FireInspection.belongsTo(User, { foreignKey: 'inspectorId', as: 'inspector' });

// ====== 检查记录 <-> 违规 ======
FireInspection.hasMany(FireViolation, { foreignKey: 'inspectionId', as: 'violations' });
FireViolation.belongsTo(FireInspection, { foreignKey: 'inspectionId', as: 'inspection' });

// ====== 合同 <-> 押金 ======
Contract.hasMany(Deposit, { foreignKey: 'contractId', as: 'deposits' });
Deposit.belongsTo(Contract, { foreignKey: 'contractId', as: 'contract' });
Tenant.hasMany(Deposit, { foreignKey: 'tenantId', as: 'deposits' });
Deposit.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });
Property.hasMany(Deposit, { foreignKey: 'propertyId', as: 'deposits' });
Deposit.belongsTo(Property, { foreignKey: 'propertyId', as: 'property' });

// ====== 合同 <-> 退租 ======
Contract.hasMany(Checkout, { foreignKey: 'contractId', as: 'checkouts' });
Checkout.belongsTo(Contract, { foreignKey: 'contractId', as: 'contract' });
Tenant.hasMany(Checkout, { foreignKey: 'tenantId', as: 'checkouts' });
Checkout.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });
Property.hasMany(Checkout, { foreignKey: 'propertyId', as: 'checkouts' });
Checkout.belongsTo(Property, { foreignKey: 'propertyId', as: 'property' });

// ====== 房源 <-> 车位 ======
Property.hasMany(ParkingSpace, { foreignKey: 'propertyId', as: 'parkingSpaces' });
ParkingSpace.belongsTo(Property, { foreignKey: 'propertyId', as: 'property' });
// ====== 车位 <-> 停车记录 ======
ParkingSpace.hasMany(ParkingRecord, { foreignKey: 'spaceId', as: 'records' });
ParkingRecord.belongsTo(ParkingSpace, { foreignKey: 'spaceId', as: 'space' });
// ====== 房源/租客 <-> 投诉 ======
Property.hasMany(Complaint, { foreignKey: 'propertyId', as: 'complaints' });
Complaint.belongsTo(Property, { foreignKey: 'propertyId', as: 'property' });
Tenant.hasMany(Complaint, { foreignKey: 'tenantId', as: 'complaints' });
Complaint.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });

// ====== 房源 <-> 住户档案 ======
Property.hasMany(Resident, { foreignKey: 'propertyId', as: 'residents' });
Resident.belongsTo(Property, { foreignKey: 'propertyId', as: 'property' });

// ====== 房源 <-> 设施设备 ======
Property.hasMany(Facility, { foreignKey: 'propertyId', as: 'facilities' });
Facility.belongsTo(Property, { foreignKey: 'propertyId', as: 'property' });
// ====== 设施 <-> 维保记录 ======
Facility.hasMany(FacilityMaintenance, { foreignKey: 'facilityId', as: 'maintenances' });
FacilityMaintenance.belongsTo(Facility, { foreignKey: 'facilityId', as: 'facility' });

// ====== 房源/租客 <-> 工单 ======
Property.hasMany(WorkOrder, { foreignKey: 'propertyId', as: 'workOrders' });
WorkOrder.belongsTo(Property, { foreignKey: 'propertyId', as: 'property' });
Tenant.hasMany(WorkOrder, { foreignKey: 'tenantId', as: 'workOrders' });
WorkOrder.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });

// ====== 房源/租客 <-> 仪表/抄表 ======
Property.hasMany(Meter, { foreignKey: 'propertyId', as: 'meters' });
Meter.belongsTo(Property, { foreignKey: 'propertyId', as: 'property' });
Tenant.hasMany(Meter, { foreignKey: 'tenantId', as: 'meters' });
Meter.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });
Meter.hasMany(MeterReading, { foreignKey: 'meterId', as: 'readings' });
MeterReading.belongsTo(Meter, { foreignKey: 'meterId', as: 'meter' });
Property.hasMany(MeterReading, { foreignKey: 'propertyId', as: 'meterReadings' });
MeterReading.belongsTo(Property, { foreignKey: 'propertyId', as: 'property' });
Tenant.hasMany(MeterReading, { foreignKey: 'tenantId', as: 'meterReadings' });
MeterReading.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });

// ====== 房源 <-> 公共收益 ======
Property.hasMany(CommonRevenue, { foreignKey: 'propertyId', as: 'commonRevenues' });
CommonRevenue.belongsTo(Property, { foreignKey: 'propertyId', as: 'property' });
// ====== 物料 <-> 出入库记录 ======
Material.hasMany(InventoryRecord, { foreignKey: 'materialId', as: 'records' });
InventoryRecord.belongsTo(Material, { foreignKey: 'materialId', as: 'material' });

// ====== 科目 <-> 公共收益 ======
ChartOfAccount.hasMany(CommonRevenue, { foreignKey: 'accountId', as: 'commonRevenues' });
CommonRevenue.belongsTo(ChartOfAccount, { foreignKey: 'accountId', as: 'account' });

// ====== 账单/合同/租客 <-> 发票 ======
Bill.hasMany(Invoice, { foreignKey: 'billId', as: 'invoices' });
Invoice.belongsTo(Bill, { foreignKey: 'billId', as: 'bill' });
Contract.hasMany(Invoice, { foreignKey: 'contractId', as: 'invoices' });
Invoice.belongsTo(Contract, { foreignKey: 'contractId', as: 'contract' });
Tenant.hasMany(Invoice, { foreignKey: 'tenantId', as: 'invoices' });
Invoice.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });

// ====== 项目 <-> 房源 ======
Project.hasMany(Property, { foreignKey: 'projectId', as: 'properties' });
Property.belongsTo(Project, { foreignKey: 'projectId', as: 'project' });

// ====== 线索 <-> 看房 ======
Lead.hasMany(Viewing, { foreignKey: 'leadId', as: 'viewings' });
Viewing.belongsTo(Lead, { foreignKey: 'leadId', as: 'lead' });
Property.hasMany(Lead, { foreignKey: 'propertyId', as: 'leads' });
Lead.belongsTo(Property, { foreignKey: 'propertyId', as: 'property' });
// ====== 入住交接 <-> 合同/租客/房源 ======
Contract.hasMany(MoveIn, { foreignKey: 'contractId', as: 'moveIns' });
MoveIn.belongsTo(Contract, { foreignKey: 'contractId', as: 'contract' });
Tenant.hasMany(MoveIn, { foreignKey: 'tenantId', as: 'moveIns' });
MoveIn.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });
Property.hasMany(MoveIn, { foreignKey: 'propertyId', as: 'moveIns' });
MoveIn.belongsTo(Property, { foreignKey: 'propertyId', as: 'property' });

// ====== 装修 <-> 房源/租客 ======
Property.hasMany(Decoration, { foreignKey: 'propertyId', as: 'decorations' });
Decoration.belongsTo(Property, { foreignKey: 'propertyId', as: 'property' });
Tenant.hasMany(Decoration, { foreignKey: 'tenantId', as: 'decorations' });
Decoration.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });

// ====== 设施 <-> 维保计划 ======
Facility.hasMany(MaintenancePlan, { foreignKey: 'facilityId', as: 'maintenancePlans' });
MaintenancePlan.belongsTo(Facility, { foreignKey: 'facilityId', as: 'facility' });

export {
  User, Property, Tenant, Contract, Bill, PaymentRecord,
  Voucher, VoucherEntry, AccountBook, ChartOfAccount,
  Budget, Expense, FixedAsset, ContractTemplate, ContractClause,
  ContractChange, ContractLog, Approval, DunningTask,
  Notification, AuditLog, DoorLock, DoorLockPassword,
  DoorLockKey, DoorLockLog, RoomStatusLog, IdCardReader, IdCardReadLog,
  FireInspection, FireEquipment, FireViolation, FireDrill,
  Deposit, Checkout, ParkingSpace, ParkingRecord, Complaint, Resident, Facility, FacilityMaintenance, WorkOrder, Vendor, Meter, MeterReading, Announcement, CommonRevenue, Material, InventoryRecord, Invoice, Project, Lead, Viewing, MoveIn, Decoration, MaintenancePlan, FlowDefinition, ApprovalRequest, PropertyTask, PatrolRecord, Visitor, EquipmentCertification, RolePermission,
};
