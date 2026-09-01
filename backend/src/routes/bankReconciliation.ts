import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { AuthRequest } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { auditLog } from '../middleware/audit-log.js';
import { reconcileBankStatement, quickReconcile } from '../services/bank-reconciler.js';

function decodeFilename(name: string): string {
  const buf = Buffer.from(name, 'latin1');
  const decoded = buf.toString('utf8');
  return decoded.includes('�') ? name : decoded;
}

const router = Router();
const uploadDir = 'uploads/bank';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB 上限，防 DoS
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    // exceljs 不支持旧版 .xls（BIFF 二进制），仅收 .xlsx / .csv
    const allowed = ['.xlsx', '.csv'];
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('仅支持 .xlsx / .csv 银行对账单；老版 .xls 请另存为 .xlsx 后重试'));
  },
});

// POST /api/bank-reconciliation/upload — 上传银行账单并执行对账
// 对账为处理性操作，用 update（出纳/会计/财务主管均有），无需 create
router.post('/upload', requirePermission('finance', 'update'), auditLog('银行对账', '上传对账'), upload.single('file'), async (req: AuthRequest, res) => {
  try {
    if (!req.file) return res.status(400).json({ code: 400, message: '请上传银行对账单文件' });
    const bankFormat = String(req.body.bankFormat || 'generic');
    const startDate = req.body.startDate ? String(req.body.startDate) : undefined;
    const endDate = req.body.endDate ? String(req.body.endDate) : undefined;
    const filePath = path.join(uploadDir, req.file.filename);
    const result = await reconcileBankStatement(filePath, bankFormat, startDate, endDate);
    res.json({ code: 200, data: result, message: '对账完成' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// POST /api/bank-reconciliation/quick — 按时间窗口快速对账
router.post('/quick', requirePermission('finance', 'update'), auditLog('银行对账', '快速对账'), async (req: AuthRequest, res) => {
  try {
    const result = await quickReconcile(String(req.body.startDate || ''), String(req.body.endDate || ''));
    res.json({ code: 200, data: result, message: '快速对账完成' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

export default router;
