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
import crypto from 'crypto';
import { execFile } from 'node:child_process';
import fs from 'fs';
import { readSheetAsObjects } from '../utils/excel.js';
import ContractTemplate from '../models/ContractTemplate.js';
import ContractClause from '../models/ContractClause.js';
import mammoth from 'mammoth';
import ContractClauseRevision from '../models/ContractClauseRevision.js';
import { splitClausesFromText, diffClauseLists } from '../services/clause-diff.js';
import { auditLog } from '../middleware/audit-log.js';
import AttachmentUploadSession from '../models/AttachmentUploadSession.js';
import { getLanIp } from './publicUpload.js';
import { isESignConfigured, querySignStatus } from '../services/e-signature.js';

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
// 条款修订版上传（用户 2026-10-11 要求）：只收 Word/PDF，20MB
const revisionUpload = multer({
  dest: importUploadDir,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowed = ['.docx', '.doc', '.pdf'];
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('仅支持 Word(.docx/.doc) 或 PDF 格式的合同修订版'));
  },
});

/** 从上传的 Word/PDF 中提取纯文本（提取端点与条款修订比对共用） */
async function extractUploadText(filePath: string, ext: string): Promise<string> {
  let text = '';
  if (ext === '.docx') {
    try {
      const result = await mammoth.extractRawText({ path: filePath });
      text = result.value;
      if (!text || text.trim().length === 0) text = '(此 .docx 文件无法提取文本内容，可能为空文档或加密文件)';
    } catch {
      text = '(此 .docx 文件解析失败，请检查文件是否损坏或为加密文档，建议用 Word 另存后重试)';
    }
  } else if (ext === '.doc') {
    try {
      const WordExtractor = (await import('word-extractor')).default;
      const extractor = new WordExtractor();
      const doc = await extractor.extract(filePath);
      text = doc.getBody();
    } catch {
      try {
        const result = await mammoth.extractRawText({ path: filePath });
        text = result.value;
      } catch {
        text = '(此 .doc 文件无法解析，建议用 Word 另存为 .docx 格式后重试)';
      }
    }
  } else if (ext === '.pdf') {
    try {
      const { PDFParse } = await import('pdf-parse');
      const dataBuffer = fs.readFileSync(filePath);
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
    text = '(不支持的文件格式，仅支持 .docx、.doc 和 .pdf)';
  }
  return text.trim();
}

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
      // 附件标题/备注（用户 2026-10-16 要求）：先在界面上自定义，打印「附件清单」时优先显示它
      title: '',
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

// PUT /contracts/:id/files/title — 设置某个附件的标题/备注（用户 2026-10-16 要求）
// 标题用于打印合同的「附件清单」（如把 扫描件_2026.pdf 显示成「房屋交接单」）；留空则回退用文件名
router.put('/:id/files/title', auditLog('合同', '修改附件标题'), async (req: AuthRequest, res) => {
  try {
    const contract = await Contract.findByPk(req.params.id);
    if (!contract) return res.status(404).json({ code: 404, message: '合同不存在' });
    const title = String(req.body?.title ?? '').trim();
    if (title.length > 60) return res.status(400).json({ code: 400, message: '附件标题不能超过 60 个字' });

    const files = [...(((contract as any).billingConfig?.attachments as any[]) || [])];
    const targetPath = String(req.body?.path || '');
    let idx = targetPath ? files.findIndex((f: any) => f?.path === targetPath) : Number(req.body?.index);
    if (targetPath && idx < 0) return res.status(404).json({ code: 404, message: '附件不存在（可能已被删除）' });
    if (!Number.isInteger(idx) || idx < 0 || idx >= files.length) return res.status(404).json({ code: 404, message: '附件不存在' });

    files[idx] = { ...files[idx], title };
    const billingConfig = { ...(((contract as any).billingConfig as any) || {}), attachments: files };
    (contract as any).billingConfig = billingConfig;
    // SQLite 上 JSON 字段必须显式标记变更，否则 update() 检测不到（见 CLAUDE.md 陷阱）
    (contract as any).changed('billingConfig', true);
    await contract.save();
    res.json({ code: 200, data: { list: files }, message: title ? '附件标题已保存' : '已清除该附件的标题' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// PUT /contracts/:id/files/group — 设置附件分组（用户 2026-10-16 第 ⑪ 项：分组 + 排序 + 打印附件目录页）
router.put('/:id/files/group', auditLog('合同', '修改附件分组'), async (req: AuthRequest, res) => {
  try {
    const contract = await Contract.findByPk(req.params.id);
    if (!contract) return res.status(404).json({ code: 404, message: '合同不存在' });
    const group = String(req.body?.group ?? '').trim();
    if (group.length > 20) return res.status(400).json({ code: 400, message: '分组名称不能超过 20 个字' });

    const files = [...(((contract as any).billingConfig?.attachments as any[]) || [])];
    const targetPath = String(req.body?.path || '');
    let idx = targetPath ? files.findIndex((f: any) => f?.path === targetPath) : Number(req.body?.index);
    if (targetPath && idx < 0) return res.status(404).json({ code: 404, message: '附件不存在（可能已被删除）' });
    if (!Number.isInteger(idx) || idx < 0 || idx >= files.length) return res.status(404).json({ code: 404, message: '附件不存在' });

    files[idx] = { ...files[idx], group };
    const billingConfig = { ...(((contract as any).billingConfig as any) || {}), attachments: files };
    (contract as any).billingConfig = billingConfig;
    (contract as any).changed('billingConfig', true);
    await contract.save();
    res.json({ code: 200, data: { list: files }, message: group ? '附件分组已保存' : '已清除该附件的分组' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// PUT /contracts/:id/files/order — 按传入的 path 顺序重排附件（用户自定义排序）
router.put('/:id/files/order', auditLog('合同', '调整附件顺序'), async (req: AuthRequest, res) => {
  try {
    const contract = await Contract.findByPk(req.params.id);
    if (!contract) return res.status(404).json({ code: 404, message: '合同不存在' });
    const want: string[] = Array.isArray(req.body?.paths) ? req.body.paths.map((p: any) => String(p)) : [];
    if (want.length === 0) return res.status(400).json({ code: 400, message: '请提供附件顺序' });

    const files = [...(((contract as any).billingConfig?.attachments as any[]) || [])];
    const byPath = new Map(files.map((f: any) => [String(f?.path || ''), f]));
    const ordered: any[] = [];
    for (const p of want) {
      const f = byPath.get(p);
      if (f) { ordered.push(f); byPath.delete(p); }
    }
    // 未在传入顺序里出现的附件保持原相对顺序追加在末尾，绝不丢附件
    for (const f of files) if (byPath.has(String(f?.path || ''))) { ordered.push(f); byPath.delete(String(f?.path || '')); }

    const billingConfig = { ...(((contract as any).billingConfig as any) || {}), attachments: ordered };
    (contract as any).billingConfig = billingConfig;
    (contract as any).changed('billingConfig', true);
    await contract.save();
    res.json({ code: 200, data: { list: ordered }, message: '附件顺序已保存（打印时的附件1/2/3 即按此顺序）' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// POST /contracts/:id/upload-session — 生成「手机上传」链接（用户 2026-10-16 第 ⑧ 项）
// 手机在浏览器打开该地址即可拍照/选文件上传，免装 App、免登录；一次性 token + 有效期约束
router.post('/:id/upload-session', requirePermission('contract', 'update'), auditLog('合同', '生成手机上传链接'), async (req: AuthRequest, res) => {
  try {
    const contract = await Contract.findByPk(req.params.id);
    if (!contract) return res.status(404).json({ code: 404, message: '合同不存在' });
    const minutes = Math.min(Math.max(Number(req.body?.minutes || 30), 5), 120);
    // mode=review：租户自助上传，先进待审核箱（第 ⑬ 项）；默认 direct：上传即挂到附件（现场业务员用）
    const mode = req.body?.mode === 'review' ? 'review' : 'direct';
    const token = crypto.randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + minutes * 60 * 1000);
    await AttachmentUploadSession.create({
      token, contractId: (contract as any).id, createdBy: (req as any).user?.id ?? null,
      expiresAt, status: '待上传', mode, uploadedCount: 0, files: [],
    } as any);
    const ip = getLanIp();
    const port = Number(process.env.PORT || 3001);
    const url = 'http://' + ip + ':' + port + '/api/public/upload/' + token;
    res.json({
      code: 200,
      data: { token, url, lanIp: ip, port, minutes, mode, expiresAt: expiresAt.toISOString() },
      message: '手机上传链接已生成（' + minutes + ' 分钟内有效，仅对本合同生效）',
    });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message || '生成手机上传链接失败' }); }
});

// ===== 待审核附件（用户 2026-10-16 第 ⑬ 项：租户自助上传 + 审核）=====

// GET /contracts/:id/attachment-inbox — 待审核附件列表
router.get('/:id/attachment-inbox', async (req: AuthRequest, res) => {
  try {
    const contract = await Contract.findByPk(req.params.id);
    if (!contract) return res.status(404).json({ code: 404, message: '合同不存在' });
    const list = (((contract as any).billingConfig || {}).attachmentInbox as any[]) || [];
    res.json({ code: 200, data: { list, pending: list.length } });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message || '读取待审核附件失败' }); }
});

// POST /contracts/:id/attachment-inbox/approve — 通过（移入正式附件，可批量传 paths）
router.post('/:id/attachment-inbox/approve', requirePermission('contract', 'update'), auditLog('合同', '通过待审核附件'), async (req: AuthRequest, res) => {
  try {
    const contract = await Contract.findByPk(req.params.id);
    if (!contract) return res.status(404).json({ code: 404, message: '合同不存在' });
    const want: string[] = Array.isArray(req.body?.paths) ? req.body.paths.map((p: any) => String(p))
      : (req.body?.path ? [String(req.body.path)] : []);
    if (want.length === 0) return res.status(400).json({ code: 400, message: '请选择要通过的附件' });

    const cfg = { ...(((contract as any).billingConfig as any) || {}) };
    const inbox: any[] = Array.isArray(cfg.attachmentInbox) ? cfg.attachmentInbox : [];
    const keep: any[] = [];
    const moved: any[] = [];
    for (const it of inbox) {
      if (want.includes(String(it?.path || ''))) {
        const { status, ...rest } = it;
        moved.push({ ...rest, reviewedAt: new Date().toISOString(), reviewedBy: (req as any).user?.id ?? null });
      } else keep.push(it);
    }
    if (moved.length === 0) return res.status(404).json({ code: 404, message: '待审核附件里没有匹配项（可能已被处理）' });

    cfg.attachmentInbox = keep;
    cfg.attachments = [...(Array.isArray(cfg.attachments) ? cfg.attachments : []), ...moved];
    (contract as any).billingConfig = cfg;
    (contract as any).changed('billingConfig', true);
    await contract.save();
    res.json({ code: 200, data: { list: cfg.attachments, inbox: keep }, message: '已通过 ' + moved.length + ' 个附件，已进入合同附件' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message || '通过待审核附件失败' }); }
});

// POST /contracts/:id/attachment-inbox/reject — 驳回（删除条目与磁盘文件）
router.post('/:id/attachment-inbox/reject', requirePermission('contract', 'update'), auditLog('合同', '驳回待审核附件'), async (req: AuthRequest, res) => {
  try {
    const contract = await Contract.findByPk(req.params.id);
    if (!contract) return res.status(404).json({ code: 404, message: '合同不存在' });
    const want: string[] = Array.isArray(req.body?.paths) ? req.body.paths.map((p: any) => String(p))
      : (req.body?.path ? [String(req.body.path)] : []);
    if (want.length === 0) return res.status(400).json({ code: 400, message: '请选择要驳回的附件' });

    const cfg = { ...(((contract as any).billingConfig as any) || {}) };
    const inbox: any[] = Array.isArray(cfg.attachmentInbox) ? cfg.attachmentInbox : [];
    const keep: any[] = [];
    const rejected: any[] = [];
    for (const it of inbox) {
      if (want.includes(String(it?.path || ''))) rejected.push(it);
      else keep.push(it);
    }
    if (rejected.length === 0) return res.status(404).json({ code: 404, message: '待审核附件里没有匹配项（可能已被处理）' });

    cfg.attachmentInbox = keep;
    (contract as any).billingConfig = cfg;
    (contract as any).changed('billingConfig', true);
    await contract.save();
    // 驳回后清理临时文件（附件从未正式入册，不留残件）
    let removed = 0;
    for (const it of rejected) {
      const p = String(it?.path || '');
      if (!p) continue;
      try { fs.unlinkSync(p); removed += 1; } catch { /* 文件可能已不存在 */ }
    }
    res.json({ code: 200, data: { inbox: keep, removed }, message: '已驳回 ' + rejected.length + ' 个附件' + (removed ? '，文件已清理' : '') });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message || '驳回待审核附件失败' }); }
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
      // 续约沿用原合同的履约违约金与首期应交租金口径（用户 2026-10-10 新增字段）
      performancePenalty: oldContract.performancePenalty,
      firstPeriodRent: oldContract.firstPeriodRent,
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
    // 提取逻辑统一走 extractUploadText()，与条款修订比对共用一份实现
    const text = await extractUploadText(file.path, ext);
    try { fs.unlinkSync(file.path); } catch {}
    if (!['.docx', '.doc', '.pdf'].includes(ext)) {
      return res.status(400).json({ code: 400, message: '仅支持 .docx、.doc 和 .pdf 格式' });
    }
    res.json({ code: 200, data: { text, fileName: decodeFilename(file.originalname), size: file.size } });
  } catch (err: any) {
    const file = (req as any).file;
    if (file?.path) { try { fs.unlinkSync(file.path); } catch {} }
    res.status(500).json({ code: 500, message: err.message || '文本提取失败' });
  }
});

// ===== 合同条款修订（用户 2026-10-11 要求）=====
// 场景：租户在合同上改了条款后把文件回传。用户上传即可自动拆条、与现有条款比对，
// 系统明确提示「改了哪些内容」，用户逐条查看差异后一键写回合同条款。
const parseClauses = (raw: any): any[] => {
  if (Array.isArray(raw)) return raw;
  try { return JSON.parse(raw || '[]'); } catch { return []; }
};

// POST /:id/clause-diff — 上传租户修订版，自动比对并生成「待处理」记录
router.post('/:id/clause-diff', requirePermission('contract', 'update'), auditLog('合同', '条款修订比对'), revisionUpload.single('file'), async (req: AuthRequest, res) => {
  try {
    const file = (req as any).file;
    if (!file) return res.status(400).json({ code: 400, message: '请上传租户修订后的合同文件（Word 或 PDF）' });
    const contract = await Contract.findByPk(req.params.id);
    if (!contract) {
      try { fs.unlinkSync(file.path); } catch {}
      return res.status(404).json({ code: 404, message: '合同不存在' });
    }

    const ext = path.extname(file.originalname).toLowerCase();
    const text = await extractUploadText(file.path, ext);
    try { fs.unlinkSync(file.path); } catch {}
    if (!text) return res.status(400).json({ code: 400, message: '未能从文件中提取到文本' });
    if (text.startsWith('(') && text.endsWith(')')) {
      return res.status(400).json({ code: 400, message: text.slice(1, -1) });
    }

    const parsedClauses = splitClausesFromText(text);
    if (parsedClauses.length === 0) {
      return res.status(400).json({ code: 400, message: '未能从上传的文件中识别出条款，请确认文件内容完整' });
    }

    const diff = diffClauseLists(parseClauses((contract as any).clauses), parsedClauses);
    const revision = await ContractClauseRevision.create({
      contractId: Number(req.params.id),
      sourceFileName: decodeFilename(file.originalname),
      sourceType: ext.replace('.', ''),
      clauseCount: parsedClauses.length,
      addedCount: diff.counts.added,
      removedCount: diff.counts.removed,
      modifiedCount: diff.counts.modified,
      summary: diff.summary,
      details: diff.details,
      diff,
      parsedClauses,
      status: '待处理',
      uploadedBy: (req as any).user?.userId ?? null,
    } as any);

    res.json({
      code: 200,
      data: {
        revision: { id: revision.id, contractId: revision.contractId, sourceFileName: revision.sourceFileName, summary: revision.summary, status: revision.status, clauseCount: revision.clauseCount },
        diff,
      },
    });
  } catch (err: any) {
    const file = (req as any).file;
    if (file?.path) { try { fs.unlinkSync(file.path); } catch {} }
    res.status(500).json({ code: 500, message: err.message || '条款比对失败' });
  }
});

// GET /:id/clause-revisions — 修订记录列表（不含 diff/parsedClauses 大字段）
router.get('/:id/clause-revisions', requirePermission('contract', 'read'), async (req: AuthRequest, res) => {
  try {
    const list = await ContractClauseRevision.findAll({
      where: { contractId: req.params.id },
      attributes: { exclude: ['diff', 'parsedClauses'] },
      order: [['createdAt', 'DESC']],
    });
    res.json({ code: 200, data: list });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message || '加载修订记录失败' });
  }
});

// GET /:id/clause-revisions/:revId — 单条修订详情（含片段级差异）
router.get('/:id/clause-revisions/:revId', requirePermission('contract', 'read'), async (req: AuthRequest, res) => {
  try {
    const rev = await ContractClauseRevision.findOne({ where: { id: req.params.revId, contractId: req.params.id } });
    if (!rev) return res.status(404).json({ code: 404, message: '修订记录不存在' });
    res.json({ code: 200, data: rev });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message || '加载修订详情失败' });
  }
});

// POST /:id/clause-revisions/:revId/apply — 把修订版条款写回合同
router.post('/:id/clause-revisions/:revId/apply', requirePermission('contract', 'update'), auditLog('合同', '应用条款修订'), async (req: AuthRequest, res) => {
  try {
    const rev = await ContractClauseRevision.findOne({ where: { id: req.params.revId, contractId: req.params.id } });
    if (!rev) return res.status(404).json({ code: 404, message: '修订记录不存在' });
    if (rev.status === '已应用') return res.status(400).json({ code: 400, message: '该修订已应用，无需重复操作' });
    const contract = await Contract.findByPk(req.params.id);
    if (!contract) return res.status(404).json({ code: 404, message: '合同不存在' });

    const clauses = Array.isArray(rev.parsedClauses) ? rev.parsedClauses : [];
    if (clauses.length === 0) return res.status(400).json({ code: 400, message: '该修订没有可用的条款内容' });
    // SQLite 上 Sequelize 检测不到 JSON 字段变更，必须显式 changed()（见 CLAUDE.md）
    (contract as any).clauses = clauses;
    (contract as any).changed('clauses', true);
    await contract.save();

    rev.status = '已应用';
    (rev as any).appliedBy = (req as any).user?.userId ?? null;
    (rev as any).appliedAt = new Date();
    if (req.body?.notes) (rev as any).notes = String(req.body.notes);
    await rev.save();

    broadcast('contract:clauses-updated', { contractId: Number(req.params.id), revisionId: rev.id, clauseCount: clauses.length });
    res.json({ code: 200, data: { contractId: Number(req.params.id), clauseCount: clauses.length, status: rev.status } });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message || '应用修订失败' });
  }
});

// POST /:id/clause-revisions/:revId/ignore — 忽略该修订
router.post('/:id/clause-revisions/:revId/ignore', requirePermission('contract', 'update'), auditLog('合同', '忽略条款修订'), async (req: AuthRequest, res) => {
  try {
    const rev = await ContractClauseRevision.findOne({ where: { id: req.params.revId, contractId: req.params.id } });
    if (!rev) return res.status(404).json({ code: 404, message: '修订记录不存在' });
    rev.status = '已忽略';
    if (req.body?.notes) (rev as any).notes = String(req.body.notes);
    await rev.save();
    res.json({ code: 200, data: { id: rev.id, status: rev.status } });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message || '忽略修订失败' });
  }
});

