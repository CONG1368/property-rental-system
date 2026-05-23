import { Router } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import SystemConfig from '../models/SystemConfig.js';

const router = Router();

// GET /api/system-configs/keys?keys=key1,key2,... — 批量查询配置值
router.get('/keys', async (req: AuthRequest, res) => {
  try {
    const keysStr = req.query.keys as string;
    if (!keysStr) {
      return res.json({ code: 200, data: [] });
    }
    const keys = keysStr.split(',').map(k => k.trim()).filter(Boolean);
    const rows = await SystemConfig.findAll({ where: { configKey: keys }, raw: true });
    res.json({ code: 200, data: rows });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

// PUT /api/system-configs/:key — 保存单个配置
router.put('/:key', async (req: AuthRequest, res) => {
  try {
    const { configValue, description } = req.body;
    const [row] = await SystemConfig.upsert({
      configKey: req.params.key,
      configValue: configValue ?? '',
      description: description || '',
    } as any);
    res.json({ code: 200, data: row, message: '配置已保存' });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

export default router;
