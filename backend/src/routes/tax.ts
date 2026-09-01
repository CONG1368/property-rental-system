import { Router } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { auditLog } from '../middleware/audit-log.js';
import AuditLog from '../models/AuditLog.js';
import { calculateTaxes, getCachedTaxes, invalidateTaxCache } from '../services/tax-calculator.js';
import { exportTaxData } from '../services/tax-exporter.js';

const router = Router();

// 生成最近 n 个月的期间列表（YYYY-MM），正确处理跨年
function recentPeriods(n: number): string[] {
  const now = new Date();
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'));
  }
  return out;
}

// GET /tax — 税务数据列表
router.get('/', requirePermission('finance', 'read'), async (req: AuthRequest, res) => {
  try {
    const reports: any[] = [];
    const periods = recentPeriods(12);
    for (let i = 0; i < periods.length; i++) {
      try {
        const result = await getCachedTaxes(periods[i]);
        reports.push({ id: i + 1, period: periods[i], ...result });
      } catch { /* skip */ }
    }
    res.json({ code: 200, data: { list: reports } });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message || '获取税务数据失败' }); }
});

// GET /tax/calculate — 税金计算(查询)
router.get('/calculate', requirePermission('finance', 'read'), async (req: AuthRequest, res) => {
  try {
    const period = (req.query.period as string) || undefined;
    const result = await getCachedTaxes(period);
    res.json({ code: 200, data: result, message: '税金计算完成' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message || '税金计算失败' }); }
});

// GET /tax/calculations — 获取指定期间的税金计算结果
router.get('/calculations', requirePermission('finance', 'read'), async (req: AuthRequest, res) => {
  try {
    const period = (req.query.period as string) || undefined;
    const result = await getCachedTaxes(period);
    res.json({ code: 200, data: result });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message || '获取税金计算失败' }); }
});

// POST /tax/calculate — 触发税金计算（写操作：需财务主管/管理员/会计）
router.post('/calculate', requirePermission('finance', 'create'), auditLog('税务', '税金计算'), async (req: AuthRequest, res) => {
  try {
    const period = req.body?.period || undefined;
    const result = await calculateTaxes(period);
    invalidateTaxCache(period); // 手动重算后使缓存失效
    res.json({ code: 200, message: '税金计算完成', data: result });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message || '税金计算失败' }); }
});

// GET /tax/export — 导出税务申报数据（需导出权限）
// 注意：res.download 不经过 auditLog 的 res.json 拦截，此处显式记录审计
router.get('/export', requirePermission('finance', 'export'), async (req: AuthRequest, res) => {
  try {
    const type = (req.query.type as string) || 'vat';
    const period = (req.query.period as string) || '';
    const format = (req.query.format as string) || 'excel';

    if (!['vat', 'property-tax', 'land-tax', 'stamp-tax', 'cit'].includes(type)) {
      return res.status(400).json({ code: 400, message: '不支持的税种: ' + type });
    }
    if (!['excel', 'csv', 'xml'].includes(format)) {
      return res.status(400).json({ code: 400, message: '不支持的导出格式: ' + format });
    }

    const filePath = await exportTaxData({ type: type as any, period, format: format as any });
    const fileName = filePath.split('/').pop() || filePath.split('\\').pop() || 'export.xlsx';
    if (req.userId) {
      AuditLog.create({
        userId: req.userId, action: '导出申报数据', module: '税务',
        targetType: '/tax/export', targetId: '', detail: JSON.stringify({ type, period, format }),
        ip: req.ip || '',
      } as any).catch(() => {});
    }
    res.download(filePath, fileName);
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message || '导出失败' }); }
});

// GET /tax/reports — 历史税务报告列表
router.get('/reports', requirePermission('finance', 'read'), async (_req: AuthRequest, res) => {
  try {
    // 生成最近12个月的税务报告摘要
    const reports: any[] = [];
    const periods = recentPeriods(12);
    for (let i = 0; i < periods.length; i++) {
      try {
        const result = await getCachedTaxes(periods[i]);
        reports.push({ id: i + 1, period: periods[i], ...result });
      } catch { /* 跳过无数据期间 */ }
    }
    res.json({ code: 200, data: { list: reports } });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message || '获取报告失败' }); }
});

export default router;