// ===== 引用型附件（用户 2026-10-16 第 ④ 项：引用已有资料，不复制文件）=====

/** 把租客档案里的可引用资料整理成候选（idPhoto + attachments，兼容数组/对象两种存法） */
function buildRefCandidates(tenant: any): any[] {
  const out: any[] = [];
  if (!tenant) return out;
  if (String(tenant.idPhoto || '').trim()) {
    out.push({ kind: 'tenant-id-photo', refId: tenant.id, title: '身份证照片（引用租客档案）', preview: String(tenant.idPhoto).slice(0, 200000) });
  }
  const att = tenant.attachments;
  if (Array.isArray(att)) {
    att.forEach((x: any, i: number) => {
      const name = String(x?.name || x?.title || ('租客档案附件' + (i + 1)));
      if (x?.path || x?.url) out.push({ kind: 'tenant-attachment', refId: i, title: name, path: String(x.path || x.url) });
    });
  } else if (att && typeof att === 'object') {
    Object.keys(att).forEach((k) => {
      const v = (att as any)[k];
      const val = typeof v === 'string' ? v : String(v?.path || v?.url || '');
      if (val) out.push({ kind: 'tenant-attachment', refId: k, title: String(v?.name || k), path: val });
    });
  }
  return out;
}

// GET /contracts/:id/ref-candidates — 本合同的「可引用资料」清单
router.get('/:id/ref-candidates', async (req: AuthRequest, res) => {
  try {
    const contract = await Contract.findByPk(req.params.id);
    if (!contract) return res.status(404).json({ code: 404, message: '合同不存在' });
    const tenant = await Tenant.findByPk((contract as any).tenantId);
    res.json({ code: 200, data: { list: buildRefCandidates(tenant), tenantName: (tenant as any)?.name || '' } });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message || '读取可引用资料失败' }); }
});

