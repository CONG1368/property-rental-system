import { Router } from 'express';
import Voucher from '../models/Voucher';
import VoucherEntry from '../models/VoucherEntry';
import { AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/', async (req: AuthRequest, res) => {
  try {
    const { page = 1, pageSize = 20, bookId, status, period, type } = req.query;
    const where: any = {};
    if (bookId) where.bookId = Number(bookId);
    if (status) where.status = status;
    if (period) where.period = period;
    if (type) where.type = type;
    const { count, rows } = await Voucher.findAndCountAll({
      where, limit: Number(pageSize), offset: (Number(page) - 1) * Number(pageSize),
      order: [['createdAt', 'DESC']],
    });
    res.json({ code: 200, data: { total: count, list: rows, page: Number(page), pageSize: Number(pageSize) } });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

router.post('/', async (req: AuthRequest, res) => {
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

router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const voucher = await Voucher.findByPk(req.params.id, {
      include: [{ model: VoucherEntry, as: 'entries' }],
    });
    if (!voucher) return res.status(404).json({ code: 404, message: '凭证不存在' });
    res.json({ code: 200, data: voucher });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

router.put('/:id/status', async (req: AuthRequest, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['草稿', '待复核', '待审核', '已过账', '已作废'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ code: 400, message: '无效凭证状态' });
    }
    const voucher = await Voucher.findByPk(req.params.id);
    if (!voucher) return res.status(404).json({ code: 404, message: '凭证不存在' });
    await voucher.update({ status });
    res.json({ code: 200, data: voucher, message: '凭证状态已更新' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// PUT /api/vouchers/:id — 通用凭证更新（含分录）
router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const voucher = await Voucher.findByPk(req.params.id);
    if (!voucher) return res.status(404).json({ code: 404, message: '凭证不存在' });

    const { entries, ...voucherData } = req.body;
    await voucher.update(voucherData);

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
