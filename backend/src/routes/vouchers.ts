import { Router } from 'express';
import Voucher from '../models/Voucher.js';
import VoucherEntry from '../models/VoucherEntry.js';
import { AuthRequest } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { requireConfirmPassword } from '../middleware/confirm-password.js';
import { auditLog } from '../middleware/audit-log.js';
import { canTransition } from '../services/voucher-status-machine.js';
import { Op } from 'sequelize';
import Bill from '../models/Bill.js';
import Expense from '../models/Expense.js';
import { generateRentVoucher, generateExpenseVoucher } from '../services/voucher-generator.js';

const router = Router();

router.get('/', async (req: AuthRequest, res) => {
  try {
    const { page = 1, pageSize = 20, bookId, status, period, type } = req.query;
    const p = Math.max(1, Number(page) || 1);
    const ps = Math.min(200, Math.max(1, Number(pageSize) || 20));
    const where: any = {};
    if (bookId) where.bookId = Number(bookId);
    if (status) where.status = status;
    if (period) where.period = period;
    if (type) where.type = type;
    const { count, rows } = await Voucher.findAndCountAll({
      where, limit: ps, offset: (p - 1) * ps,
      order: [['createdAt', 'DESC']],
    });
    res.json({ code: 200, data: { total: count, list: rows, page: p, pageSize: ps } });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

router.post('/', requirePermission('finance', 'create'), auditLog('voucher', '凭证创建'), async (req: AuthRequest, res) => {
  try {
    const { entries, ...voucherData } = req.body;
    const voucher = await Voucher.create({ ...voucherData, createdBy: req.userId });
    if (entries && Array.isArray(entries)) {
      for (const entry of entries) {
        await VoucherEntry.create({ ...entry, voucherId: voucher.id });
      }
    }
    res.json({ code: 200, data: voucher, message: '凭证创建成功' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// POST /api/vouchers/generate-from-bills — 按账期批量生成收租凭证（幂等）
router.post('/generate-from-bills', requirePermission('finance', 'create'), auditLog('voucher', '批量生成收租凭证'), async (req: AuthRequest, res) => {
  try {
    const period = String(req.body.period || '');
    if (!period) return res.status(400).json({ code: 400, message: '请指定账期' });
    const where: any = { status: '已缴', paidDate: { [Op.like]: `${period}%` } };
    if (Array.isArray(req.body.billIds) && req.body.billIds.length) where.id = { [Op.in]: req.body.billIds };
    const bills = await Bill.findAll({ where });
    let generated = 0;
    for (const b of bills) { await generateRentVoucher((b as any).id, req.userId ?? 0); generated++; }
    res.json({ code: 200, data: { period, generated, total: bills.length }, message: `已处理 ${bills.length} 张账单，生成 ${generated} 张凭证` });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// POST /api/vouchers/generate-from-expenses — 批量生成费用凭证（幂等）
router.post('/generate-from-expenses', requirePermission('finance', 'create'), auditLog('voucher', '批量生成费用凭证'), async (req: AuthRequest, res) => {
  try {
    const where: any = { status: '已批准' };
    if (Array.isArray(req.body.expenseIds) && req.body.expenseIds.length) where.id = { [Op.in]: req.body.expenseIds };
    const expenses = await Expense.findAll({ where });
    let generated = 0;
    for (const e of expenses) { await generateExpenseVoucher((e as any).id, req.userId ?? 0); generated++; }
    res.json({ code: 200, data: { generated, total: expenses.length }, message: `已处理 ${expenses.length} 笔费用，生成 ${generated} 张凭证` });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const voucher = await Voucher.findByPk(req.params.id, {
      include: [{ model: VoucherEntry, as: 'entries' }],
    });
    if (!voucher) return res.status(404).json({ code: 404, message: '凭证不存在' });
    res.json({ code: 200, data: voucher });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

router.put('/:id/status', requirePermission('finance', 'approve'), requireConfirmPassword('凭证状态变更'), auditLog('voucher', '凭证审核/过账'), async (req: AuthRequest, res) => {
  try {
    const { status } = req.body;
    const voucher = await Voucher.findByPk(req.params.id);
    if (!voucher) return res.status(404).json({ code: 404, message: '凭证不存在' });
    const from = (voucher.get('status') as string) as any;
    const check = canTransition(from, status);
    if (!check.ok) return res.status(400).json({ code: 400, message: check.reason || '非法的状态流转' });
    // 记录审核/过账人
    const extra: any = {};
    if (status === '已过账') extra.approvedBy = req.userId;
    if (status === '待复核' || status === '待审核') extra.reviewedBy = req.userId;
    await voucher.update({ status, ...extra });
    res.json({ code: 200, data: voucher, message: '凭证状态已更新' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// PUT /api/vouchers/:id — 通用凭证更新（含分录）
router.put('/:id', requirePermission('finance', 'update'), auditLog('voucher', '凭证修改'), async (req: AuthRequest, res) => {
  try {
    const voucher = await Voucher.findByPk(req.params.id);
    if (!voucher) return res.status(404).json({ code: 404, message: '凭证不存在' });

    const { entries, ...voucherData } = req.body;
    // 白名单：凭证核心字段可更新；status 只能走 /:id/status 审批端点
    const VOUCHER_UPDATABLE = ['bookId', 'period', 'type', 'summary', 'voucherNo', 'date'];
    const upd: any = {};
    VOUCHER_UPDATABLE.forEach((k) => { if (voucherData[k] !== undefined) upd[k] = voucherData[k]; });
    await voucher.update(upd);

    if (entries && Array.isArray(entries)) {
      await VoucherEntry.destroy({ where: { voucherId: voucher.get('id') as number } });
      for (const entry of entries) {
        await VoucherEntry.create({ ...entry, voucherId: voucher.get('id') });
      }
    }

    const updated = await Voucher.findByPk(req.params.id, {
      include: [{ model: VoucherEntry, as: 'entries' }],
    });
    res.json({ code: 200, data: updated, message: '凭证更新成功' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

export default router;
