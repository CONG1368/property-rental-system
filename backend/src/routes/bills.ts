import { Router } from 'express';
import Bill from '../models/Bill.js';
import Contract from '../models/Contract.js';
import Tenant from '../models/Tenant.js';
import Property from '../models/Property.js';
import PaymentRecord from '../models/PaymentRecord.js';
import { AuthRequest } from '../middleware/auth.js';
import { Op } from 'sequelize';
import { reconcilePayment } from '../services/payment-reconciler.js';

const router = Router();

// GET /api/bills — 账单列表
router.get('/', async (req: AuthRequest, res) => {
  try {
    const { page = 1, pageSize = 20, status, period, contractId } = req.query;
    const where: any = {};

    // 状态支持逗号分隔多值："未缴,部分缴"
    if (status) {
      const statusList = (status as string).split(',').filter(Boolean);
      where.status = statusList.length > 1 ? { [Op.in]: statusList } : status;
    }
    if (period) where.period = period;
    if (contractId) where.contractId = Number(contractId);

    const { count, rows } = await Bill.findAndCountAll({
      where,
      include: [{
        model: Contract, as: 'contract', attributes: ['id', 'contractNo', 'tenantId', 'propertyId'],
        include: [
          { model: Tenant, as: 'tenant', attributes: ['id', 'name'] },
          { model: Property, as: 'property', attributes: ['id', 'name'] },
        ],
      }],
      limit: Number(pageSize),
      offset: (Number(page) - 1) * Number(pageSize),
      order: [['createdAt', 'DESC']],
    });
    res.json({ code: 200, data: { total: count, list: rows, page: Number(page), pageSize: Number(pageSize) } });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

import { generateBills } from '../services/bill-generator.js';

// POST /api/bills — 手动创建账单
router.post('/', async (req: AuthRequest, res) => {
  try {
    const { contractId, period, rentAmount, waterFee, electricFee, propertyFee, otherAmount, dueDate } = req.body;
    if (!contractId || !period || !dueDate) {
      return res.status(400).json({ code: 400, message: '合同、账期、到期日为必填项' });
    }
    const contract = await Contract.findByPk(Number(contractId));
    if (!contract) return res.status(404).json({ code: 404, message: '合同不存在' });

    const rent = Number(rentAmount || 0);
    const water = Number(waterFee || 0);
    const elec = Number(electricFee || 0);
    const prop = Number(propertyFee || 0);
    const other = Number(otherAmount || 0);
    const total = rent + water + elec + prop + other;

    const billNo = `BL-${contract.contractNo}-${period}-M`;
    const bill = await Bill.create({
      contractId: Number(contractId),
      billNo,
      period,
      rentAmount: rent,
      waterFee: water,
      electricFee: elec,
      utilityAmount: water + elec,
      propertyFee: prop,
      otherAmount: other,
      lateFee: 0,
      totalAmount: total,
      dueDate: new Date(dueDate),
      status: '未缴',
      periodMonths: 1,
    } as any);
    res.json({ code: 200, data: bill, message: '账单创建成功' });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

// DELETE /api/bills/:id — 删除账单
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const bill = await Bill.findByPk(req.params.id);
    if (!bill) return res.status(404).json({ code: 404, message: '账单不存在' });
    // 只允许删除未缴账单
    if (bill.status !== '未缴') {
      return res.status(400).json({ code: 400, message: '仅允许删除未缴状态的账单' });
    }
    await bill.destroy();
    res.json({ code: 200, message: '账单已删除' });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

// POST /api/bills/generate — 手动生成账单
router.post('/generate', async (req: AuthRequest, res) => {
  try {
    const count = await generateBills();
    res.json({ code: 200, message: `成功生成${count}条账单`, data: { generated: count } });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message });
  }
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
      include: [
        { model: Contract, as: 'contract', attributes: ['id', 'contractNo'],
          include: [{ model: Tenant, as: 'tenant', attributes: ['id', 'name', 'phone'] }] },
      ],
      order: [['dueDate', 'ASC']],
    });
    res.json({
      code: 200,
      data: {
        period,
        bills: (bills as any[]).map((b) => ({
          id: b.id,
          dueDate: b.dueDate,
          rentAmount: Number(b.rentAmount || 0),
          propertyFee: Number((b as any).propertyFee || b.otherAmount || 0),
          waterFee: Number((b as any).waterFee || 0),
          electricFee: Number((b as any).electricFee || 0),
          totalAmount: Number(b.totalAmount),
          status: b.status,
          contractId: b.contractId,
          tenantId: b.contract?.tenant?.id || null,
          tenantName: b.contract?.tenant?.name || '-',
          tenantPhone: b.contract?.tenant?.phone || '',
        })),
      },
    });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

// GET /api/bills/:id — 账单详情
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const bill = await Bill.findByPk(req.params.id, {
      include: [
        { model: Contract, as: 'contract', include: [
          { model: Tenant, as: 'tenant', attributes: ['id', 'name'] },
          { model: Property, as: 'property', attributes: ['id', 'name'] },
        ]},
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

// POST /api/bills/:id/pay — 记录收款（对接对账引擎）
router.post('/:id/pay', async (req: AuthRequest, res) => {
  try {
    const bill = await Bill.findByPk(req.params.id);
    if (!bill) return res.status(404).json({ code: 404, message: '账单不存在' });

    const { amount, channel, transactionNo } = req.body;
    const payAmount = Number(amount);
    if (!payAmount || payAmount <= 0) {
      return res.status(400).json({ code: 400, message: '收款金额必须大于0' });
    }
    await reconcilePayment(
      bill.id,
      payAmount,
      channel || '银行转账',
      transactionNo || '',
      req.userId || 1
    );

    const updated = await Bill.findByPk(bill.id);
    res.json({ code: 200, data: updated, message: '收款成功，凭证已自动生成' });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

export default router;
