import { Router } from 'express';
import User from '../models/User';
import { AuthRequest } from '../middleware/auth';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = Router();

// 头像上传
const avatarDir = 'uploads/avatars';
if (!fs.existsSync(avatarDir)) fs.mkdirSync(avatarDir, { recursive: true });
const avatarUpload = multer({
  dest: avatarDir,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) cb(null, true);
    else cb(new Error('仅支持 JPG/PNG/GIF/WEBP 格式'));
  },
});

// PUT /users/:id/avatar — 上传头像
router.put('/:id/avatar', avatarUpload.single('avatar'), async (req: AuthRequest, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ code: 404, message: '用户不存在' });
    const file = req.file;
    if (!file) return res.status(400).json({ code: 400, message: '请选择头像文件' });
    // 保存头像路径到 permissions
    const avatarUrl = '/' + file.path.replace(/\\/g, '/');
    const permissions = { ...((user as any).permissions || {}), avatarUrl };
    await user.update({ permissions } as any);
    res.json({ code: 200, data: { avatarUrl }, message: '头像上传成功' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

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
    const { password, name, ...rest } = req.body;
    const passwordHash = await User.hashPassword(password || '123456');
    const user = await User.create({
      ...rest,
      displayName: name || rest.displayName || '',
      passwordHash,
    });
    const { passwordHash: _, ...safeUser } = user.toJSON();
    res.json({ code: 200, data: safeUser, message: '用户创建成功' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ code: 404, message: '用户不存在' });
    const { password, name, ...rest } = req.body;
    const updateData: any = { ...rest };
    if (name) updateData.displayName = name;
    if (password) {
      updateData.passwordHash = await User.hashPassword(password);
    }
    await user.update(updateData);
    const { passwordHash: _, ...safe } = user.toJSON();
    res.json({ code: 200, data: safe, message: '用户更新成功' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ code: 404, message: '用户不存在' });
    await user.destroy();
    res.json({ code: 200, message: '用户已删除' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

export default router;
