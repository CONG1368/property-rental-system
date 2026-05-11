import { Router } from 'express';
import { AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/balance-sheet', async (req: AuthRequest, res) => {
  res.json({ code: 200, data: { assets: [], liabilities: [], equity: [] } });
});

router.get('/income-statement', async (req: AuthRequest, res) => {
  res.json({ code: 200, data: { revenue: [], costs: [], profit: [] } });
});

router.get('/cash-flow', async (req: AuthRequest, res) => {
  res.json({ code: 200, data: { operating: [], investing: [], financing: [] } });
});

router.get('/custom', async (req: AuthRequest, res) => {
  res.json({ code: 200, data: { rows: [], columns: [] } });
});

export default router;
