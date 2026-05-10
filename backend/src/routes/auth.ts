import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import User from '../models/User';

const router = Router();

// POST /api/auth/login — 用户登录
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ code: 400, message: '请输入用户名和密码' });
    }

    const user = await User.findOne({ where: { username, status: '正常' } });
    if (!user) {
      return res.status(401).json({ code: 401, message: '用户名或密码错误' });
    }

    const valid = await user.validatePassword(password);
    if (!valid) {
      return res.status(401).json({ code: 401, message: '用户名或密码错误' });
    }

    const accessToken = jwt.sign(
      { userId: user.id, username: user.username, role: user.role },
      config.jwt.secret,
      { expiresIn: config.jwt.accessExpiry }
    );

    const refreshToken = jwt.sign(
      { userId: user.id },
      config.jwt.secret,
      { expiresIn: config.jwt.refreshExpiry }
    );

    await user.update({ lastLogin: new Date() });

    res.json({
      code: 200,
      data: {
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          role: user.role,
          permissions: user.permissions,
        },
      },
    });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

// POST /api/auth/refresh — 刷新Token
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ code: 400, message: '缺少refreshToken' });
    }

    const decoded = jwt.verify(refreshToken, config.jwt.secret) as { userId: number };
    const user = await User.findByPk(decoded.userId);
    if (!user || user.status !== '正常') {
      return res.status(401).json({ code: 401, message: '用户不存在或已被禁用' });
    }

    const accessToken = jwt.sign(
      { userId: user.id, username: user.username, role: user.role },
      config.jwt.secret,
      { expiresIn: config.jwt.accessExpiry }
    );

    res.json({ code: 200, data: { accessToken } });
  } catch {
    res.status(401).json({ code: 401, message: 'RefreshToken无效或已过期' });
  }
});

// POST /api/auth/logout — 退出登录
router.post('/logout', (_req, res) => {
  res.json({ code: 200, message: '已退出登录' });
});

export default router;
