import { Router } from 'express';
import ApprovalRequest from '../models/ApprovalRequest.js';
import FlowDefinition from '../models/FlowDefinition.js';
import Contract from '../models/Contract.js';
import Budget from '../models/Budget.js';
import Expense from '../models/Expense.js';
import { AuthRequest } from '../middleware/auth.js';
import { Op } from 'sequelize';

const router = Router();

// POST /api/approval-requests — 提交审批（按 bizType 找到流程并进入第一步）
router.post('/', async (req: AuthRequest, res) => {
  try {
    const { bizType, bizId, bizNo, title, applicantName, amount } = req.body;
    if (!bizType || !title) return res.status(400).json({ code: 400, message: '业务类型与标题必填' });
    const flow = await FlowDefinition.findOne({ where: { bizType, status: '启用' } });
    if (!flow) return res.status(400).json({ code: 400, message: '该业务类型未配置审批流程' });
    const steps = (flow as any).steps || [];
    if (!steps.length) return res.status(400).json({ code: 400, message: '流程未配置审批节点' });
    const created = await ApprovalRequest.create({
      bizType, bizId: bizId || null, bizNo: bizNo || '', title, applicantId: req.userId,
      applicantName: applicantName || req.username || '', amount: Number(amount || 0),
      status: '待审批', currentStep: 0, currentRole: steps[0].role, comment: '',
    } as any);
    res.json({ code: 200, data: created, message: '已提交审批' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// GET /api/approval-requests/pending?role= — 待我审批
router.get('/pending', async (req: AuthRequest, res) => {
  try {
    // 仅本人角色可查待审批；管理员可指定角色
    const role = req.role === '管理员' ? String(req.query.role || req.role || '') : String(req.role || '');
    const where: any = { status: { [Op.in]: ['待审批', '审批中'] } };
    if (role) where.currentRole = role;
    const rows = await ApprovalRequest.findAll({ where, order: [['createdAt', 'DESC']] });
    res.json({ code: 200, data: { list: rows } });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// GET /api/approval-requests/my — 我发起的
router.get('/my', async (req: AuthRequest, res) => {
  try {
    const rows = await ApprovalRequest.findAll({ where: { applicantId: req.userId }, order: [['createdAt', 'DESC']] });
    res.json({ code: 200, data: { list: rows } });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// GET /api/approval-requests — 全部(按状态/类型过滤)
router.get('/', async (req: AuthRequest, res) => {
  try {
    if (req.role !== '管理员') return res.status(403).json({ code: 403, message: '仅管理员可查看全部审批' });
    const { status } = req.query;
    const where: any = {};
    if (status) where.status = status;
    const rows = await ApprovalRequest.findAll({ where, order: [['createdAt', 'DESC']] });
    res.json({ code: 200, data: { list: rows } });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// POST /api/approval-requests/:id/approve — 通过并流转到下一节点
router.post('/:id/approve', async (req: AuthRequest, res) => {
  try {
    const r = await ApprovalRequest.findByPk(req.params.id);
    if (!r) return res.status(404).json({ code: 404, message: '审批单不存在' });
    if (req.role !== '管理员' && req.role !== (r as any).currentRole) return res.status(403).json({ code: 403, message: '非当前审批节点角色' });
    const flow = await FlowDefinition.findOne({ where: { bizType: (r as any).bizType, status: '启用' } });
    const steps = (flow as any)?.steps || ((r as any).steps || []);
    const next = (r as any).currentStep + 1;
    let final = false;
    if (next >= steps.length) {
      await r.update({ status: '已通过', currentStep: next, comment: req.body.comment || '' });
      final = true;
    } else {
      await r.update({ status: '审批中', currentStep: next, currentRole: steps[next].role, comment: req.body.comment || '' });
    }
    if (final && (r as any).bizType === '合同') { try { await Contract.update({ status: '已签订' }, { where: { id: (r as any).bizId } } as any); } catch { /* 忽略 */ } }
    if (final && (r as any).bizType === '预算') { try { await Budget.update({ status: '已批准' }, { where: { id: (r as any).bizId } } as any); } catch { /* 忽略 */ } }
    if (final && (r as any).bizType === '费用') { try { await Expense.update({ status: '已批准' }, { where: { id: (r as any).bizId } } as any); } catch { /* 忽略 */ } }
    res.json({ code: 200, data: r, message: '已通过' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// POST /api/approval-requests/:id/reject — 驳回
router.post('/:id/reject', async (req: AuthRequest, res) => {
  try {
    const r = await ApprovalRequest.findByPk(req.params.id);
    if (!r) return res.status(404).json({ code: 404, message: '审批单不存在' });
    if (req.role !== '管理员' && req.role !== (r as any).currentRole) return res.status(403).json({ code: 403, message: '非当前审批节点角色' });
    await r.update({ status: '已驳回', comment: req.body.comment || '' });
    if ((r as any).bizType === '合同') { try { await Contract.update({ status: '已驳回' }, { where: { id: (r as any).bizId } } as any); } catch { /* 忽略 */ } }
    if ((r as any).bizType === '预算') { try { await Budget.update({ status: '编制中' }, { where: { id: (r as any).bizId } } as any); } catch { /* 忽略 */ } }
    res.json({ code: 200, data: r, message: '已驳回' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

export default router;
