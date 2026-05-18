import { Router } from 'express';
import Contract from '../models/Contract.js';
import Tenant from '../models/Tenant.js';
import Property from '../models/Property.js';
import Approval from '../models/Approval.js';
import { AuthRequest } from '../middleware/auth.js';
import { transitionContract } from '../services/contract-workflow.js';
import { transitionRoomStatus } from '../services/room-status-workflow.js';
import { broadcast } from '../websocket/index.js';
import { Op } from 'sequelize';
import dayjs from 'dayjs';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = Router();

// 合同文件上传
const contractUploadDir = 'uploads/contracts';
if (!fs.existsSync(contractUploadDir)) fs.mkdirSync(contractUploadDir, { recursive: true });
const contractUpload = multer({
  dest: contractUploadDir,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowed = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png', '.xls', '.xlsx'];
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('仅支持 PDF/DOC/DOCX/图片/Excel 格式'));
  },
});

// POST /contracts/:id/upload — 上传合同附件
router.post('/:id/upload', contractUpload.array('files', 10), async (req: AuthRequest, res) => {
  try {
    const contract = await Contract.findByPk(req.params.id);
    if (!contract) return res.status(404).json({ code: 404, message: '合同不存在' });
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ code: 400, message: '请选择要上传的文件' });
    }
    // 保存文件记录到合同的 billingConfig（复用JSON字段存储附件列表）
    const existingFiles = (contract as any).billingConfig?.attachments || [];
    const newFiles = files.map(f => ({
      name: f.originalname,
      path: f.path,
      size: f.size,
      uploadedAt: new Date().toISOString(),
    }));
    const billingConfig = (contract as any).billingConfig || {};
    billingConfig.attachments = [...existingFiles, ...newFiles];
    await contract.update({ billingConfig } as any);
    res.json({ code: 200, data: newFiles, message: `成功上传 ${files.length} 个文件` });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// GET /contracts/:id/files — 获取合同附件列表
