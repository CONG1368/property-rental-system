import { Router } from 'express';
import User from '../models/User';
import { AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/', async (req: AuthRequest, res) => {
  try {
    const users = await User.findAll({
      attributes: ['id', 'username', 'displayName', 'role', 'status', 'lastLogin', 'createdAt'],
      order: [['createdAt', 'DESC']],
    });
    res.json({ code: 200, data: { list: users } });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

router.post('/', async (req: AuthRequest, res) => {
  try {
    const { password, ...userData } = req.body;
    const passwordHash = await User.hashPassword(password || '123456');
    const user = await User.create({ ...userData, passwordHash });
    const { passwordHash: _, ...safeUser } = user.toJSON();
    res.json({ code: 200, data: safeUser, message: '用户创建成功' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ code: 404, message: '用户不存在' });
    const { password, ...updateData } = req.body;
    if (password) {
      updateData.passwordHash = await User.hashPassword(password);
    }
    await user.update(updateData);
    const { passwordHash: _, ...safe } = user.toJSON();
    res.json({ code: 200, data: safe, message: '用户更新成功' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

export default router;