// POST /contracts/:id/files/attach-ref — 把已有资料引用为附件（不复制文件，打印时按其标题列在附件目录里）
router.post('/:id/files/attach-ref', requirePermission('contract', 'update'), auditLog('合同', '引用已有资料作为附件'), async (req: AuthRequest, res) => {
  try {
    const contract = await Contract.findByPk(req.params.id);
    if (!contract) return res.status(404).json({ code: 404, message: '合同不存在' });
    const kind = String(req.body?.kind || '').trim();
    if (!kind) return res.status(400).json({ code: 400, message: '请选择要引用的资料' });
    const tenant = await Tenant.findByPk((contract as any).tenantId);
    const candidates = buildRefCandidates(tenant);
    const hit = candidates.find((c) => c.kind === kind && String(c.refId) === String(req.body?.refId ?? c.refId));
    if (!hit) return res.status(404).json({ code: 404, message: '该资料已不存在（可能被删除或未上传）' });

    const cfg = { ...(((contract as any).billingConfig as any) || {}) };
    const files: any[] = Array.isArray(cfg.attachments) ? [...cfg.attachments] : [];
    const title = String(req.body?.title || hit.title || '').trim();
    const dup = files.find((f: any) => f?.refKind === hit.kind && String(f?.refId) === String(hit.refId));
    if (dup) return res.status(409).json({ code: 409, message: '该资料已经引用过了，无需重复添加' });

    files.push({
      name: title, path: hit.path || '', size: 0,
      title, group: String(req.body?.group || '').trim(),
      uploadedAt: new Date().toISOString(),
      refKind: hit.kind, refId: hit.refId, source: '引用',
    });
    cfg.attachments = files;
    (contract as any).billingConfig = cfg;
    (contract as any).changed('billingConfig', true);
    await contract.save();
    res.json({ code: 200, data: { list: files }, message: '已引用「' + title + '」（不复制文件，打印时列在附件目录里）' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message || '引用失败' }); }
});

