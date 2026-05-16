import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.js';

/**
 * 角色权限中间件 — 仅允许指定角色访问
 * 管理员拥有全部权限（自动通过）
 */
export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.role) {
      return res.status(403).json({ code: 403, message: '无法获取用户角色' });
    }
    if (req.role === '管理员' || roles.includes(req.role)) {
      return next();
    }
    return res.status(403).json({ code: 403, message: '权限不足，仅' + roles.join('/') + '可操作' });
  };
}

/** 仅限管理员 */
export const requireAdmin = requireRole('管理员');
