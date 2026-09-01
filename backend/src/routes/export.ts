import { Router } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { buildExcelExport, getReportRows } from '../services/report-export.js';

const router = Router();

// GET /api/export/report-list —— 可服务端导出的报表键
router.get('/report-list', async (_req: AuthRequest, res) => {
  res.json({ code: 200, data: { keys: ['collection-rate', 'rent-summary', 'energy', 'occupancy', 'aging', 'revenue', 'work-order-cost', 'tenant-retention', 'budget-vs-actual', 'cashflow-forecast'] } });
});

// POST /api/export/excel —— 服务端生成多 Sheet Excel 报表包（下载）
router.post('/excel', async (req: AuthRequest, res) => {
  try {
    const { reportKeys, params } = req.body;
    const keys = Array.isArray(reportKeys) && reportKeys.length ? reportKeys : ['collection-rate', 'rent-summary', 'energy'];
    const { buffer, filename } = await buildExcelExport(keys, params || {});
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${encodeURIComponent(filename)}`);
    res.send(buffer);
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// GET /api/export/preview?key= — 预览某报表数据（便于前端核对）
router.get('/preview', async (req: AuthRequest, res) => {
  try {
    const key = String(req.query.key || ''); const params = { period: String(req.query.period || ''), periodType: String(req.query.periodType || 'month') };
    const data = await getReportRows(key, params);
    res.json({ code: 200, data });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

export default router;