// ===== 扫描仪直传（用户 2026-10-16 第 ⑦ 项：接 Windows WIA，扫描件直接入册）=====

/**
 * 调用 Windows WIA（PowerShell COM）扫描一页到 JPEG。
 * 返回 { devices, savedPath }；未装扫描仪时 devices 为空、savedPath 为空，由调用方给中文提示。
 * 说明：WIA 是 Windows 内置接口，只要装了扫描仪驱动即可用，无需额外依赖。
 */
async function runWiaScan(outPath: string | null): Promise<{ devices: string[]; saved: boolean; error: string }> {
  const ps = [
    "$ErrorActionPreference='Stop'",
    "$dm = New-Object -ComObject WIA.DeviceManager",
    "$devs = @($dm.DeviceInfos | Where-Object { $_.Type -eq 1 })",
    "if ($devs.Count -eq 0) { Write-Output 'NO_SCANNER'; exit 0 }",
    "foreach ($d in $devs) { Write-Output ('DEVICE:' + $d.Properties.Item('Name').Value) }",
    "if (-not $env:SCAN_OUT) { exit 0 }",
    "$d0 = $devs[0]",
    "$item = $d0.Items.Item(1)",
    "$img = $item.Transfer('{B96B3CAB-0728-11D3-9FD7-00A0C911004F}')",
    "$img.SaveFile($env:SCAN_OUT)",
    "Write-Output 'SAVED'",
  ].join('; ');
  return new Promise((resolve) => {
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps],
      { timeout: 120000, env: { ...process.env, SCAN_OUT: outPath || '' }, windowsHide: true },
      (err: any, stdout: string, stderr: string) => {
        const out = String(stdout || '');
        const devices = out.split(/\r?\n/).filter((l) => l.startsWith('DEVICE:')).map((l) => l.slice(7).trim());
        const saved = out.includes('SAVED');
        let error = '';
        if (err) error = String(stderr || err.message || '').slice(0, 300);
        else if (out.includes('NO_SCANNER')) error = 'NO_SCANNER';
        resolve({ devices, saved, error });
      });
  });
}

