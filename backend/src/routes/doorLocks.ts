import { Router } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import * as lockService from '../services/door-lock-service.js';

const router = Router();

// ====== 门锁设备 CRUD ======

// GET /api/door-locks — 门锁列表
router.get('/', async (req: AuthRequest, res) => {
  try {
    const { page = 1, pageSize = 20, keyword, category, propertyId, status } = req.query;
    const result = await lockService.getLockList({
      page: Number(page),
      pageSize: Number(pageSize),
      keyword: keyword as string,
      category: category as string,
      propertyId: propertyId ? Number(propertyId) : undefined,
      status: status as string,
    });
    res.json({ code: 200, data: result });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

// GET /api/door-locks/:id — 门锁详情
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const lock = await lockService.getLockById(Number(req.params.id));
    if (!lock) return res.status(404).json({ code: 404, message: '门锁不存在' });
    res.json({ code: 200, data: lock });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

// POST /api/door-locks — 注册门锁
router.post('/', async (req: AuthRequest, res) => {
  try {
    const lock = await lockService.createLock(req.body);
    res.json({ code: 200, data: lock, message: '门锁注册成功' });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

// PUT /api/door-locks/:id — 更新门锁
router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const lock = await lockService.updateLock(Number(req.params.id), req.body);
    if (!lock) return res.status(404).json({ code: 404, message: '门锁不存在' });
    res.json({ code: 200, data: lock, message: '门锁更新成功' });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

// DELETE /api/door-locks/:id — 删除门锁
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const result = await lockService.deleteLock(Number(req.params.id));
    if (!result) return res.status(404).json({ code: 404, message: '门锁不存在' });
    res.json({ code: 200, message: '门锁已删除' });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

// ====== 智能门锁专属操作 ======

// POST /api/door-locks/:id/remote-open — 远程开锁
router.post('/:id/remote-open', async (req: AuthRequest, res) => {
  try {
    const operatorName = req.username || '管理员';
    const result = await lockService.remoteOpen(
      Number(req.params.id), req.userId || 0, operatorName,
    );
    res.json({ code: 200, data: result, message: result.message });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

// GET /api/door-locks/:id/status — 查询门锁状态
router.get('/:id/status', async (req: AuthRequest, res) => {
  try {
    const status = await lockService.getLockStatus(Number(req.params.id));
    res.json({ code: 200, data: status });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

// GET /api/door-locks/:id/passwords — 密码列表
router.get('/:id/passwords', async (req: AuthRequest, res) => {
  try {
    const list = await lockService.getPasswords(Number(req.params.id));
    res.json({ code: 200, data: list });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

// POST /api/door-locks/:id/passwords — 创建密码
router.post('/:id/passwords', async (req: AuthRequest, res) => {
  try {
    const pwd = await lockService.createPassword(Number(req.params.id), {
      ...req.body,
      createdBy: req.userId || undefined,
    });
    res.json({ code: 200, data: pwd, message: '密码创建成功' });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

// PUT /api/door-locks/:id/passwords/:pwdId — 更新密码
router.put('/:id/passwords/:pwdId', async (req: AuthRequest, res) => {
  try {
    const pwd = await lockService.updatePassword(Number(req.params.pwdId), req.body);
    res.json({ code: 200, data: pwd, message: '密码更新成功' });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

// DELETE /api/door-locks/:id/passwords/:pwdId — 删除密码
router.delete('/:id/passwords/:pwdId', async (req: AuthRequest, res) => {
  try {
    await lockService.deletePassword(Number(req.params.pwdId));
    res.json({ code: 200, message: '密码已删除' });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

// ====== 传统门锁专属操作 ======

// GET /api/door-locks/:id/keys — 钥匙列表
router.get('/:id/keys', async (req: AuthRequest, res) => {
  try {
    const { status } = req.query;
    const list = await lockService.getKeys(Number(req.params.id), status as string);
    res.json({ code: 200, data: list });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

// POST /api/door-locks/:id/keys — 登记新钥匙
router.post('/:id/keys', async (req: AuthRequest, res) => {
  try {
    const key = await lockService.createKey(Number(req.params.id), {
      ...req.body,
      createdBy: req.userId || undefined,
    });
    res.json({ code: 200, data: key, message: '钥匙登记成功' });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

// PUT /api/door-locks/:id/keys/:keyId — 更新钥匙状态
router.put('/:id/keys/:keyId', async (req: AuthRequest, res) => {
  try {
    const operatorName = req.username || '管理员';
    const key = await lockService.updateKeyStatus(Number(req.params.keyId), {
      keyStatus: req.body.keyStatus,
      operatorId: req.userId || 0,
      operatorName,
    });
    res.json({ code: 200, data: key, message: '钥匙状态更新成功' });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

// POST /api/door-locks/:id/keys/:keyId/lend — 借出钥匙
router.post('/:id/keys/:keyId/lend', async (req: AuthRequest, res) => {
  try {
    const operatorName = req.username || '管理员';
    const key = await lockService.lendKey(
      Number(req.params.keyId), req.body,
      req.userId || 0, operatorName,
    );
    res.json({ code: 200, data: key, message: '钥匙借出成功' });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

// POST /api/door-locks/:id/keys/:keyId/return — 归还钥匙
router.post('/:id/keys/:keyId/return', async (req: AuthRequest, res) => {
  try {
    const operatorName = req.username || '管理员';
    const key = await lockService.returnKey(
      Number(req.params.keyId),
      req.userId || 0, operatorName,
    );
    res.json({ code: 200, data: key, message: '钥匙归还成功' });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

// ====== 日志查询（通用） ======

// GET /api/door-locks/:id/logs — 操作日志
router.get('/:id/logs', async (req: AuthRequest, res) => {
  try {
    const { page = 1, pageSize = 20, operationType } = req.query;
    const result = await lockService.getLogs(Number(req.params.id), {
      page: Number(page),
      pageSize: Number(pageSize),
      operationType: operationType as string,
    });
    res.json({ code: 200, data: result });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

export default router;
