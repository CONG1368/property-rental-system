import { Router } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { globalSearch } from '../services/search.js';
const router = Router();
router.get('/', async (req: AuthRequest, res) => {
  try {
    const q = String(req.query.q || '').trim();
    if (!q) return res.json({ code: 200, data: { groups: [] } });
    const groups = await globalSearch(q);
    res.json({ code: 200, data: { groups } });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});
export default router;
