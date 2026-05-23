import { Router } from 'express';
import IdCardReader from '../models/IdCardReader.js';
import IdCardReadLog from '../models/IdCardReadLog.js';
import { AuthRequest } from '../middleware/auth.js';
import { readCard, getIdCardProvider } from '../services/id-card-service.js';

const router = Router();

// GET /id-card-readers — 设备列表
router.get('/', async (req: AuthRequest, res) => {
  try {
    const { page = 1, pageSize = 20, status, brand } = req.query;
    const where: any = {};
    if (status) where.status = status;
    if (brand) where.brand = brand;
    const { count, rows } = await IdCardReader.findAndCountAll({
      where,
      limit: Number(pageSize),
      offset: (Number(page) - 1) * Number(pageSize),
      order: [['createdAt', 'DESC']],
    });
    res.json({ code: 200, data: { total: count, list: rows, page: Number(page), pageSize: Number(pageSize) } });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

// POST /id-card-readers — 注册新设备
router.post('/', async (req: AuthRequest, res) => {
  try {
    const allowedFields = ['name', 'brand', 'model', 'interfaceType', 'port', 'status', 'firmwareVersion'];
    const safeBody: any = {};
    for (const key of allowedFields) { if (req.body[key] !== undefined) safeBody[key] = req.body[key]; }
    const reader = await IdCardReader.create(safeBody);
    res.json({ code: 200, data: reader, message: '设备注册成功' });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

// GET /id-card-readers/logs — 读卡日志列表（固定路径，必须在 /:id 之前）
router.get('/logs', async (req: AuthRequest, res) => {
  try {
    const { page = 1, pageSize = 20, result, method } = req.query;
    const where: any = {};
    if (result) where.result = result;
    if (method) where.method = method;
    const { count, rows } = await IdCardReadLog.findAndCountAll({
      where,
      include: [
        { model: IdCardReader, as: 'reader', attributes: ['id', 'name', 'brand'] },
      ],
      limit: Number(pageSize),
      offset: (Number(page) - 1) * Number(pageSize),
      order: [['createdAt', 'DESC']],
    });
    res.json({ code: 200, data: { total: count, list: rows, page: Number(page), pageSize: Number(pageSize) } });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

// GET /id-card-readers/:id/status — 查询设备状态
router.get('/:id/status', async (req: AuthRequest, res) => {
  try {
    const reader = await IdCardReader.findByPk(req.params.id);
    if (!reader) return res.status(404).json({ code: 404, message: '设备不存在' });
    const provider = getIdCardProvider();
    const status = await provider.getDeviceStatus((reader as any).port || String(reader.id));
    res.json({ code: 200, data: status });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

// POST /id-card-readers/:id/read — 触发读卡
router.post('/:id/read', async (req: AuthRequest, res) => {
  try {
    const result = await readCard(Number(req.params.id), req.userId || 1);
    if (result.success) {
      res.json({ code: 200, data: result.data, warnings: result.warnings, message: '读卡成功' });
    } else {
      res.status(400).json({ code: 400, message: result.error || '读卡失败' });
    }
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

// PUT /id-card-readers/:id — 更新设备
router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const reader = await IdCardReader.findByPk(req.params.id);
    if (!reader) return res.status(404).json({ code: 404, message: '设备不存在' });
    const allowedFields = ['name', 'brand', 'model', 'interfaceType', 'port', 'status', 'firmwareVersion'];
    const safeBody: any = {};
    for (const key of allowedFields) { if (req.body[key] !== undefined) safeBody[key] = req.body[key]; }
    await reader.update(safeBody);
    res.json({ code: 200, data: reader, message: '设备已更新' });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

// DELETE /id-card-readers/:id — 删除设备
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const reader = await IdCardReader.findByPk(req.params.id);
    if (!reader) return res.status(404).json({ code: 404, message: '设备不存在' });
    await reader.destroy();
    res.json({ code: 200, message: '设备已删除' });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

export default router;
