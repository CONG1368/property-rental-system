import { Router } from 'express';
import Contract from '../models/Contract.js';
import Tenant from '../models/Tenant.js';
import Property from '../models/Property.js';
import Approval from '../models/Approval.js';
import ApprovalRequest from '../models/ApprovalRequest.js';
import { submitApproval } from '../services/approval-bridge.js';
import { getScopedPropertyIds, recordInScope } from '../services/data-scope.js';
import { requirePermission } from '../middleware/rbac.js';
import { AuthRequest } from '../middleware/auth.js';
import { transitionContract } from '../services/contract-workflow.js';
import { transitionRoomStatus } from '../services/room-status-workflow.js';
import { broadcast } from '../websocket/index.js';
import { Op } from 'sequelize';
import dayjs from 'dayjs';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { readSheetAsObjects } from '../utils/excel.js';
import ContractTemplate from '../models/ContractTemplate.js';
import ContractClause from '../models/ContractClause.js';
import mammoth from 'mammoth';

function decodeFilename(name: string): string {
  const buf = Buffer.from(name, 'latin1');
  const decoded = buf.toString('utf8');
  return decoded.includes('�') ? name : decoded;
}


const router = Router();

// 合同文件上传
const contractUploadDir = 'uploads/contracts';
if (!fs.existsSync(contractUploadDir)) fs.mkdirSync(contractUploadDir, { recursive: true });
const importUploadDir = 'uploads/imports';
if (!fs.existsSync(importUploadDir)) fs.mkdirSync(importUploadDir, { recursive: true });
const importUpload = multer({
  dest: importUploadDir,
  // 20MB 上限（条款文件通常远小于此）
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    // Excel 仅支持 .xlsx —— exceljs 不支持旧版 .xls（BIFF 二进制）
    const allowed = ['.xlsx', '.docx', '.doc', '.pdf'];
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('仅支持 .xlsx / Word / PDF；老版 .xls 请另存为 .xlsx 后重试'));
  },
});
const contractUpload = multer({
  dest: contractUploadDir,
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowed = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png', '.xls', '.xlsx'];
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('仅支持 PDF/DOC/DOCX/图片/Excel 格式'));
  },
});

// POST /contracts/:id/upload — 上传合同附件
router.post('/:id/upload', requirePermission('contract', 'update'), contractUpload.array('files', 10), async (req: AuthRequest, res) => {
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
      name: decodeFilename(f.originalname),
      path: f.path,
      size: f.size,
      uploadedAt: new Date().toISOString(),
    }));
    const billingConfig = (contract as any).billingConfig || {};
    billingConfig.attachments = [...existingFiles, ...newFiles];
    (contract as any).billingConfig = billingConfig;
    (contract as any).changed('billingConfig', true);
    await contract.save();
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
    // 行级数据权限
    const propScope = await getScopedPropertyIds(req.userId);
    if (Array.isArray(propScope)) where.propertyId = { [Op.in]: propScope };

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

