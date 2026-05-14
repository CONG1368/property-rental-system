import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.js';
import AuditLog from '../models/AuditLog.js';

export function auditLog(module: string, action: string) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    const originalJson = res.json.bind(res);
    res.json = function (body: any) {
      if (res.statusCode < 400 && req.userId) {
        AuditLog.create({
          userId: req.userId,
          action,
          module,
          targetType: req.baseUrl,
          targetId: req.params.id || '',
          detail: JSON.stringify({ method: req.method, path: req.path }),
          ip: req.ip || '',
        } as any).catch((err: any) => console.error('Audit log error:', err));
      }
      return originalJson(body);
    };
    next();
  };
}
