import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.js';

type PermissionAction = 'create' | 'read' | 'update' | 'delete' | 'approve' | 'export';

export const rolePermissions: Record<string, Record<string, PermissionAction[]>> = {
  '管理员': { '*': ['create', 'read', 'update', 'delete', 'approve', 'export'] },
  '收租主管': { 'rent': ['create', 'read', 'update', 'delete', 'approve', 'export'], 'tenant': ['create', 'read', 'update', 'delete', 'export'], 'contract': ['read'] },
  '收租员': { 'rent': ['create', 'read', 'update', 'export'], 'tenant': ['create', 'read', 'update'] },
  '财务主管': { 'finance': ['create', 'read', 'update', 'delete', 'approve', 'export'], 'reports': ['read', 'export'] },
  '会计': { 'finance': ['create', 'read', 'update', 'export'], 'reports': ['read'] },
  '出纳': { 'finance': ['read', 'update'], 'rent': ['read'] },
  '合同主管': { 'contract': ['create', 'read', 'update', 'delete', 'approve', 'export'], 'tenant': ['read'] },
  '法务': { 'contract': ['read', 'approve'], 'compliance': ['read', 'update', 'approve', 'export'] },
  '物业经理': {
    '*': ['read', 'export'],
    'property': ['create', 'read', 'update', 'delete', 'export'],
    'workorder': ['create', 'read', 'update', 'delete', 'export'],
    'facility': ['create', 'read', 'update', 'delete', 'export'],
    'meter': ['create', 'read', 'update', 'delete', 'export'],
    'parking': ['create', 'read', 'update', 'delete', 'export'],
    'complaint': ['create', 'read', 'update', 'delete', 'export'],
    'resident': ['create', 'read', 'update', 'delete', 'export'],
    'announcement': ['create', 'read', 'update', 'delete', 'export'],
    'vendor': ['create', 'read', 'update', 'delete', 'export'],
    'inventory': ['create', 'read', 'update', 'delete', 'export'],
  },
  '维修工': { 'workorder': ['create', 'read', 'update'], 'facility': ['read', 'update'], 'meter': ['read', 'update'] },
  '安全主管': { 'fire': ['create', 'read', 'update', 'delete', 'export'], 'property': ['read'], 'complaint': ['read'] },
  '总经理': { '*': ['read', 'approve', 'export'] },
};

export function requirePermission(module: string, action: PermissionAction) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    const role = req.role || '';
    try {
      const { getRolePerms } = await import('../services/permission-service.js');
      const perms = await getRolePerms(role);
      // 生效权限 = 该模块定制优先，其次 '*' 全局兜底（与权限矩阵页面的展示基线一致）
      const modulePerms = perms[module] ?? perms['*'] ?? [];
      if (!modulePerms.includes(action)) {
        // 越权尝试落审计（安全事件可追查）
        const { default: AuditLog } = await import('../models/AuditLog.js');
        if (req.userId) {
          AuditLog.create({
            userId: req.userId, action: '越权尝试', module, targetType: req.baseUrl,
            targetId: req.params.id || '', detail: JSON.stringify({ method: req.method, path: req.path, action, role }),
            ip: req.ip || '',
          } as any).catch((err: any) => console.error('Audit log error:', err));
        }
        return res.status(403).json({ code: 403, message: '权限不足' });
      }
      next();
    } catch { return res.status(500).json({ code: 500, message: '权限校验失败' }); }
  };
}
