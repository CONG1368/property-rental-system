import { Router } from 'express';
import Tenant from '../models/Tenant.js';
import Contract from '../models/Contract.js';
import { AuthRequest } from '../middleware/auth.js';
import { Op } from 'sequelize';
import { checkDuplicateIdNumber, sanitizeIdNumber, mapCardDataToTenantForm } from '../services/id-card-service.js';
import { calculateCreditScore } from '../services/credit-scorer.js';
import { getScopedTenantIds, recordInScope } from '../services/data-scope.js';
import { requirePermission } from '../middleware/rbac.js';

const router = Router();

// GET /api/tenants — 租客列表
router.get('/', async (req: AuthRequest, res) => {
  try {
    const { page = 1, pageSize = 20, keyword, creditGrade, status } = req.query;
    const where: any = {};
    if (keyword) {
      where[Op.or] = [
        { name: { [Op.like]: `%${keyword}%` } },
        { phone: { [Op.like]: `%${keyword}%` } },
      ];
    }
    if (creditGrade) where.creditGrade = creditGrade;
    if (status) where.status = status;
    const tScope = await getScopedTenantIds(req.userId);
    if (Array.isArray(tScope)) where.id = { [Op.in]: tScope };
    const { count, rows } = await Tenant.findAndCountAll({
      where,
      limit: Number(pageSize),
      offset: (Number(page) - 1) * Number(pageSize),
      order: [['createdAt', 'DESC']],
    });
    res.json({ code: 200, data: { total: count, list: rows, page: Number(page), pageSize: Number(pageSize) } });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

// POST /api/tenants — 创建租客
router.post('/', requirePermission('rent', 'create'), async (req: AuthRequest, res) => {
  try {
    // 证件信息与联系方式均为选填（用户 2026-10-10 要求）：缺省统一落空串，兼容旧库的 NOT NULL 列，
    // 同时清理 NUL 等控制字符，避免 Sequelize 内联 SQL（SQLite 把 NUL 当字符串结束）被截断
    req.body.idType = req.body.idType || '';
    req.body.idNumber = sanitizeIdNumber(req.body.idNumber);
    req.body.phone = req.body.phone || '';
    // 只在填了证件号时才做重复校验
    if (req.body.idNumber) {
      const dupCheck = await checkDuplicateIdNumber(req.body.idNumber);
      if (dupCheck.duplicate) {
        return res.status(409).json({ code: 409, message: `该身份证号已关联租客「${dupCheck.tenant?.name}」` });
      }
    }

    const tenant = await Tenant.create(req.body);
    res.json({ code: 200, data: tenant, message: '租客创建成功' });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

// GET /api/tenants/credit-scores — 租客征信列表（含评分/等级）
router.get('/credit-scores', async (req: AuthRequest, res) => {
  try {
    const { page = 1, pageSize = 20, keyword, creditGrade } = req.query;
    const where: any = {};
    if (keyword) where[Op.or] = [{ name: { [Op.like]: `%${keyword}%` } }, { phone: { [Op.like]: `%${keyword}%` } }];
    if (creditGrade) where.creditGrade = creditGrade;
    const { count, rows } = await Tenant.findAndCountAll({
      where, limit: Number(pageSize), offset: (Number(page) - 1) * Number(pageSize),
      order: [['creditScore', 'DESC']],
    });
    res.json({ code: 200, data: { total: count, list: rows, page: Number(page), pageSize: Number(pageSize) } });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

// POST /api/tenants/:id/recompute-credit — 重新评估租客征信评分
router.post('/:id/recompute-credit', requirePermission('rent', 'update'), async (req: AuthRequest, res) => {
  try {
    const tenant = await Tenant.findByPk(req.params.id);
    if (!tenant) return res.status(404).json({ code: 404, message: '租客不存在' });
    const { score, grade } = await calculateCreditScore(Number(req.params.id));
    await tenant.update({ creditScore: score, creditGrade: grade } as any);
    res.json({ code: 200, data: { score, grade }, message: '征信评分已更新' });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

// GET /api/tenants/:id — 租客详情（含关联合同）
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const tenant = await Tenant.findByPk(req.params.id, {
      include: [{ model: Contract, as: 'contracts' }],
    });
    if (!tenant) return res.status(404).json({ code: 404, message: '租客不存在' });
    if (!(await recordInScope(tenant, req.userId, 'tenant'))) return res.status(403).json({ code: 403, message: '权限不足' });
    res.json({ code: 200, data: tenant });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

// PUT /api/tenants/:id — 更新租客
router.put('/:id', requirePermission('rent', 'update'), async (req: AuthRequest, res) => {
  try {
    const tenant = await Tenant.findByPk(req.params.id);
    if (!tenant) return res.status(404).json({ code: 404, message: '租客不存在' });
    // 选填字段归一化：允许用户后续清空已登记的证件信息/联系方式
    const patch: any = { ...req.body };
    if ('idType' in patch) patch.idType = patch.idType || '';
    if ('idNumber' in patch) patch.idNumber = sanitizeIdNumber(patch.idNumber);
    if ('phone' in patch) patch.phone = patch.phone || '';
    await tenant.update(patch);
    res.json({ code: 200, data: tenant, message: '租客更新成功' });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

// POST /api/tenants/:id/check-in — 入住办理
router.post('/:id/check-in', requirePermission('rent', 'approve'), async (req: AuthRequest, res) => {
  try {
    const tenant = await Tenant.findByPk(req.params.id);
    if (!tenant) return res.status(404).json({ code: 404, message: '租客不存在' });
    await tenant.update({ status: '在租中' });
    res.json({ code: 200, data: tenant, message: '入住办理成功' });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

// DELETE /api/tenants/:id — 删除租客
router.delete('/:id', requirePermission('rent', 'delete'), async (req: AuthRequest, res) => {
  try {
    const tenant = await Tenant.findByPk(req.params.id);
    if (!tenant) return res.status(404).json({ code: 404, message: '租客不存在' });

    const contractCount = await Contract.count({ where: { tenantId: req.params.id } });
    if (contractCount > 0) {
      return res.status(400).json({ code: 400, message: `该租客存在 ${contractCount} 份关联合同，请先删除合同后再删除租客` });
    }

    await tenant.destroy();
    res.json({ code: 200, message: '租客已删除' });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

// POST /api/tenants/:id/check-out — 退租办理
router.post('/:id/check-out', requirePermission('rent', 'approve'), async (req: AuthRequest, res) => {
  try {
    const tenant = await Tenant.findByPk(req.params.id);
    if (!tenant) return res.status(404).json({ code: 404, message: '租客不存在' });
    await tenant.update({ status: '已退租' });
    res.json({ code: 200, data: tenant, message: '退租办理成功' });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

// POST /tenants/read-card-to-form — 将读卡数据映射为租客表单
router.post('/read-card-to-form', async (req: AuthRequest, res) => {
  try {
    const cardData = req.body;
    if (!cardData || !cardData.idNumber) {
      return res.status(400).json({ code: 400, message: '缺少身份证数据' });
    }
    const formData = mapCardDataToTenantForm(cardData);
    // 检查重复
    const dupCheck = await checkDuplicateIdNumber(cardData.idNumber);
    res.json({
      code: 200,
      data: { formData, duplicate: dupCheck.duplicate, duplicateTenant: dupCheck.tenant || null },
    });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

export default router;
