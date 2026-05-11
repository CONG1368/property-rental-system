import { Router } from 'express';
import PaymentRecord from '../models/PaymentRecord';
import Bill from '../models/Bill';
import { AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/payment-records — 收款记录列表
router.get('/', async (req: AuthRequest, res) => {
  try {
    const { page = 1, pageSize = 20, billId, channel } = req.query;
    const where: any = {};
    if (billId) where.billId = Number(billId);
    if (channel) where.channel = channel;

    const { count, rows } = await PaymentRecord.findAndCountAll({
      where,
      include: [{ model: Bill, as: 'bill', attributes: ['id', 'billNo', 'period', 'totalAmount'] }],
      limit: Number(pageSize),
      offset: (Number(page) - 1) * Number(pageSize),
      order: [['paidAt', 'DESC']],
    });
    res.json({ code: 200, data: { total: count, list: rows, page: Number(page), pageSize: Number(pageSize) } });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

export default router;
