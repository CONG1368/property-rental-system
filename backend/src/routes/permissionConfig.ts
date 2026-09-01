import { Router } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { getAllMatrix, setRolePerms, clearCache } from '../services/permission-service.js';
import { auditLog } from '../middleware/audit-log.js';
import RolePermission from '../models/RolePermission.js';
import AuditLog from '../models/AuditLog.js';
import User from '../models/User.js';

const router = Router();

// 二次确认（管理员）：校验当前登录用户密码，防止越权/误操作；失败写入审计
async function verifyConfirmPassword(req: AuthRequest, password: string, action: string): Promise<boolean> {
  const user = await User.findByPk(req.userId);
  const ok = !!user && !!password && (await user.validatePassword(password));
  if (!ok && req.userId) {
    AuditLog.create({
      userId: req.userId,
      action: '权限二次确认失败',
      module: '权限配置',
      targetType: '/permissions',
      targetId: '',
      detail: JSON.stringify({ action, ip: req.ip || '' }),
      ip: req.ip || '',
    } as any).catch(() => {});
  }
  return ok;
}

// GET /api/permissions — 全量角色权限矩阵
router.get('/', async (_req: AuthRequest, res) => {
  try { res.json({ code: 200, data: { matrix: await getAllMatrix() } }); }
  catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// PUT /api/permissions — 设置角色某模块权限（空数组=回退默认）；需管理员二次确认密码
router.put('/', auditLog('权限配置', '修改权限'), async (req: AuthRequest, res) => {
  try {
    const { role, module, actions, confirmPassword } = req.body;
    if (!role || !module || !Array.isArray(actions)) return res.status(400).json({ code: 400, message: 'role/module/actions 必填' });
    if (!(await verifyConfirmPassword(req, confirmPassword, '修改权限'))) return res.status(403).json({ code: 403, message: '二次确认失败：管理员密码错误' });
    await setRolePerms(role, module, actions.map(String));
    res.json({ code: 200, message: '权限已更新' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// DELETE /api/permissions/:role/:module — 移除某角色某模块的 DB 覆盖，回退默认；需管理员二次确认密码
router.delete('/:role/:module', auditLog('权限配置', '回退权限'), async (req: AuthRequest, res) => {
  try {
    const { role, module } = req.params;
    const { confirmPassword } = req.body || {};
    if (!(await verifyConfirmPassword(req, confirmPassword, '回退权限'))) return res.status(403).json({ code: 403, message: '二次确认失败：管理员密码错误' });
    await RolePermission.destroy({ where: { role, module } });
    clearCache();
    res.json({ code: 200, message: '已回退默认权限' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// POST /api/permissions/reset — 清除所有 DB 定制，回退 rbac 默认；需管理员二次确认密码
router.post('/reset', auditLog('权限配置', '全部回退默认'), async (req: AuthRequest, res) => {
  try {
    const { confirmPassword } = req.body || {};
    if (!(await verifyConfirmPassword(req, confirmPassword, '全部回退默认'))) return res.status(403).json({ code: 403, message: '二次确认失败：管理员密码错误' });
    await RolePermission.destroy({ truncate: true }); clearCache();
    res.json({ code: 200, message: '已回退默认权限' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

export default router;
