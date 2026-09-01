import { Router } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { Op } from 'sequelize';
import EquipmentCertification from '../models/EquipmentCertification.js';

const router = Router();

// ====== 统计 ======
router.get('/stats', async (_req: AuthRequest, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const thirtyDaysLater = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    const [total, qualified, pending, expired, expiring] = await Promise.all([
      EquipmentCertification.count(),
      EquipmentCertification.count({ where: { status: '合格' } }),
      EquipmentCertification.count({ where: { status: '待检' } }),
      EquipmentCertification.count({ where: { status: '过期' } }),
      EquipmentCertification.count({
        where: { nextInspectionDate: { [Op.gt]: today, [Op.lte]: thirtyDaysLater } } as any,
      }),
    ]);
    res.json({ code: 200, data: { total, qualified, pending, expired, expiring } });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// ====== 列表 ======
router.get('/', async (req: AuthRequest, res) => {
  try {
    const { page = '1', pageSize = '20', category, status, keyword } = req.query;
    const where: any = {};
    if (category) where.category = category;
    if (status) where.status = status;
    if (keyword) {
      where[Op.or] = [
        { equipmentName: { [Op.like]: `%${keyword}%` } },
        { certNo: { [Op.like]: `%${keyword}%` } },
        { agency: { [Op.like]: `%${keyword}%` } },
      ];
    }
    const { count, rows } = await EquipmentCertification.findAndCountAll({
      where,
      limit: Number(pageSize),
      offset: (Number(page) - 1) * Number(pageSize),
      order: [['nextInspectionDate', 'ASC']],
    });
    res.json({ code: 200, data: { total: count, list: rows, page: Number(page), pageSize: Number(pageSize) } });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// ====== 新增 ======
router.post('/', async (req: AuthRequest, res) => {
  try {
    const rec = await EquipmentCertification.create(req.body as any);
    res.json({ code: 200, data: rec, message: '年检记录已创建' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// ====== 更新 ======
router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const rec = await EquipmentCertification.findByPk(req.params.id);
    if (!rec) return res.status(404).json({ code: 404, message: '年检记录不存在' });
    await rec.update(req.body);
    res.json({ code: 200, data: rec, message: '年检记录已更新' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// ====== 删除 ======
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const rec = await EquipmentCertification.findByPk(req.params.id);
    if (!rec) return res.status(404).json({ code: 404, message: '年检记录不存在' });
    await rec.destroy();
    res.json({ code: 200, message: '年检记录已删除' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

export default router;
