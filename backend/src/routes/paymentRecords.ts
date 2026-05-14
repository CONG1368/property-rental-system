import { Router } from 'express';
import { Op } from 'sequelize';
import PaymentRecord from '../models/PaymentRecord.js';
import Bill from '../models/Bill.js';
import { AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/payment-records — 收款记录列表
router.get('/', async (req: AuthRequest, res) => {
  try {
    const { page = 1, pageSize = 20, billId, channel, startDate, endDate } = req.query;
    const where: any = {};
    if (billId) where.billId = Number(billId);
    if (channel) where.channel = channel;
    if (startDate && endDate) {
      where.paidAt = { [Op.between]: [new Date(startDate as string), new Date(endDate as string)] };
    }

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

// POST /api/payment-records — 创建收款记录
router.post('/', async (req: AuthRequest, res) => {
  try {
    const { billId, amount, channel, transactionNo, notes } = req.body;
    if (!billId || !amount || Number(amount) <= 0 || !channel) {
      return res.status(400).json({ code: 400, message: '账单ID、有效金额和收款渠道不能为空' });
    }

    const record = await PaymentRecord.create({
      billId,
      amount,
      channel,
      transactionNo: transactionNo || '',
      notes: notes || '',
      paidAt: new Date(),
      createdBy: req.userId,
    } as any);

    // 更新账单状态：检查累计收款是否已覆盖总金额
    const bill = await Bill.findByPk(billId);
    if (bill) {
      const allRecords = await PaymentRecord.findAll({ where: { billId }, attributes: ['amount'], raw: true });
      const totalPaid = allRecords.reduce((s, r) => s + Number((r as any).amount), 0);
      const billTotal = Number((bill as any).totalAmount);
      if (totalPaid >= billTotal) {
        await bill.update({ status: '已缴', paidDate: new Date(), paymentChannel: channel } as any);
      } else if (totalPaid > 0) {
        await bill.update({ status: '部分缴' } as any);
      }
    }

    res.json({ code: 200, data: record, message: '收款记录创建成功' });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

export default router;
