import { Router } from 'express';
import AuditLog from '../models/AuditLog';
import { AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/', async (req: AuthRequest, res) => {
  try {
    const { page = 1, pageSize = 50 } = req.query;
    const { count, rows } = await AuditLog.findAndCountAll({
      limit: Number(pageSize), offset: (Number(page) - 1) * Number(pageSize),
      order: [['createdAt', 'DESC']],
    });
    res.json({ code: 200, data: { total: count, list: rows, page: Number(page), pageSize: Number(pageSize) } });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

export default router;
