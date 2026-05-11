import { Router } from 'express';
import Bill from '../models/Bill';
import Contract from '../models/Contract';
import PaymentRecord from '../models/PaymentRecord';
import { AuthRequest } from '../middleware/auth';
import { Op } from 'sequelize';

const router = Router();

// GET /api/bills — 账单列表
router.get('/', async (req: AuthRequest, res) => {
  try {
    const { page = 1, pageSize = 20, status, period, contractId } = req.query;
    const where: any = {};
    if (status) where.status = status;
    if (period) where.period = period;
    if (contractId) where.contractId = Number(contractId);

    const { count, rows } = await Bill.findAndCountAll({
      where,
      include: [{ model: Contract, as: 'contract', attributes: ['id', 'contractNo', 'tenantId', 'propertyId'] }],
      limit: Number(pageSize),
      offset: (Number(page) - 1) * Number(pageSize),
      order: [['createdAt', 'DESC']],
    });
    res.json({ code: 200, data: { total: count, list: rows, page: Number(page), pageSize: Number(pageSize) } });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

// POST /api/bills/generate — 手动生成账单
router.post('/generate', async (req: AuthRequest, res) => {
  res.json({ code: 200, message: '账单生成已触发', data: { generated: 0 } });
});

// GET /api/bills/calendar — 收租日历数据
router.get('/calendar', async (req: AuthRequest, res) => {
  try {
    const { year, month } = req.query;
    const y = Number(year) || new Date().getFullYear();
    const m = Number(month) || (new Date().getMonth() + 1);
    const period = String(y) + '-' + String(m).padStart(2, '0');
    const bills = await Bill.findAll({
      where: { period },
      attributes: ['id', 'dueDate', 'totalAmount', 'status', 'contractId'],
      raw: true,
    });
    res.json({ code: 200, data: { period, bills } });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

// GET /api/bills/:id — 账单详情
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const bill = await Bill.findByPk(req.params.id, {
      include: [
        { model: Contract, as: 'contract' },
        { model: PaymentRecord, as: 'paymentRecords' },
      ],
    });
    if (!bill) return res.status(404).json({ code: 404, message: '账单不存在' });
    res.json({ code: 200, data: bill });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

// PUT /api/bills/:id — 更新账单
router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const bill = await Bill.findByPk(req.params.id);
    if (!bill) return res.status(404).json({ code: 404, message: '账单不存在' });
    await bill.update(req.body);
    res.json({ code: 200, data: bill, message: '账单更新成功' });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

// POST /api/bills/:id/pay — 记录收款
router.post('/:id/pay', async (req: AuthRequest, res) => {
  try {
    const bill = await Bill.findByPk(req.params.id);
    if (!bill) return res.status(404).json({ code: 404, message: '账单不存在' });

    const { amount, channel, transactionNo } = req.body;
    const paidAmount = Number(amount);

    // 创建收款记录
    await PaymentRecord.create({
      billId: bill.id,
      amount: paidAmount,
      channel: channel || '银行转账',
      transactionNo: transactionNo || '',
      paidAt: new Date(),
      createdBy: req.userId,
    });

    // 更新账单状态
    const newStatus = paidAmount >= Number(bill.totalAmount) ? '已缴' : '部分缴';
    await bill.update({ status: newStatus, paidDate: new Date(), paymentChannel: channel });

    res.json({ code: 200, data: bill, message: '收款记录成功' });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

export default router;
