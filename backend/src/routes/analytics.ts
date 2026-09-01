import { Router } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { answerQuestion } from '../services/chat-bi.js';

const router = Router();

// POST /api/analytics/ask — 智能问数（自然语言 → 指标 + 回答 + 数据）
router.post('/ask', async (req: AuthRequest, res) => {
  try {
    const question = String(req.body.question || '').trim();
    if (!question) return res.status(400).json({ code: 400, message: '请输入问题' });
    const result = await answerQuestion(question);
    res.json({ code: 200, data: result, message: '回答完成' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

export default router;
