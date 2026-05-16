import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.js';

type PermissionAction = 'create' | 'read' | 'update' | 'delete' | 'approve' | 'export';

const rolePermissions: Record<string, Record<string, PermissionAction[]>> = {
  '管理员': { '*': ['create', 'read', 'update', 'delete', 'approve', 'export'] },
  '收租主管': { 'rent': ['create', 'read', 'update', 'delete', 'approve', 'export'], 'tenant': ['create', 'read', 'update', 'delete', 'export'], 'contract': ['read'] },
  '收租员': { 'rent': ['create', 'read', 'update', 'export'], 'tenant': ['create', 'read', 'update'] },
  '财务主管': { 'finance': ['create', 'read', 'update', 'delete', 'approve', 'export'], 'reports': ['read', 'export'] },
  '会计': { 'finance': ['create', 'read', 'update', 'export'], 'reports': ['read'] },
  '出纳': { 'finance': ['read', 'update'], 'rent': ['read'] },
  '合同主管': { 'contract': ['create', 'read', 'update', 'delete', 'approve', 'export'], 'tenant': ['read'] },
  '法务': { 'contract': ['read', 'approve'], 'compliance': ['read', 'update', 'approve', 'export'] },
  '总经理': { '*': ['read', 'approve', 'export'] },
};

export function requirePermission(module: string, action: PermissionAction) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const role = req.role || '';
    const perms = rolePermissions[role];
    if (!perms) return res.status(403).json({ code: 403, message: '权限不足' });
    const modulePerms = perms['*'] || perms[module] || [];
    if (!modulePerms.includes(action)) {
      return res.status(403).json({ code: 403, message: '权限不足' });
    }
    next();
  };
}
