import { Router, Request, Response } from 'express';
import { calculateTaxes } from '../services/tax-calculator.js';
import { exportTaxData } from '../services/tax-exporter.js';

const router = Router();

// GET /tax — 税务数据列表
router.get('/', async (req: Request, res: Response) => {
  try {
    const reports: any[] = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const period = `${now.getFullYear()}-${String(now.getMonth() + 1 - i).padStart(2, '0')}`;
      try {
        const result = await calculateTaxes(period);
        reports.push({ id: i + 1, period, ...result });
      } catch { /* skip */ }
    }
    res.json({ code: 200, data: { list: reports } });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message || '获取税务数据失败' }); }
});

// GET /tax/calculate — 税金计算
router.get('/calculate', async (req: Request, res: Response) => {
  try {
    const period = (req.query.period as string) || undefined;
    const result = await calculateTaxes(period);
    res.json({ code: 200, data: result, message: '税金计算完成' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message || '税金计算失败' }); }
});

// GET /tax/calculations — 获取指定期间的税金计算结果
router.get('/calculations', async (req: Request, res: Response) => {
  try {
    const period = (req.query.period as string) || undefined;
    const result = await calculateTaxes(period);
    res.json({ code: 200, data: result });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message || '获取税金计算失败' });
  }
});

// POST /tax/calculate — 触发税金计算
router.post('/calculate', async (req: Request, res: Response) => {
  try {
    const period = req.body?.period || undefined;
    const result = await calculateTaxes(period);
    res.json({ code: 200, message: '税金计算完成', data: result });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message || '税金计算失败' });
  }
});

// GET /tax/export — 导出税务申报数据
router.get('/export', async (req: Request, res: Response) => {
  try {
    const type = (req.query.type as string) || 'vat';
    const period = (req.query.period as string) || '';
    const format = (req.query.format as string) || 'excel';

    if (!['vat', 'property-tax', 'land-tax', 'stamp-tax', 'cit'].includes(type)) {
      return res.status(400).json({ code: 400, message: `不支持的税种: ${type}` });
    }
    if (!['excel', 'csv', 'xml'].includes(format)) {
      return res.status(400).json({ code: 400, message: `不支持的导出格式: ${format}` });
    }

    const filePath = await exportTaxData({ type: type as any, period, format: format as any });
    const fileName = filePath.split('/').pop() || filePath.split('\\').pop() || 'export.xlsx';
    res.download(filePath, fileName);
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message || '导出失败' });
  }
});

// GET /tax/reports — 历史税务报告列表
router.get('/reports', async (_req: Request, res: Response) => {
  try {
    // 生成最近12个月的税务报告摘要
    const reports: any[] = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const period = `${now.getFullYear()}-${String(now.getMonth() + 1 - i).padStart(2, '0')}`;
      try {
        const result = await calculateTaxes(period);
        reports.push({ id: i + 1, period, ...result });
      } catch {
        // 跳过无数据期间
      }
    }
    res.json({ code: 200, data: { list: reports } });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message || '获取报告失败' });
  }
});

export default router;