router.post('/', requirePermission('contract', 'create'), async (req: AuthRequest, res) => {
  try {
    const contract = await Contract.create({ ...req.body, createdBy: req.userId });
    // 条款已写入合同时，清除该租客的待处理条款
    if (req.body.tenantId && req.body.clauses && Array.isArray(req.body.clauses) && req.body.clauses.length > 0) {
      await Tenant.update({ pendingClauses: [] } as any, { where: { id: req.body.tenantId } });
    }
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
    if (!(await recordInScope(contract, req.userId, 'contract'))) return res.status(403).json({ code: 403, message: '权限不足' });
    res.json({ code: 200, data: contract });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

router.put('/:id', requirePermission('contract', 'update'), async (req: AuthRequest, res) => {
  try {
    const contract = await Contract.findByPk(req.params.id);
    if (!contract) return res.status(404).json({ code: 404, message: '合同不存在' });
    // SQLite JSON 字段必须用 .changed() 模式，不能走 update()
    if (req.body.clauses !== undefined) {
      (contract as any).clauses = req.body.clauses;
      (contract as any).changed('clauses', true);
    }
    if (req.body.billingConfig !== undefined) {
      (contract as any).billingConfig = req.body.billingConfig;
      (contract as any).changed('billingConfig', true);
    }
    // 处理标量字段
    Object.keys(req.body).forEach(key => {
      if (key !== 'clauses' && key !== 'billingConfig') {
        (contract as any)[key] = req.body[key];
      }
    });
    await contract.save();
    // 条款已写入合同时，清除该租客的待处理条款
    const hasClauses = req.body.clauses && Array.isArray(req.body.clauses) && req.body.clauses.length > 0;
    if (hasClauses && (req.body.tenantId || (contract as any).tenantId)) {
      await Tenant.update({ pendingClauses: [] } as any, { where: { id: req.body.tenantId || (contract as any).tenantId } });
    }
    res.json({ code: 200, data: contract, message: '合同更新成功' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});
// ====== 状态流转（统一使用 transitionContract，并同步创建/更新 Approval 记录） ======

// 提交审批 → 创建审批记录
router.post('/:id/submit', requirePermission('contract', 'approve'), async (req: AuthRequest, res) => {
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
    // 桥接通用审批引擎：创建 ApprovalRequest（bizType=合同）
    try { await submitApproval({
      bizType: '合同', bizId: (contract as any).id, bizNo: (contract as any).contractNo,
      title: `合同审批：${(contract as any).contractNo}`, applicantName: (req as any).username || '', amount: Number((contract as any).rentAmount || 0),
    }, req.userId); } catch { /* 无配置流程则忽略 */ }
    const updated = await Contract.findByPk(req.params.id);
    res.json({ code: 200, data: updated, message: '合同已提交审批，审批记录已创建' });
  } catch (err: any) { res.status(400).json({ code: 400, message: err.message }); }
});

// 驳回（从审批中退回到已驳回）
router.post('/:id/reject', requirePermission('contract', 'approve'), async (req: AuthRequest, res) => {
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
router.post('/:id/sign', requirePermission('contract', 'approve'), async (req: AuthRequest, res) => {
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
router.post('/:id/terminate', requirePermission('contract', 'approve'), async (req: AuthRequest, res) => {
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

router.post('/:id/renew', requirePermission('contract', 'approve'), async (req: AuthRequest, res) => {
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

router.delete('/:id', requirePermission('contract', 'delete'), async (req: AuthRequest, res) => {
  try {
    const contract = await Contract.findByPk(req.params.id);
    if (!contract) return res.status(404).json({ code: 404, message: '合同不存在' });
    await contract.destroy();
    broadcast('contract:deleted', { contractId: Number(req.params.id), contractNo: (contract as any).contractNo, timestamp: Date.now() });
    res.json({ code: 200, message: '合同已删除' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// POST /import-clauses — 批量导入条款（Excel自动匹配 / JSON手动模式）
router.post('/import-clauses', requirePermission('contract', 'create'), (req: AuthRequest, res, next) => {
  // 判断是文件上传还是JSON模式
  if (req.headers['content-type']?.includes('multipart/form-data')) {
    importUpload.single('file')(req, res, (err) => {
      if (err) return res.status(400).json({ code: 400, message: err.message });
      handleExcelImport(req, res);
    });
  } else {
    handleJsonImport(req, res);
  }
});

async function handleExcelImport(req: AuthRequest, res: any) {
  try {
    const file = (req as any).file;
    if (!file) return res.status(400).json({ code: 400, message: '请上传文件' });
    const rows: any[] = await readSheetAsObjects(file.path);
    if (rows.length === 0) return res.status(400).json({ code: 400, message: '文件中无数据' });

    const result: any = { total: rows.length, matchedTenants: 0, unmatched: [] as string[], updatedContracts: 0, skippedNoContract: 0, pendingTenants: 0, _clauses: [] as any[] };
    for (const row of rows) {
      const tenantName = row['租客姓名'] || row['name'] || '';
      const tenantPhone = row['租客手机'] || row['phone'] || '';
      const clauseTitle = row['条款标题'] || row['title'] || '';
      const clauseContent = row['条款内容'] || row['content'] || '';
      const sortOrder = parseInt(row['排序'] || row['sortOrder'] || '999');

      if (!tenantName || !clauseTitle || !clauseContent) continue;

      const where: any = { name: tenantName };
      if (tenantPhone) where.phone = tenantPhone;
      const tenant = await Tenant.findOne({ where });
      if (!tenant) { result.unmatched.push(tenantName); continue; }
      result.matchedTenants++;

      const contracts = await Contract.findAll({
        where: { tenantId: (tenant as any).id, status: { [Op.in]: ['起草中', '审批中', '已驳回', '已签订', '执行中', '到期提醒', '已到期'] } },
      });
      if (contracts.length === 0) {
        // 无合同：存储待处理条款到租客，合同起草时自动加载
        const pending: any[] = Array.isArray((tenant as any).pendingClauses) ? (tenant as any).pendingClauses : [];
        pending.push({ title: clauseTitle, content: clauseContent, sortOrder });
        (tenant as any).pendingClauses = pending;
        (tenant as any).changed('pendingClauses', true);
        await tenant.save();
        result.skippedNoContract++;
        result.pendingTenants++;
        continue;
      }

      // 同时存储到 pendingClauses，确保新建合同时也能加载
      const pending: any[] = Array.isArray((tenant as any).pendingClauses) ? (tenant as any).pendingClauses : [];
      pending.push({ title: clauseTitle, content: clauseContent, sortOrder });
      (tenant as any).pendingClauses = pending;
      (tenant as any).changed('pendingClauses', true);
      await tenant.save();
      result.pendingTenants++;

      for (const c of contracts) {
        const existing: any[] = Array.isArray((c as any).clauses) ? (c as any).clauses : [];
        existing.push({ title: clauseTitle, content: clauseContent, sortOrder });
        (c as any).clauses = existing;
        (c as any).changed('clauses', true);
        await c.save();
        result.updatedContracts++;
      }
    }

    try { fs.unlinkSync(file.path); } catch {}
    if (result._clauses && result._clauses.length > 0) await syncToTemplate(result._clauses, { propertyType: req.body.propertyType || undefined });
    const msgParts: string[] = [];
    if (result.updatedContracts > 0) msgParts.push(`${result.updatedContracts} 个合同已更新条款`);
    if (result.pendingTenants > 0) msgParts.push(`${result.pendingTenants} 个租客条款已暂存（起草合同时自动加载）`);
    if (result.unmatched.length > 0) msgParts.push(`${result.unmatched.length} 个租客未匹配`);
    if (result.skippedNoContract - result.pendingTenants > 0) msgParts.push(`${result.skippedNoContract - result.pendingTenants} 个跳过`);
    res.json({ code: 200, data: result, message: msgParts.join('；') || '导入完成' });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message || '导入失败' });
  }
}

async function handleJsonImport(req: AuthRequest, res: any) {
  try {
    const { tenantIds, clauses } = req.body;
    if (!Array.isArray(tenantIds) || tenantIds.length === 0) return res.status(400).json({ code: 400, message: '请提供租客ID列表' });
    if (!Array.isArray(clauses) || clauses.length === 0) return res.status(400).json({ code: 400, message: '请提供条款列表' });

    let updatedContracts = 0;
    let pendingTenants = 0;
    const skippedNoContract: number[] = [];

    for (const tenantId of tenantIds) {
      const contracts = await Contract.findAll({
        where: { tenantId, status: { [Op.in]: ['起草中', '审批中', '已驳回', '已签订', '执行中', '到期提醒', '已到期'] } },
      });
      if (contracts.length === 0) {
        const tenant = await Tenant.findByPk(tenantId);
        if (tenant) {
          const pending: any[] = Array.isArray((tenant as any).pendingClauses) ? (tenant as any).pendingClauses : [];
          for (const clause of clauses) {
            pending.push({ title: clause.title || '', content: clause.content || '', sortOrder: clause.sortOrder || 999 });
          }
          (tenant as any).pendingClauses = pending;
          (tenant as any).changed('pendingClauses', true);
          await tenant.save();
          pendingTenants++;
        }
        skippedNoContract.push(tenantId);
        continue;
      }

      // 同时存储到 pendingClauses，确保新建合同时也能加载
      const tenant = await Tenant.findByPk(tenantId);
      if (tenant) {
        const pending: any[] = Array.isArray((tenant as any).pendingClauses) ? (tenant as any).pendingClauses : [];
        for (const clause of clauses) {
          pending.push({ title: clause.title || '', content: clause.content || '', sortOrder: clause.sortOrder || 999 });
        }
        (tenant as any).pendingClauses = pending;
        (tenant as any).changed('pendingClauses', true);
        await tenant.save();
        pendingTenants++;
      }

      for (const c of contracts) {
        const existing: any[] = Array.isArray((c as any).clauses) ? (c as any).clauses : [];
        for (const clause of clauses) {
          existing.push({ title: clause.title || '', content: clause.content || '', sortOrder: clause.sortOrder || 999 });
        }
        (c as any).clauses = existing;
        (c as any).changed('clauses', true);
        await c.save();
        updatedContracts++;
      }
    }

    // 同步条款到模板
    if (clauses && Array.isArray(clauses) && clauses.length > 0) await syncToTemplate(clauses, { templateId: req.body.templateId || undefined, propertyType: req.body.propertyType || undefined });
    const msgParts: string[] = [];
    if (updatedContracts > 0) msgParts.push(`${updatedContracts} 个合同已更新条款`);
    if (pendingTenants > 0) msgParts.push(`${pendingTenants} 个租客条款已暂存（起草合同时自动加载）`);
    if (skippedNoContract.length - pendingTenants > 0) msgParts.push(`${skippedNoContract.length - pendingTenants} 个租客跳过`);
    res.json({
      code: 200,
      data: { updatedContracts, skippedTenantIds: skippedNoContract, pendingTenants, totalClauses: clauses.length * updatedContracts + pendingTenants * clauses.length },
      message: msgParts.join('；') || '导入完成',
    });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message || '导入失败' });
  }
}

// 按业态获取模板名称
function getTemplateNameByType(propertyType: string) {
  const map: Record<string, string> = { '公寓': '常用条款模板-公寓', '厂房': '常用条款模板-厂房', '商铺': '常用条款模板-商铺' };
  return map[propertyType] || '常用条款模板-通用';
}

// 将导入的条款同步到「常用条款模板」供 ContractDraft 模板选择
// templateId: 指定模板ID；propertyType: 按业态自动匹配模板（公寓/厂房/商铺）
async function syncToTemplate(clauses: { title: string; content: string; sortOrder: number }[], opts?: { templateId?: number; propertyType?: string }) {
  if (!clauses || clauses.length === 0) return;
  try {
    let templateId = opts?.templateId;
    if (!templateId) {
      const templateName = getTemplateNameByType(opts?.propertyType || '通用');
      let template = await ContractTemplate.findOne({ where: { name: templateName } });
      if (!template) {
        template = await ContractTemplate.create({
          name: templateName,
          type: opts?.propertyType || '厂房',
          isDefault: false,
          content: { isAuto: true },
        } as any);
      }
      templateId = (template as any).id;
    }
    const existing = await ContractClause.findAll({ where: { templateId } });
    const existingKeys = new Set(existing.map((e: any) => `${e.title}|||${e.content}`));
    let added = 0;
    for (const clause of clauses) {
      const key = `${clause.title||''}|||${clause.content||''}`;
      if (!existingKeys.has(key)) {
        await ContractClause.create({
          templateId, title: clause.title, content: clause.content,
          sortOrder: clause.sortOrder || 999, type: '标准', isRequired: false,
        } as any);
        added++;
      }
    }
    if (added > 0) console.log(`[Import] ${added} 条新条款同步到模板#${templateId}`);
  } catch (err: any) {
    console.warn('[Import] 条款同步到模板失败:', err.message);
  }
}

// POST /extract-clause-text — 提取 Word/PDF 文本
router.post('/extract-clause-text', importUpload.single('file'), async (req: AuthRequest, res) => {
  try {
    const file = (req as any).file;
    if (!file) return res.status(400).json({ code: 400, message: '请上传文件' });
    const ext = path.extname(file.originalname).toLowerCase();
    let text = '';

    if (ext === '.docx') {
      try {
        const result = await mammoth.extractRawText({ path: file.path });
        text = result.value;
        if (!text || text.trim().length === 0) text = '(此 .docx 文件无法提取文本内容，可能为空文档或加密文件)';
      } catch {
        text = '(此 .docx 文件解析失败，请检查文件是否损坏或为加密文档，建议用 Word 另存后重试)';
      }
    } else if (ext === '.doc') {
      try {
        const WordExtractor = (await import('word-extractor')).default;
        const extractor = new WordExtractor();
        const doc = await extractor.extract(file.path);
        text = doc.getBody();
      } catch {
        try {
          const result = await mammoth.extractRawText({ path: file.path });
          text = result.value;
        } catch {
          text = '(此 .doc 文件无法解析，建议用 Word 另存为 .docx 格式后重试)';
        }
      }
    } else if (ext === '.pdf') {
      try {
        const { PDFParse } = await import('pdf-parse');
        const dataBuffer = fs.readFileSync(file.path);
        const buf = new Uint8Array(dataBuffer.buffer, dataBuffer.byteOffset, dataBuffer.byteLength);
        const parser = new PDFParse(buf);
        const result = await parser.getText();
        text = result.text || '';
        // 移除 pdf-parse v2 的页面分隔符（如 "-- 1 of 5 --"），避免纯图片 PDF 误判为有文本
        const contentText = text.replace(/^\s*--\s*\d+\s+of\s+\d+\s*--\s*$/gm, '').trim();
        if (contentText.length < 50) text = '(此PDF为扫描件或图片格式，文本量过少，请使用OCR工具转换后重试)';
      } catch {
        text = '(PDF解析失败，可能为扫描件或加密文档，请使用OCR工具转换后重试)';
      }
    } else {
      try { fs.unlinkSync(file.path); } catch {}
      return res.status(400).json({ code: 400, message: '仅支持 .docx、.doc 和 .pdf 格式' });
    }

    try { fs.unlinkSync(file.path); } catch {}
    res.json({ code: 200, data: { text: text.trim(), fileName: decodeFilename(file.originalname), size: file.size } });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message || '文本提取失败' });
  }
});

export default router;
