import { Router } from 'express';
import Contract from '../models/Contract';
import Tenant from '../models/Tenant';
import Property from '../models/Property';
import { AuthRequest } from '../middleware/auth';
import { Op } from 'sequelize';

const router = Router();

router.get('/', async (req: AuthRequest, res) => {
  try {
    const { page = 1, pageSize = 20, status, propertyId, tenantId } = req.query;
    const where: any = {};
    if (status) where.status = status;
    if (propertyId) where.propertyId = Number(propertyId);
    if (tenantId) where.tenantId = Number(tenantId);
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
    res.json({ code: 200, data: contract, message: '合同创建成功' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const contract = await Contract.findByPk(req.params.id, {
      include: [
        { model: Tenant, as: 'tenant' },
        { model: Property, as: 'property' },
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

router.post('/:id/submit', async (req: AuthRequest, res) => {
  try {
    const contract = await Contract.findByPk(req.params.id);
    if (!contract) return res.status(404).json({ code: 404, message: '合同不存在' });
    await contract.update({ status: '审批中' });
    res.json({ code: 200, data: contract, message: '合同已提交审批' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

router.post('/:id/approve', async (req: AuthRequest, res) => {
  try {
    const contract = await Contract.findByPk(req.params.id);
    if (!contract) return res.status(404).json({ code: 404, message: '合同不存在' });
    await contract.update({ status: '已签订', signedAt: new Date() });
    res.json({ code: 200, data: contract, message: '合同已审批通过' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

router.post('/:id/reject', async (req: AuthRequest, res) => {
  try {
    const contract = await Contract.findByPk(req.params.id);
    if (!contract) return res.status(404).json({ code: 404, message: '合同不存在' });
    await contract.update({ status: '已驳回' });
    res.json({ code: 200, data: contract, message: '合同已驳回' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

router.post('/:id/sign', async (req: AuthRequest, res) => {
  try {
    const contract = await Contract.findByPk(req.params.id);
    if (!contract) return res.status(404).json({ code: 404, message: '合同不存在' });
    await contract.update({ status: '执行中', signedAt: new Date() });
    res.json({ code: 200, data: contract, message: '合同已签署并生效' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

router.post('/:id/terminate', async (req: AuthRequest, res) => {
  try {
    const contract = await Contract.findByPk(req.params.id);
    if (!contract) return res.status(404).json({ code: 404, message: '合同不存在' });
    await contract.update({ status: '已终止' });
    res.json({ code: 200, data: contract, message: '合同已终止' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

router.post('/:id/renew', async (req: AuthRequest, res) => {
  try {
    const oldContract = await Contract.findByPk(req.params.id);
    if (!oldContract) return res.status(404).json({ code: 404, message: '合同不存在' });
    const newContract = await Contract.create({
      ...req.body,
      propertyId: oldContract.propertyId,
      tenantId: oldContract.tenantId,
      createdBy: req.userId,
      status: '起草中',
    });
    res.json({ code: 200, data: newContract, message: '续约合同已创建' });
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

export default router;
