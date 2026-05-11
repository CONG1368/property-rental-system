import { Router } from 'express';
import Approval from '../models/Approval';
import { AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/', async (req: AuthRequest, res) => {
  try {
    const { status, contractId } = req.query;
    const where: any = { approverId: req.userId };
    if (status) where.status = status;
    if (contractId) where.contractId = Number(contractId);
    const approvals = await Approval.findAll({ where, order: [['createdAt', 'DESC']] });
    res.json({ code: 200, data: { list: approvals } });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

router.post('/:id/comment', async (req: AuthRequest, res) => {
  try {
    const approval = await Approval.findByPk(req.params.id);
    if (!approval) return res.status(404).json({ code: 404, message: '审批记录不存在' });
    await approval.update({ opinion: req.body.opinion });
    res.json({ code: 200, data: approval, message: '审批意见已添加' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

export default router;
