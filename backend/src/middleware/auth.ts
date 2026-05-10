import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';

export interface AuthRequest extends Request {
  userId?: number;
  username?: string;
  role?: string;
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ code: 401, message: '未登录或Token已过期' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, config.jwt.secret) as {
      userId: number; username: string; role: string;
    };
    req.userId = decoded.userId;
    req.username = decoded.username;
    req.role = decoded.role;
    next();
  } catch {
    return res.status(401).json({ code: 401, message: 'Token无效或已过期' });
  }
}
