import { Router } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { requireConfirmPassword } from '../middleware/confirm-password.js';
import { auditLog } from '../middleware/audit-log.js';
import { Op, fn, col } from 'sequelize';
import Invoice from '../models/Invoice.js';

const router = Router();

// 生成发票号：INV + 日期(YYYYMMDD) + 时间戳(ms)尾6位 + 随机3位，显著降低碰撞概率
function generateInvoiceNo(): string {
  const d = new Date();
  const datePart = '' + d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
  const timePart = String(Date.now()).slice(-6);
  const rand = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
  return 'INV' + datePart + timePart + rand;
}

// GET /api/invoices — 发票列表（type/status/keyword 过滤，分页，按 createdAt DESC）
router.get('/', requirePermission('finance', 'read'), async (req: AuthRequest, res) => {
  try {
    const { page = '1', pageSize = '20', type, status, keyword } = req.query;
    const p = Math.max(1, Number(page) || 1);
    const ps = Math.min(200, Math.max(1, Number(pageSize) || 20));
    const where: any = {};
    if (type) where.type = type;
    if (status) where.status = status;
    if (keyword) {
      const kw = '%' + keyword + '%';
      where[Op.or] = [
        { invoiceNo: { [Op.like]: kw } },
        { title: { [Op.like]: kw } },
        { buyerName: { [Op.like]: kw } },
        { buyerTaxNo: { [Op.like]: kw } },
        { sellerCompany: { [Op.like]: kw } },
      ];
    }
    const { count, rows } = await Invoice.findAndCountAll({
      where,
      limit: ps,
      offset: (p - 1) * ps,
      order: [['createdAt', 'DESC']],
    });
    res.json({ code: 200, data: { total: count, list: rows, page: p, pageSize: ps } });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// GET /api/invoices/stats — 统计（total/待开票/已开票/已作废/开票金额SUM）
router.get('/stats', requirePermission('finance', 'read'), async (_req: AuthRequest, res) => {
  try {
    const [total, pending, issued, voided, issuedAmountResult] = await Promise.all([
      Invoice.count(),
      Invoice.count({ where: { status: '待开票' } }),
      Invoice.count({ where: { status: '已开票' } }),
      Invoice.count({ where: { status: '已作废' } }),
      Invoice.findOne({
        where: { status: '已开票' },
        attributes: [[fn('SUM', col('amount')), 'total']],
        raw: true,
      }),
    ]);
    const issuedAmount = Number((issuedAmountResult as any)?.total || 0);
    res.json({ code: 200, data: { total, pending, issued, voided, issuedAmount } });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// GET /api/invoices/:id — 发票详情
router.get('/:id', requirePermission('finance', 'read'), async (req: AuthRequest, res) => {
  try {
    const inv = await Invoice.findByPk(req.params.id);
    if (!inv) return res.status(404).json({ code: 404, message: '发票不存在' });
    res.json({ code: 200, data: inv });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// POST /api/invoices — 创建发票（自动生成 invoiceNo；对唯一键碰撞自动重试）
router.post('/', requirePermission('finance', 'create'), auditLog('发票', '新增'), async (req: AuthRequest, res) => {
  try {
    const body = req.body || {};
    const amount = Number(body.amount || 0);
    const taxRate = Number(body.taxRate ?? 0.06);
    const taxAmount = body.taxAmount !== undefined && body.taxAmount !== null ? Number(body.taxAmount) : Number((amount * taxRate).toFixed(2));
    const base = { ...body, amount, taxRate, taxAmount, createdBy: req.userId ?? null };
    let inv;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        inv = await Invoice.create({ ...base, invoiceNo: base.invoiceNo || generateInvoiceNo() } as any);
        break;
      } catch (e: any) {
        // 唯一键碰撞（invoiceNo）则换号重试；其他错误直接抛出
        if (e?.name === 'SequelizeUniqueConstraintError' && attempt < 2) continue;
        throw e;
      }
    }
    res.json({ code: 200, data: inv, message: '发票已创建' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// PUT /api/invoices/:id — 更新发票
// 白名单字段：状态(中Status/invoiceNo/taxAmount)只能走开票/作废/红冲等审批端点，禁止在此直接写入
const INVOICE_UPDATABLE = ['title', 'type', 'buyerName', 'buyerTaxNo', 'buyerAddress', 'buyerBank', 'buyerAccount', 'sellerCompany', 'sellerTaxNo', 'amount', 'taxRate', 'remark'];
router.put('/:id', requirePermission('finance', 'update'), auditLog('发票', '修改'), async (req: AuthRequest, res) => {
  try {
    const inv = await Invoice.findByPk(req.params.id);
    if (!inv) return res.status(404).json({ code: 404, message: '发票不存在' });
    const upd: any = {};
    INVOICE_UPDATABLE.forEach((k) => { if (req.body[k] !== undefined) upd[k] = req.body[k]; });
    // 金额联动重算税额
    if (upd.amount !== undefined) { const rate = upd.taxRate !== undefined ? Number(upd.taxRate) : Number(inv.get('taxRate') || 0); upd.taxAmount = Number((Number(upd.amount) * rate).toFixed(2)); }
    await inv.update(upd);
    res.json({ code: 200, data: inv, message: '发票已更新' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// DELETE /api/invoices/:id — 删除发票
router.delete('/:id', requirePermission('finance', 'delete'), requireConfirmPassword('删除发票'), auditLog('发票', '删除'), async (req: AuthRequest, res) => {
  try {
    const inv = await Invoice.findByPk(req.params.id);
    if (!inv) return res.status(404).json({ code: 404, message: '发票不存在' });
    await inv.destroy();
    res.json({ code: 200, message: '发票已删除' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// POST /api/invoices/:id/issue — 开票（status='已开票'、invoiceDate=今天），仅待开票可开
router.post('/:id/issue', requirePermission('finance', 'approve'), auditLog('发票', '开票'), async (req: AuthRequest, res) => {
  try {
    const inv = await Invoice.findByPk(req.params.id);
    if (!inv) return res.status(404).json({ code: 404, message: '发票不存在' });
    if (inv.get('status') !== '待开票') return res.status(400).json({ code: 400, message: '仅「待开票」状态可开票' });
    await inv.update({ status: '已开票', invoiceDate: new Date().toISOString().slice(0, 10) } as any);
    res.json({ code: 200, data: inv, message: '开票成功' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// POST /api/invoices/:id/void — 作废（仅待开票/已开票可作废）
router.post('/:id/void', requirePermission('finance', 'approve'), requireConfirmPassword('作废发票'), auditLog('发票', '作废'), async (req: AuthRequest, res) => {
  try {
    const inv = await Invoice.findByPk(req.params.id);
    if (!inv) return res.status(404).json({ code: 404, message: '发票不存在' });
    const st = inv.get('status') as string;
    if (st === '已作废' || st === '已红冲') return res.status(400).json({ code: 400, message: '当前状态不可作废' });
    await inv.update({ status: '已作废' } as any);
    res.json({ code: 200, data: inv, message: '发票已作废' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// POST /api/invoices/:id/redflush — 红冲（仅已开票可红冲）
router.post('/:id/redflush', requirePermission('finance', 'approve'), requireConfirmPassword('红冲发票'), auditLog('发票', '红冲'), async (req: AuthRequest, res) => {
  try {
    const inv = await Invoice.findByPk(req.params.id);
    if (!inv) return res.status(404).json({ code: 404, message: '发票不存在' });
    if (inv.get('status') !== '已开票') return res.status(400).json({ code: 400, message: '仅「已开票」状态可红冲' });
    await inv.update({ status: '已红冲' } as any);
    res.json({ code: 200, data: inv, message: '发票已红冲' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

export default router;