// GET /contracts/:id/scan-devices — 探测本机可用的扫描仪
router.get('/:id/scan-devices', async (_req: AuthRequest, res) => {
  try {
    const r = await runWiaScan(null);
    res.json({
      code: 200,
      data: { devices: r.devices, available: r.devices.length > 0 },
      message: r.devices.length > 0 ? '已检测到扫描仪：' + r.devices.join('、') : '未检测到扫描仪（请确认已连接扫描仪并安装驱动；也可用「拍照上传」或「上传文件」）',
    });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message || '探测扫描仪失败' }); }
});

// POST /contracts/:id/scan — 扫描一页并直接作为合同附件
router.post('/:id/scan', requirePermission('contract', 'update'), auditLog('合同', '扫描仪扫描附件'), async (req: AuthRequest, res) => {
  try {
    const contract = await Contract.findByPk(req.params.id);
    if (!contract) return res.status(404).json({ code: 404, message: '合同不存在' });

    const outPath = path.join(process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads'), 'scan-' + Date.now() + '.jpg');
    const r = await runWiaScan(outPath);
    if (r.error === 'NO_SCANNER' || r.devices.length === 0) {
      return res.status(400).json({ code: 400, message: '未检测到扫描仪：请确认已连接扫描仪并安装驱动；如只想用照片，可点「拍照上传」或「上传文件」' });
    }
    if (r.error || !r.saved) {
      return res.status(400).json({ code: 400, message: '扫描失败：' + (r.error || '扫描仪未返回图像') + '（可检查扫描仪是否被其他程序占用、或改用「上传文件」）' });
    }
    if (!fs.existsSync(outPath)) return res.status(400).json({ code: 400, message: '扫描未生成文件（可能扫描仪未放置纸张），请重试' });
    const size = fs.statSync(outPath).size;
    if (size <= 0) return res.status(400).json({ code: 400, message: '扫描结果为空（请确认扫描仪里已放好纸张）' });

    const cfg = { ...(((contract as any).billingConfig as any) || {}) };
    const files: any[] = Array.isArray(cfg.attachments) ? [...cfg.attachments] : [];
    const entry = {
      name: '扫描件_' + dayjs().format('YYYYMMDD_HHmmss') + '.jpg',
      path: outPath, size,
      title: String(req.body?.title || '扫描件').trim() || '扫描件',
      group: String(req.body?.group || '').trim(),
      uploadedAt: new Date().toISOString(),
      source: '扫描仪',
    };
    files.push(entry);
    cfg.attachments = files;
    (contract as any).billingConfig = cfg;
    (contract as any).changed('billingConfig', true);
    await contract.save();
    res.json({ code: 200, data: { list: files, added: entry, devices: r.devices }, message: '已扫描并加入合同附件（' + entry.name + '）' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message || '扫描失败' }); }
});

// ===== 电子签回传归档（用户 2026-10-16 第 ⑫ 项：签署完成的 PDF 自动作为合同附件）=====

// POST /contracts/:id/esign/pull-signed — 拉取电子签已签署文件并归档为附件
// 未配置 e签宝 密钥时明确报「未启用」，不做假动作（Mock 模式下没有真实签署文件可归档）
router.post('/:id/esign/pull-signed', requirePermission('contract', 'update'), auditLog('合同', '回传电子签签署文件'), async (req: AuthRequest, res) => {
  try {
    const contract = await Contract.findByPk(req.params.id);
    if (!contract) return res.status(404).json({ code: 404, message: '合同不存在' });
    if (!isESignConfigured()) {
      return res.status(400).json({ code: 400, message: '未启用电子签：请在 .env 配置 E签宝 的 AppId/AppSecret 后重试（当前为 Mock 模式，没有真实签署文件可回传）' });
    }
    const cfg = ((contract as any).billingConfig || {}) as any;
    const flowId = String(req.body?.flowId || cfg.eSignFlowId || (contract as any).eSignFlowId || '').trim();
    if (!flowId) return res.status(400).json({ code: 400, message: '本合同还没有发起电子签流程，请先在合同详情页发起电子签' });

    const status: any = await querySignStatus(flowId);
    const fileUrl = String(status?.fileUrl || status?.signedFileUrl || status?.file || '').trim();
    const done = ['已完成', '已签署', '签署完成', 'finish', 'finished', 'completed'].includes(String(status?.status || ''));
    if (!done || !fileUrl) {
      return res.status(400).json({ code: 400, message: '签署尚未完成（当前状态：' + (status?.status || '未知') + '），完成后再回传' });
    }

    // 下载签署完成的 PDF 并落盘，再作为附件入册
    const resp = await fetch(fileUrl);
    if (!resp.ok) return res.status(400).json({ code: 400, message: '下载签署文件失败（HTTP ' + resp.status + '），请稍后重试' });
    const buf = Buffer.from(await resp.arrayBuffer());
    if (buf.length === 0) return res.status(400).json({ code: 400, message: '签署文件为空，未归档' });
    const outPath = path.join(process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads'), 'esign-' + Date.now() + '.pdf');
    fs.writeFileSync(outPath, buf);

    const files: any[] = Array.isArray(cfg.attachments) ? [...cfg.attachments] : [];
    const entry = {
      name: '电子签_已签署_' + ((contract as any).contractNo || '') + '.pdf',
      path: outPath, size: buf.length,
      title: '电子签已签署合同', group: String(req.body?.group || '').trim(),
      uploadedAt: new Date().toISOString(), source: '电子签', eSignFlowId: flowId,
    };
    files.push(entry);
    (contract as any).billingConfig = { ...cfg, attachments: files, eSignFlowId: flowId };
    (contract as any).changed('billingConfig', true);
    await contract.save();
    res.json({ code: 200, data: { list: files, added: entry }, message: '已回传电子签签署文件并归档为附件（' + entry.name + '）' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message || '回传电子签文件失败' }); }
});

export default router;
