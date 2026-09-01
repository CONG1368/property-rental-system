import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.js';
import User from '../models/User.js';

// 不可逆操作二次确认：校验请求体中的 confirmPassword 是否等于当前登录用户的密码
// 用法：router.delete('/:id', requirePermission(...), requireConfirmPassword('操作名'), handler)
// 前端需在发起请求时携带 { confirmPassword }（DELETE 走 config.data，POST/PUT 走 body）
export function requireConfirmPassword(label: string) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const password = (req.body as any)?.confirmPassword || (req.query as any)?.confirmPassword || '';
      const user = await User.findByPk(req.userId);
      const ok = !!user && !!password && (await user.validatePassword(password));
      if (!ok) return res.status(403).json({ code: 403, message: '二次确认失败：请输入正确的登录密码' });
      next();
    } catch (err: any) {
      return res.status(500).json({ code: 500, message: '二次确认校验失败: ' + (err?.message || '') });
    }
  };
}
