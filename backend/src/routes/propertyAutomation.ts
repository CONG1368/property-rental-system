import { Router } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { runPropertyAutomation } from '../services/property-automation.js';

const router = Router();

// POST /api/property-automation/run — 执行物业自动化（SLA/到期/维保提醒）
router.post('/run', async (_req: AuthRequest, res) => {
  try {
    const result = await runPropertyAutomation();
    res.json({ code: 200, data: result, message: `自动化完成：升级工单 ${result.escalatedOrders}，设备到期 ${result.expiringFacilities}，合同到期 ${result.expiringContracts}，异常 ${result.anomalies || 0}` });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

export default router;
