import { Router } from 'express';
import Approval from '../models/Approval.js';
import Contract from '../models/Contract.js';
import { AuthRequest } from '../middleware/auth.js';
import { transitionContract } from '../services/contract-workflow.js';

const router = Router();

// GET /approvals — 审批列表（管理员/总经理可查看全部，其他人只看自己的）
router.get('/', async (req: AuthRequest, res) => {
  try {
    const { status, contractId } = req.query;
    const where: any = {};
    if (req.role !== '管理员' && req.role !== '总经理') {
      where.approverId = req.userId;
    }
    if (status) where.status = status;
    if (contractId) where.contractId = Number(contractId);
    const approvals = await Approval.findAll({
      where,
      include: [{ model: Contract, as: 'contract', attributes: ['id', 'contractNo', 'rentAmount', 'startDate', 'endDate', 'status'] }],
      order: [['createdAt', 'DESC']],
    });
    res.json({ code: 200, data: { list: approvals } });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// POST /approvals — 发起审批
router.post('/', async (req: AuthRequest, res) => {
  try {
    const { contractId, nodeName, approverId } = req.body;
    if (!contractId || !nodeName || !approverId) {
      return res.status(400).json({ code: 400, message: '合同ID、审批节点和审批人不能为空' });
    }
    const contract = await Contract.findByPk(contractId);
    if (!contract) return res.status(404).json({ code: 404, message: '合同不存在' });
    const approval = await Approval.create({
      contractId, nodeName, approverId,
      status: '待审批', opinion: '',
    } as any);
    res.json({ code: 200, data: approval, message: '审批已提交' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// PUT /approvals/:id — 审批通过/驳回（唯一审批入口，同时更新合同状态）
router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const approval = await Approval.findByPk(req.params.id);
    if (!approval) return res.status(404).json({ code: 404, message: '审批记录不存在' });

    const { status, opinion } = req.body;
    if (!['已通过', '已驳回'].includes(status)) {
      return res.status(400).json({ code: 400, message: '审批状态只能为"已通过"或"已驳回"' });
    }

    const contractId = (approval as any).contractId;
    const contract = await Contract.findByPk(contractId);
    if (!contract) return res.status(404).json({ code: 404, message: '关联合同不存在' });

    // 使用状态机统一处理合同状态转换
    if (status === '已通过') {
      await transitionContract(contractId, '已签订', req.userId || 1, opinion || '审批通过');
    } else {
      await transitionContract(contractId, '已驳回', req.userId || 1, opinion || '审批驳回');
    }

    // 更新审批记录
    await approval.update({
      status,
      opinion: opinion || '',
      approvedAt: new Date(),
    } as any);

    res.json({
      code: 200,
      data: approval,
      message: status === '已通过' ? '审批通过，合同已签订' : '审批驳回，合同已退回',
    });
  } catch (err: any) { res.status(400).json({ code: 400, message: err.message }); }
});

// POST /approvals/:id/comment — 添加审批意见
router.post('/:id/comment', async (req: AuthRequest, res) => {
  try {
    const approval = await Approval.findByPk(req.params.id);
    if (!approval) return res.status(404).json({ code: 404, message: '审批记录不存在' });
    await approval.update({ opinion: req.body.opinion } as any);
    res.json({ code: 200, data: approval, message: '审批意见已添加' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

export default router;
