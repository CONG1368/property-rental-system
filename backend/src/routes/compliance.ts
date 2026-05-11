import { Router } from 'express';
import { AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/check/:id', async (req: AuthRequest, res) => {
  res.json({
    code: 200,
    data: {
      passed: true,
      checks: [
        { name: '条款完整性', passed: true },
        { name: '法规符合性', passed: true },
        { name: '格式规范性', passed: true },
      ],
    },
  });
});

router.get('/reports', async (req: AuthRequest, res) => {
  res.json({ code: 200, data: { list: [] } });
});

export default router;
