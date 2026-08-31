import { Router } from 'express';
import User from '../models/User.js';
import { AuthRequest } from '../middleware/auth.js';
import { auditLog } from '../middleware/audit-log.js';
import { ALL_ROLES } from '../middleware/rbac.js';
import { requireAdmin } from '../middleware/requireRole.js';
import { requireConfirmPassword } from '../middleware/confirm-password.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = Router();

// 角色枚举白名单（前端角色下拉与 rbac.ts 保持一致，防止注入任意角色字符串）
const VALID_ROLES = ALL_ROLES;

// 用户可写字段白名单（剔除 passwordHash/id 等敏感/自增字段）
function pickUserFields(body: any) {
  const out: any = {};
  if (body.displayName !== undefined) out.displayName = body.displayName;
  if (body.role !== undefined) out.role = body.role;
  if (body.status !== undefined) out.status = body.status;
  if (body.permissions !== undefined) out.permissions = body.permissions;
  if (body.projectIds !== undefined) out.projectIds = body.projectIds;
  if (body.password !== undefined) out.password = body.password;
  return out;
}

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
    const avatarUrl = '/' + file.path.replace(/\\/g, '/');
    const perms = { ...((user as any).permissions || {}), avatarUrl };
    (user as any).permissions = perms;
    (user as any).changed('permissions', true);
    await user.save();
    res.json({ code: 200, data: { avatarUrl }, message: '头像上传成功' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

router.get('/', async (req: AuthRequest, res) => {
  try {
    const users = await User.findAll({
      attributes: ['id', 'username', 'displayName', 'role', 'permissions', 'status', 'lastLogin', 'projectIds', 'createdAt'],
      order: [['createdAt', 'DESC']],
    });
    res.json({ code: 200, data: { list: users } });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// POST /users — 创建用户（角色枚举校验 + 字段白名单）
router.post('/', auditLog('user', '创建用户'), requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { password, name, ...rest } = req.body;
    if (rest.role && !VALID_ROLES.includes(rest.role)) {
      return res.status(400).json({ code: 400, message: '非法角色：' + rest.role + '（可选：' + VALID_ROLES.join('/') + '）' });
    }
    const data = pickUserFields({ ...rest, displayName: name ?? rest.displayName });
    const passwordHash = await User.hashPassword(password || '123456');
    const user = await User.create({ ...data, username: rest.username, displayName: data.displayName || rest.username, passwordHash });
    const { passwordHash: _, ...safeUser } = user.toJSON();
    res.json({ code: 200, data: safeUser, message: '用户创建成功' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// PUT /users/:id — 更新用户（角色枚举校验 + 字段白名单 + 最后管理员保护）
router.put('/:id', auditLog('user', '用户信息/权限修改'), requireAdmin, async (req: AuthRequest, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ code: 404, message: '用户不存在' });
    const { name } = req.body;
    const data = pickUserFields({ ...req.body, displayName: name ?? req.body.displayName });
    // 重置密码为敏感操作：涉及密码更新时校验操作者本人密码（前端 handleResetPwd 传 confirmPassword）
    if (data.password) {
      const opUser = await User.findByPk(req.userId);
      const confirmPwd = (req.body as any)?.confirmPassword || '';
      const ok = !!opUser && !!confirmPwd && (await opUser.validatePassword(confirmPwd));
      if (!ok) return res.status(403).json({ code: 403, message: '二次确认失败：请输入正确的登录密码' });
    }
    if (data.role !== undefined && !VALID_ROLES.includes(data.role)) {
      return res.status(400).json({ code: 400, message: '非法角色：' + data.role + '（可选：' + VALID_ROLES.join('/') + '）' });
    }
    // 最后管理员保护：若当前用户是最后一名管理员且被降权/改角色/禁用，则拒绝
    if (user.role === '管理员') {
      const demote = data.role !== undefined && data.role !== '管理员';
      const disable = data.status !== undefined && data.status !== '正常';
      if (demote || disable) {
        const adminCount = await User.count({ where: { role: '管理员' } });
        if (adminCount <= 1) return res.status(400).json({ code: 400, message: '系统至少需保留一名可用管理员，无法降权/禁用最后一名管理员' });
      }
    }
    if (data.password) data.passwordHash = await User.hashPassword(data.password);
    delete data.password;
    await user.update(data);
    const { passwordHash: _, ...safe } = user.toJSON();
    res.json({ code: 200, data: safe, message: '用户更新成功' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// DELETE /users/:id — 删除用户（最后管理员保护 + 禁止删除自己 + 二次确认）
router.delete('/:id', auditLog('user', '用户删除'), requireAdmin, requireConfirmPassword('删除用户'), async (req: AuthRequest, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ code: 404, message: '用户不存在' });
    if (Number(req.params.id) === Number(req.userId)) return res.status(400).json({ code: 400, message: '不能删除当前登录账号' });
    if (user.role === '管理员') {
      const adminCount = await User.count({ where: { role: '管理员' } });
      if (adminCount <= 1) return res.status(400).json({ code: 400, message: '系统至少需保留一名管理员，无法删除最后一名管理员' });
    }
    await user.destroy();
    res.json({ code: 200, message: '用户已删除' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

export default router;
