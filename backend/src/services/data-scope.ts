import User from '../models/User.js';
import Property from '../models/Property.js';
import Contract from '../models/Contract.js';
import Tenant from '../models/Tenant.js';
import { Op } from 'sequelize';

export async function getScopeProjectIds(userId?: number): Promise<number[] | null> {
  if (!userId) return null;
  const user = await User.findByPk(userId, { attributes: ['id', 'role', 'projectIds'], raw: true });
  if (!user) return null;
  const GLOBAL_ROLES = ['管理员', '总经理', '会计', '出纳', '法务', '财务主管'];
  if (GLOBAL_ROLES.includes(user.role)) return null;
  const raw = (user as any).projectIds;
  const ids = Array.isArray(raw) ? raw : (raw ? JSON.parse(String(raw) || '[]') : []);
  return ids;
}
export async function getScopedPropertyIds(userId?: number): Promise<number[] | null> {
  const projectIds = await getScopeProjectIds(userId);
  if (projectIds === null) return null;
  if (!projectIds.length) return [];
  const props = await Property.findAll({ where: { projectId: { [Op.in]: projectIds } }, attributes: ['id'], raw: true });
  return props.map((p: any) => p.id);
}
export async function getScopedContractIds(userId?: number): Promise<number[] | null> {
  const propIds = await getScopedPropertyIds(userId);
  if (propIds === null) return null;
  if (!propIds.length) return [];
  const contracts = await Contract.findAll({ where: { propertyId: { [Op.in]: propIds } }, attributes: ['id'], raw: true });
  return contracts.map((c: any) => c.id);
}
export async function getScopedTenantIds(userId?: number): Promise<number[] | null> {
  const contractIds = await getScopedContractIds(userId);
  if (contractIds === null) return null;
  if (!contractIds.length) return [];
  const tenants = await Tenant.findAll({ include: [{ model: Contract, as: 'contracts', where: { id: { [Op.in]: contractIds } }, attributes: [] }], attributes: ['id'], raw: true });
  return tenants.map((t: any) => t.id);
}

const inSet = (id: number | undefined, ids: number[] | null): boolean => {
  if (ids === null) return true; // 全局
  return id !== undefined && ids.includes(Number(id));
};

// 单条记录是否在用户可见范围（用于详情/统计端点防 ID 枚举越权）
// kind: property(看 propertyId 或 id) | contract(propertyId) | workorder(propertyId) | bill(contractId) | tenant(id)
export async function recordInScope(record: any, userId: number | undefined, kind: string): Promise<boolean> {
  if (!record || !(record as any).id) return false;
  const scopeProjectIds = await getScopeProjectIds(userId);
  if (scopeProjectIds === null) return true; // 全局角色
  switch (kind) {
    case 'property': return inSet(Number((record as any).id), await getScopedPropertyIds(userId)) || inSet(Number((record as any).propertyId), await getScopedPropertyIds(userId));
    case 'contract':
    case 'workorder': return inSet(Number((record as any).propertyId), await getScopedPropertyIds(userId));
    case 'bill': return inSet(Number((record as any).contractId), await getScopedContractIds(userId));
    case 'tenant': return inSet(Number((record as any).id), await getScopedTenantIds(userId));
    default: return true;
  }
}
