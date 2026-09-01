import RolePermission from '../models/RolePermission.js';
import { rolePermissions } from '../middleware/rbac.js';

type PermMap = Record<string, string[]>;
let cache: Record<string, PermMap> = {};

// 读取某角色**生效**权限：以 rbac.ts 默认为基底，用 DB 定制逐模块覆盖（未覆盖模块保留默认与 '*' 全局兜底）
export async function getRolePerms(role: string): Promise<PermMap> {
  if (cache[role]) return cache[role];
  const def: PermMap = JSON.parse(JSON.stringify((rolePermissions as Record<string, PermMap>)[role] || {}));
  const rows = await RolePermission.findAll({ where: { role }, raw: true });
  rows.forEach((r: any) => {
    const a = r.actions;
    def[r.module] = Array.isArray(a) ? a : (typeof a === 'string' ? (JSON.parse(a || '[]')) : (typeof a === 'object' ? a : []));
  });
  cache[role] = def;
  return def;
}

// 全量矩阵：范围=rbac默认 与 DB 定制并集（DB 覆盖同 module）
export async function getAllMatrix(): Promise<Record<string, PermMap>> {
  const base: Record<string, PermMap> = JSON.parse(JSON.stringify(rolePermissions));
  const rows = await RolePermission.findAll({ raw: true });
  rows.forEach((r: any) => {
    const a = r.actions;
    const acts = Array.isArray(a) ? a : (typeof a === 'string' ? JSON.parse(a || '[]') : (typeof a === 'object' ? a : []));
    if (!base[r.role]) base[r.role] = {};
    base[r.role][r.module] = acts;
  });
  return base;
}

// 设置某角色某模块权限：空数组=删除该模块的 DB 覆盖（回退默认）；否则 upsert 覆盖
export async function setRolePerms(role: string, module: string, actions: string[]): Promise<void> {
  if (!actions.length) {
    await RolePermission.destroy({ where: { role, module } });
  } else {
    const exist = await RolePermission.findOne({ where: { role, module } });
    if (exist) { await (exist as any).update({ actions }); }
    else { await RolePermission.create({ role, module, actions } as any); }
  }
  delete cache[role];
}

// 清理缓存（角色或全局变更后）
export function clearCache() { cache = {}; }
