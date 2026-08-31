import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';

export interface TenantAuthRequest extends Request {
  tenantId?: number;
  tenantName?: string;
}

export function requireTenant(req: TenantAuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ code: 401, message: '请登录租户端' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, config.jwt.secret) as { tenantId: number; tenantType: string; name: string };
    if (decoded.tenantType !== 'tenant') return res.status(403).json({ code: 403, message: '非租户令牌' });
    req.tenantId = decoded.tenantId;
    req.tenantName = decoded.name;
    next();
  } catch {
    return res.status(401).json({ code: 401, message: 'Token无效或已过期' });
  }
}
