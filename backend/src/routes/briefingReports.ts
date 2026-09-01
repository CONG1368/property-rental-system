import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { AuthRequest } from '../middleware/auth.js';
import { generateMonthlyBriefing } from '../services/briefing-report.js';
import { broadcastNotification } from '../services/notification.js';

const REPORT_DIR = path.join(process.cwd(), 'reports');
const router = Router();

// POST /api/briefing-reports/generate — 手动生成本月简报 PDF
router.post('/generate', async (_req: AuthRequest, res) => {
  try {
    const result = await generateMonthlyBriefing();
    await broadcastNotification('月度经营简报已生成', `${result.month} 月度经营简报已生成并归档。`);
    res.json({ code: 200, data: result, message: `已生成 ${result.month} 月度简报 PDF` });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// GET /api/briefing-reports/list — 已归档简报列表
router.get('/list', async (_req: AuthRequest, res) => {
  try {
    if (!fs.existsSync(REPORT_DIR)) return res.json({ code: 200, data: { list: [] } });
    const files = fs.readdirSync(REPORT_DIR).filter(f => f.endsWith('.pdf')).sort().reverse()
      .map(name => { const st = fs.statSync(path.join(REPORT_DIR, name)); return { name, size: st.size, mtime: st.mtime }; });
    res.json({ code: 200, data: { list: files } });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// GET /api/briefing-reports/download/:name — 下载 PDF
router.get('/download/:name', async (req: AuthRequest, res) => {
  try {
    const name = path.basename(String(req.params.name));
    if (!name.endsWith('.pdf')) return res.status(400).json({ code: 400, message: '非法文件名' });
    const filePath = path.join(REPORT_DIR, name);
    if (!fs.existsSync(filePath)) return res.status(404).json({ code: 404, message: '文件不存在' });
    res.download(filePath, name);
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

export default router;
