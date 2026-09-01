import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.js';
import AuditLog from '../models/AuditLog.js';
import SystemConfig from '../models/SystemConfig.js';

// 审计开关缓存（5 秒 TTL，避免每次请求读库）
let auditEnabledCache: boolean | null = null;
let cacheAt = 0;
async function isAuditEnabled(): Promise<boolean> {
  if (auditEnabledCache !== null && Date.now() - cacheAt < 5000) return auditEnabledCache;
  try {
    const row = await SystemConfig.findOne({ where: { configKey: 'audit_enabled' } });
    auditEnabledCache = row ? row.configValue !== 'false' : true;
    cacheAt = Date.now();
    return auditEnabledCache;
  } catch { return true; }
}

export function auditLog(module: string, action: string) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    const originalJson = res.json.bind(res);
    res.json = function (body: any) {
      // 记录所有已到达本中间件的响应：2xx=成功、4xx/5xx=失败（含动作状态标记）
      if (req.userId) {
        isAuditEnabled().then((enabled) => {
          if (!enabled) return;
          const success = res.statusCode < 400;
          AuditLog.create({
            userId: req.userId,
            action: success ? action : action + '(失败)',
            module,
            targetType: req.baseUrl,
            targetId: req.params.id || '',
            detail: JSON.stringify({ method: req.method, path: req.path, status: res.statusCode }),
            ip: req.ip || '',
          } as any).catch((err: any) => console.error('Audit log error:', err));
        });
      }
      return originalJson(body);
    };
    next();
  };
}
