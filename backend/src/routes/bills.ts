import { Router } from 'express';
import Bill from '../models/Bill.js';
import BillItem from '../models/BillItem.js';
import Contract from '../models/Contract.js';
import Tenant from '../models/Tenant.js';
import Property from '../models/Property.js';
import PaymentRecord from '../models/PaymentRecord.js';
import { AuthRequest } from '../middleware/auth.js';
import { Op } from 'sequelize';
import { getScopedContractIds, recordInScope } from '../services/data-scope.js';
import { reconcilePayment } from '../services/payment-reconciler.js';
import { requirePermission } from '../middleware/rbac.js';

const router = Router();

// 账单明细行归一化：没给金额时按「单价 × 数量 × (月数 || 1)」算出来（用户 2026-10-10，方案 B）
function normalizeItemLines(raw: any[]): any[] {
  return (Array.isArray(raw) ? raw : []).map((it: any, i: number) => {
    const unitPrice = Number(it?.unitPrice || 0);
    const quantity = Number(it?.quantity || 0);
    const months = Number(it?.months || 0);
    const hasAmount = it?.amount !== undefined && it?.amount !== null && it?.amount !== '';
    const amount = hasAmount ? Number(it.amount) : lineAmount(unitPrice, quantity, months);
    return {
      name: String(it?.name || '').trim() || `费用${i + 1}`,
      unit: String(it?.unit || ''),
      unitPrice,
      quantity,
      months,
      amount: Number(Number(amount || 0).toFixed(2)),
      source: String(it?.source || '手工'),
      remark: String(it?.remark || ''),
      sortOrder: Number(it?.sortOrder ?? i),
    };
  }).filter((l: any) => l.amount > 0 || l.unitPrice > 0);
}

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
    const bScope = await getScopedContractIds(req.userId);
    if (Array.isArray(bScope)) where.contractId = { [Op.in]: bScope };

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
import { buildManualBillItems, summarizeItems, lineAmount } from '../services/bill-items.js';

// POST /api/bills — 手动创建账单
router.post('/', requirePermission('rent', 'create'), async (req: AuthRequest, res) => {
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

    // 明细行：前端可直接传 items；不传就按四个金额字段自动拼行，保证每张账单都有明细
    let lines = normalizeItemLines(req.body.items);
    if (lines.length === 0) {
      lines = buildManualBillItems({
        rentAmount: rent, waterFee: water, electricFee: elec, propertyFee: prop, otherAmount: other,
        months: Number(req.body.periodMonths || 1),
      });
    }
    // 明细 → 账单固定费用列与合计（老报表/凭证/列表继续可用）
    const cols = summarizeItems(lines);

    const billNo = `BL-${contract.contractNo}-${period}-M`;
    const bill = await Bill.create({
      contractId: Number(contractId),
      billNo,
      period,
      rentAmount: cols.rentAmount,
      waterFee: cols.waterFee,
      electricFee: cols.electricFee,
      utilityAmount: cols.utilityAmount,
      propertyFee: cols.propertyFee,
      otherAmount: cols.otherAmount,
      lateFee: 0,
      totalAmount: cols.totalAmount,
      dueDate: new Date(dueDate),
      status: '未缴',
      periodMonths: Number(req.body.periodMonths || 1),
    } as any);
    if (lines.length > 0) {
      await BillItem.bulkCreate(lines.map((l) => ({ ...l, billId: (bill as any).id })) as any);
    }
    res.json({ code: 200, data: { ...(bill as any).toJSON(), items: lines }, message: '账单创建成功' });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

// DELETE /api/bills/:id — 删除账单
router.delete('/:id', requirePermission('rent', 'delete'), async (req: AuthRequest, res) => {
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
router.post('/generate', requirePermission('rent', 'create'), async (req: AuthRequest, res) => {
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
        { model: BillItem, as: 'items' },
        { model: Contract, as: 'contract', include: [
          { model: Tenant, as: 'tenant', attributes: ['id', 'name'] },
          { model: Property, as: 'property', attributes: ['id', 'name'] },
        ]},
        { model: PaymentRecord, as: 'paymentRecords' },
      ],
    });
    if (!bill) return res.status(404).json({ code: 404, message: '账单不存在' });
    if (!(await recordInScope(bill, req.userId, 'bill'))) return res.status(403).json({ code: 403, message: '权限不足' });
    // 明细按 sortOrder 返回，保证展示顺序稳定
    const data: any = (bill as any).toJSON();
    if (Array.isArray(data.items)) data.items.sort((x: any, y: any) => (Number(x.sortOrder) || 0) - (Number(y.sortOrder) || 0));
    res.json({ code: 200, data });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

// PUT /api/bills/:id — 更新账单
router.put('/:id', requirePermission('rent', 'update'), async (req: AuthRequest, res) => {
  try {
    const bill = await Bill.findByPk(req.params.id);
    if (!bill) return res.status(404).json({ code: 404, message: '账单不存在' });

    // 传了 items 就整表替换账单明细，并按明细重算固定费用列与合计（用户 2026-10-10，方案 B）
    if (req.body?.items !== undefined) {
      if (!Array.isArray(req.body.items)) return res.status(400).json({ code: 400, message: '明细格式不正确' });
      const lines = normalizeItemLines(req.body.items);
      await BillItem.destroy({ where: { billId: bill.id } });
      if (lines.length > 0) {
        await BillItem.bulkCreate(lines.map((l) => ({ ...l, billId: bill.id })) as any);
      }
      const { items, ...rest } = req.body;
      const lateFee = rest.lateFee !== undefined ? Number(rest.lateFee) : Number((bill as any).lateFee || 0);
      const cols = summarizeItems(lines, lateFee);
      await bill.update({ ...rest, ...cols, lateFee } as any);
      res.json({ code: 200, data: { ...(bill as any).toJSON(), items: lines }, message: '账单明细已更新' });
      return;
    }

    const { items, ...rest } = req.body || {};
    await bill.update(rest);
    res.json({ code: 200, data: bill, message: '账单更新成功' });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

// POST /api/bills/:id/pay — 记录收款（对接对账引擎）
router.post('/:id/pay', requirePermission('rent', 'approve'), async (req: AuthRequest, res) => {
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