router.get('/:id/files', async (req: AuthRequest, res) => {
  try {
    const contract = await Contract.findByPk(req.params.id);
    if (!contract) return res.status(404).json({ code: 404, message: '合同不存在' });
    const attachments = (contract as any).billingConfig?.attachments || [];
    res.json({ code: 200, data: { list: attachments } });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

router.get('/', async (req: AuthRequest, res) => {
  try {
    const { page = 1, pageSize = 20, status, propertyId, tenantId, endDateStart, endDateEnd } = req.query;
    const where: any = {};

    if (status) {
      const statusList = (status as string).split(',').filter(Boolean);
      where.status = statusList.length > 1 ? { [Op.in]: statusList } : status;
    }
    if (propertyId) where.propertyId = Number(propertyId);
    if (tenantId) where.tenantId = Number(tenantId);

    if (endDateStart && endDateEnd) {
      where.endDate = { [Op.between]: [endDateStart as string, endDateEnd as string] };
    } else if (endDateStart) {
      where.endDate = { [Op.gte]: endDateStart as string };
    } else if (endDateEnd) {
      where.endDate = { [Op.lte]: endDateEnd as string };
    }
    const { count, rows } = await Contract.findAndCountAll({
      where,
      include: [
        { model: Tenant, as: 'tenant', attributes: ['id', 'name', 'phone'] },
        { model: Property, as: 'property', attributes: ['id', 'name', 'address'] },
      ],
      limit: Number(pageSize), offset: (Number(page) - 1) * Number(pageSize),
      order: [['createdAt', 'DESC']],
    });
    res.json({ code: 200, data: { total: count, list: rows, page: Number(page), pageSize: Number(pageSize) } });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

router.post('/', async (req: AuthRequest, res) => {
  try {
    const contract = await Contract.create({ ...req.body, createdBy: req.userId });
    broadcast('contract:created', { contractId: contract.id, contractNo: (contract as any).contractNo, timestamp: Date.now() });
    res.json({ code: 200, data: contract, message: '合同创建成功' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

router.get('/expiry-calendar', async (req: AuthRequest, res) => {
  try {
    const contracts = await Contract.findAll({
      where: { status: '执行中', endDate: { [Op.gte]: new Date() } },
      order: [['endDate', 'ASC']],
      limit: 50,
    });
    res.json({ code: 200, data: { list: contracts } });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const contract = await Contract.findByPk(req.params.id, {
      include: [
        { model: Tenant, as: 'tenant' },
        { model: Property, as: 'property' },
        { model: Approval, as: 'approvals' },
      ],
    });
    if (!contract) return res.status(404).json({ code: 404, message: '合同不存在' });
    res.json({ code: 200, data: contract });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const contract = await Contract.findByPk(req.params.id);
    if (!contract) return res.status(404).json({ code: 404, message: '合同不存在' });
    await contract.update(req.body);
    res.json({ code: 200, data: contract, message: '合同更新成功' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// ====== 状态流转（统一使用 transitionContract，并同步创建/更新 Approval 记录） ======

// 提交审批 → 创建审批记录
router.post('/:id/submit', async (req: AuthRequest, res) => {
  try {
    const contract = await Contract.findByPk(req.params.id);
    if (!contract) return res.status(404).json({ code: 404, message: '合同不存在' });
    await transitionContract(contract.id, '审批中', req.userId || 1, '提交审批');
    await Approval.create({
      contractId: contract.id,
      nodeName: '合同审批',
      approverId: req.userId || 1,
      status: '待审批',
      opinion: '',
    } as any);
    const updated = await Contract.findByPk(req.params.id);
    res.json({ code: 200, data: updated, message: '合同已提交审批，审批记录已创建' });
  } catch (err: any) { res.status(400).json({ code: 400, message: err.message }); }
});

// 驳回（从审批中退回到已驳回）
router.post('/:id/reject', async (req: AuthRequest, res) => {
  try {
    const contract = await Contract.findByPk(req.params.id);
    if (!contract) return res.status(404).json({ code: 404, message: '合同不存在' });
    await transitionContract(contract.id, '已驳回', req.userId || 1, req.body.opinion || '审批驳回');
    await Approval.update(
      { status: '已驳回', approvedAt: new Date(), opinion: req.body.opinion || '驳回' } as any,
      { where: { contractId: contract.id, status: '待审批' } }
    );
    const updated = await Contract.findByPk(req.params.id);
    res.json({ code: 200, data: updated, message: '合同已驳回' });
  } catch (err: any) { res.status(400).json({ code: 400, message: err.message }); }
});

// 签署生效
router.post('/:id/sign', async (req: AuthRequest, res) => {
  try {
    const contract = await Contract.findByPk(req.params.id);
    if (!contract) return res.status(404).json({ code: 404, message: '合同不存在' });
    await transitionContract(contract.id, '执行中', req.userId || 1, '签署生效');
    await contract.update({ signedAt: new Date() });

    // 联动房源状态 → 已出租
    try {
      await transitionRoomStatus(contract.propertyId, '已出租', req.userId || 1, {
        action: 'contract_link',
        notes: `合同 ${contract.contractNo} 签署生效，自动更新房源状态`,
        linkedContractId: contract.id,
        linkedTenantId: contract.tenantId,
      });
    } catch (e: any) {
      console.warn(`[Contract] 房源状态联动失败: ${e.message}`);
    }

    const updated = await Contract.findByPk(req.params.id);
    res.json({ code: 200, data: updated, message: '合同已签署并生效' });
  } catch (err: any) { res.status(400).json({ code: 400, message: err.message }); }
});

// 终止合同
router.post('/:id/terminate', async (req: AuthRequest, res) => {
  try {
    const contract = await Contract.findByPk(req.params.id);
    if (!contract) return res.status(404).json({ code: 404, message: '合同不存在' });
    await transitionContract(contract.id, '已终止', req.userId || 1, '终止合同');

    // 联动房源状态 → 退租中
    try {
      await transitionRoomStatus(contract.propertyId, '退租中', req.userId || 1, {
        action: 'contract_link',
        notes: `合同 ${contract.contractNo} 已终止，房源进入退租流程`,
        linkedContractId: contract.id,
        linkedTenantId: contract.tenantId,
      });
    } catch (e: any) {
      console.warn(`[Contract] 房源状态联动失败: ${e.message}`);
    }

    const updated = await Contract.findByPk(req.params.id);
    res.json({ code: 200, data: updated, message: '合同已终止' });
  } catch (err: any) { res.status(400).json({ code: 400, message: err.message }); }
});

router.post('/:id/renew', async (req: AuthRequest, res) => {
  try {
    const oldContract = await Contract.findByPk(req.params.id);
    if (!oldContract) return res.status(404).json({ code: 404, message: '合同不存在' });
    const { newEndDate, newRent, notes } = req.body as any;
    const newContract = await Contract.create({
      contractNo: `R${Date.now()}-${(oldContract.contractNo || '').slice(-30)}`,
      startDate: new Date().toISOString().slice(0, 10) as any,
      endDate: (newEndDate || dayjs(oldContract.endDate).add(1, 'year').format('YYYY-MM-DD')) as any,
      rentAmount: newRent || oldContract.rentAmount,
      depositAmount: oldContract.depositAmount,
      paymentCycle: oldContract.paymentCycle,
      billingMode: oldContract.billingMode,
      billingConfig: oldContract.billingConfig,
      clauses: oldContract.clauses || [],
      propertyId: oldContract.propertyId,
      tenantId: oldContract.tenantId,
      createdBy: req.userId,
      status: '起草中',
    });
    res.json({ code: 200, data: newContract, message: '续约合同已创建' });
    broadcast('contract:renewed', { oldContractId: oldContract.id, newContractId: newContract.id, contractNo: (newContract as any).contractNo, timestamp: Date.now() });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const contract = await Contract.findByPk(req.params.id);
    if (!contract) return res.status(404).json({ code: 404, message: '合同不存在' });
    await contract.destroy();
    broadcast('contract:deleted', { contractId: Number(req.params.id), contractNo: (contract as any).contractNo, timestamp: Date.now() });
    res.json({ code: 200, message: '合同已删除' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

export default router;
