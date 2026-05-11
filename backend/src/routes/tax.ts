import { Router } from 'express';
import { AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/calculations', async (req: AuthRequest, res) => {
  res.json({
    code: 200,
    data: {
      vat: { output: 0, input: 0, payable: 0 },
      propertyTax: { fromRent: 0, fromValue: 0 },
      urbanLandTax: 0,
      stampTax: 0,
      cit: { quarterly: 0, annual: 0 },
    },
  });
});

router.post('/calculate', async (req: AuthRequest, res) => {
  res.json({ code: 200, message: '税金计算完成', data: {} });
});

router.get('/reports', async (req: AuthRequest, res) => {
  res.json({ code: 200, data: { list: [] } });
});

export default router;
