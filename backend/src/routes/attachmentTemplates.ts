import { Router } from 'express';
import { Op } from 'sequelize';
import AttachmentTemplate from '../models/AttachmentTemplate.js';
import { AuthRequest } from '../middleware/auth.js';
import { auditLog } from '../middleware/audit-log.js';
import { requirePermission } from '../middleware/rbac.js';

/**
 * 附件单据模板库（用户 2026-10-16：附件便捷化 ①②③）。
 * 用途：不进「上传文件」流程，而是选一张模板 → 用合同/租客/房源数据（含占位符）渲染成 Word
 * → 直接作为该合同的附件（前端渲染 + 复用现有上传接口）。
 * 内置模板可改不可删；自定义模板走同一张表（② 自定义占位符模板即复用本表）。
 */
const router = Router();

/** 可用占位符（前端渲染时替换；此处作为白名单与界面提示） */
export const TEMPLATE_PLACEHOLDERS: { key: string; label: string }[] = [
  { key: 'contractNo', label: '合同编号' },
  { key: 'tenantName', label: '承租人（乙方）名称' },
  { key: 'tenantLegalPerson', label: '乙方法定代表人' },
  { key: 'tenantIdNumber', label: '乙方证件号码' },
  { key: 'tenantPhone', label: '乙方联系电话' },
  { key: 'propertyName', label: '房源名称' },
  { key: 'propertyAddress', label: '房源地址' },
  { key: 'propertyArea', label: '建筑面积（㎡）' },
  { key: 'rentAmount', label: '月租金' },
  { key: 'depositAmount', label: '押金' },
  { key: 'performancePenalty', label: '履约违约金' },
  { key: 'firstPeriodRent', label: '首期应交租金' },
  { key: 'paymentCycle', label: '付款周期' },
  { key: 'startDate', label: '开始日期' },
  { key: 'endDate', label: '结束日期' },
  { key: 'companyName', label: '甲方（出租方）名称' },
  { key: 'companySigner', label: '甲方签约代表人' },
  { key: 'today', label: '今天日期' },
];

const BUILT_IN: any[] = [
  {
    name: '房屋交接单', category: '标准单据', scope: '全部', sortOrder: 10,
    description: '交房时双方共同确认房屋及设施状况（含水电燃气底数、钥匙数量）',
    docTitle: '房屋交接单',
    intro: '甲方（出租方）${companyName} 与乙方（承租方）${tenantName} 就 ${propertyAddress} 的房屋交接事宜确认如下：',
    fields: [
      { label: '合同编号', value: '${contractNo}' },
      { label: '房源', value: '${propertyName}（${propertyAddress}）' },
      { label: '建筑面积', value: '${propertyArea} ㎡' },
      { label: '交接日期', value: '${today}' },
      { label: '水表底数', value: '＿＿＿＿＿＿' },
      { label: '电表底数', value: '＿＿＿＿＿＿' },
      { label: '燃气表底数', value: '＿＿＿＿＿＿' },
      { label: '钥匙/门禁卡数量', value: '＿＿＿＿＿＿' },
    ],
    clauses: [
      '房屋及附属设施、家具家电现状已由双方共同查验，乙方确认无异议。',
      '交接时抄录的水电燃气底数作为日后费用结算的起算依据。',
      '乙方应妥善使用房屋及设施，因使用不当造成损坏的由乙方负责修复或赔偿。',
    ],
    signatures: [{ label: '甲方（交接人）', name: '${companySigner}' }, { label: '乙方（承租人）', name: '${tenantName}' }],
  },
  {
    name: '消防安全责任书', category: '标准单据', scope: '全部', sortOrder: 20,
    description: '明确承租区域消防安全责任、禁止事项与违规处罚',
    docTitle: '消防安全责任书',
    intro: '为明确 ${propertyAddress} 承租区域的消防安全责任，甲方 ${companyName} 与乙方 ${tenantName} 约定如下：',
    fields: [
      { label: '合同编号', value: '${contractNo}' },
      { label: '承租区域', value: '${propertyName}' },
      { label: '签订日期', value: '${today}' },
    ],
    clauses: [
      '乙方为该承租区域消防安全第一责任人，负责日常防火检查与隐患整改。',
      '严禁占用、堵塞、封闭疏散通道和安全出口，严禁遮挡消防设施器材。',
      '严禁违规用火用电、私拉乱接电线，严禁在室内为电动自行车充电。',
      '严禁在承租区域内存放易燃易爆危险品，动火作业须事先报甲方审批并落实现场看护。',
      '乙方违反上述约定的，甲方有权要求限期整改；逾期未整改的，按合同约定承担违约责任并赔偿由此造成的损失。',
    ],
    signatures: [{ label: '甲方（盖章）', name: '${companySigner}' }, { label: '乙方（签字）', name: '${tenantName}' }],
  },
  {
    name: '押金收据', category: '标准单据', scope: '全部', sortOrder: 30,
    description: '收到承租方押金后出具，写明金额与退款条件',
    docTitle: '押金收据',
    intro: '今收到乙方 ${tenantName} 交来的房屋租赁押金，明细如下：',
    fields: [
      { label: '合同编号', value: '${contractNo}' },
      { label: '房源', value: '${propertyName}（${propertyAddress}）' },
      { label: '押金金额（小写）', value: '¥${depositAmount}' },
      { label: '收款日期', value: '${today}' },
    ],
    clauses: [
      '租赁期满或合同解除，乙方无违约、无欠费并结清相关费用后，押金全额无息退还。',
      '乙方存在欠费或造成房屋、设施损坏的，甲方有权从押金中据实扣除，不足部分另行追偿。',
    ],
    signatures: [{ label: '收款人（甲方）', name: '${companySigner}' }, { label: '交款人（乙方）', name: '${tenantName}' }],
  },
  {
    name: '钥匙交接单', category: '标准单据', scope: '全部', sortOrder: 40,
    description: '记录钥匙/门禁卡交接与归还责任',
    docTitle: '钥匙交接单',
    intro: '甲乙双方就 ${propertyAddress} 的钥匙/门禁卡交接确认如下：',
    fields: [
      { label: '合同编号', value: '${contractNo}' },
      { label: '钥匙数量', value: '＿＿＿ 把' },
      { label: '门禁卡数量', value: '＿＿＿ 张' },
      { label: '交接日期', value: '${today}' },
    ],
    clauses: [
      '乙方应妥善保管钥匙/门禁卡，不得擅自复制或转交他人使用。',
      '合同终止时乙方应如数归还；如有遗失或损坏，按实际成本赔偿。',
    ],
    signatures: [{ label: '甲方（交接人）', name: '${companySigner}' }, { label: '乙方（承租人）', name: '${tenantName}' }],
  },
  {
    name: '水电燃气表底数确认单', category: '标准单据', scope: '全部', sortOrder: 50,
    description: '入住当日抄录各表底数，作为费用结算起算依据',
    docTitle: '水电燃气表底数确认单',
    intro: '乙方 ${tenantName} 承租 ${propertyName}，入住当日表底数确认如下：',
    fields: [
      { label: '合同编号', value: '${contractNo}' },
      { label: '抄表日期', value: '${today}' },
      { label: '水表底数（吨）', value: '＿＿＿＿＿＿' },
      { label: '电表底数（度）', value: '＿＿＿＿＿＿' },
      { label: '燃气表底数（立方米）', value: '＿＿＿＿＿＿' },
    ],
    clauses: ['以上底数为费用结算起算点，之后按实际用量与合同约定单价结算。'],
    signatures: [{ label: '甲方（抄表人）', name: '${companySigner}' }, { label: '乙方（承租人）', name: '${tenantName}' }],
  },
  {
    name: '消防器材台账（系统记录）', category: '系统记录', scope: '全部', sortOrder: 60,
    description: '从消防器材台账导出当前在用器材清单作为附件',
    docTitle: '消防器材台账', intro: '本表由系统消防器材台账自动生成（导出日期 ${today}）。',
    fields: [{ label: '导出日期', value: '${today}' }], clauses: [], signatures: [],
    dataSource: 'fire-equipment',
    tableColumns: [{ key: 'name', label: '器材名称' }, { key: 'type', label: '类型' }, { key: 'location', label: '位置' }, { key: 'quantity', label: '数量' }, { key: 'status', label: '状态' }, { key: 'expireDate', label: '有效期至' }],
  },
  {
    name: '合同账单明细（系统记录）', category: '系统记录', scope: '全部', sortOrder: 70,
    description: '导出本合同全部账单（账期/金额/状态/已缴）作为附件',
    docTitle: '合同账单明细', intro: '本表由系统账单自动生成，合同编号 ${contractNo}，导出日期 ${today}。',
    fields: [{ label: '合同编号', value: '${contractNo}' }, { label: '承租人', value: '${tenantName}' }], clauses: [], signatures: [],
    dataSource: 'bills',
    tableColumns: [{ key: 'billNo', label: '账单编号' }, { key: 'period', label: '账期' }, { key: 'totalAmount', label: '应收金额' }, { key: 'paidAmount', label: '已缴金额' }, { key: 'dueDate', label: '应收日期' }, { key: 'status', label: '状态' }],
  },
  {
    name: '合同条款全文（系统记录）', category: '系统记录', scope: '全部', sortOrder: 80,
    description: '把本合同条款连同消防约定导出为一份附件存档',
    docTitle: '合同条款全文', intro: '合同编号 ${contractNo}，承租人 ${tenantName}，导出日期 ${today}。',
    fields: [{ label: '合同编号', value: '${contractNo}' }, { label: '房源', value: '${propertyName}' }], clauses: [], signatures: [],
    dataSource: 'contract-clauses', tableColumns: [],
  },
];

/** 首次访问幂等写入内置模板（可改内容，不可删除） */
export async function ensureAttachmentTemplates(): Promise<void> {
  try {
    for (const t of BUILT_IN) {
      const exist = await AttachmentTemplate.findOne({ where: { name: t.name, isBuiltIn: 1 } });
      if (!exist) await AttachmentTemplate.create({ ...t, isBuiltIn: 1 } as any);
    }
  } catch (e: any) {
    console.error('[单据模板] 内置模板初始化失败：' + (e?.message || e));
  }
}

function normalizeFields(fields: any): any[] {
  if (!Array.isArray(fields)) return [];
  return fields.map((f: any) => ({ label: String(f?.label || '').trim(), value: String(f?.value ?? '') })).filter((f) => f.label).slice(0, 40);
}
function normalizeStrings(list: any, max = 60): string[] {
  if (!Array.isArray(list)) return [];
  return list.map((s: any) => String(s ?? '')).filter((s) => s.trim()).slice(0, max);
}
function normalizeSignatures(list: any): any[] {
  if (!Array.isArray(list)) return [];
  return list.map((s: any) => ({ label: String(s?.label || '').trim(), name: String(s?.name ?? '') })).filter((s) => s.label).slice(0, 6);
}
function normalizeColumns(cols: any): any[] {
  if (!Array.isArray(cols)) return [];
  return cols.map((c: any) => ({ key: String(c?.key || '').trim(), label: String(c?.label || '').trim() })).filter((c) => c.key && c.label).slice(0, 20);
}

// GET /api/attachment-templates?category=&scope=
router.get('/', async (req: AuthRequest, res) => {
  try {
    await ensureAttachmentTemplates();
    const category = String(req.query.category || '').trim();
    const scope = String(req.query.scope || '').trim();
    const where: any = {};
    if (category) where.category = category;
    if (scope && scope !== '全部') where[Op.or] = [{ scope }, { scope: '全部' }];
    const list = await AttachmentTemplate.findAll({ where, order: [['sortOrder', 'ASC'], ['id', 'ASC']] });
    res.json({ code: 200, data: { list, placeholders: TEMPLATE_PLACEHOLDERS } });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message || '读取单据模板失败' }); }
});

// GET /api/attachment-templates/placeholders
router.get('/placeholders', (_req: AuthRequest, res) => {
  res.json({ code: 200, data: { placeholders: TEMPLATE_PLACEHOLDERS, syntax: '在标题/说明/字段值/条款里写 ${key}，生成时自动替换为合同数据' } });
});

// POST /api/attachment-templates — 新建自定义模板（② 用户自定义）
router.post('/', requirePermission('contract', 'create'), auditLog('合同', '新建附件单据模板'), async (req: AuthRequest, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    if (!name) return res.status(400).json({ code: 400, message: '请填写模板名称' });
    const dup = await AttachmentTemplate.findOne({ where: { name } });
    if (dup) return res.status(409).json({ code: 409, message: '已存在同名模板' });
    const row = await AttachmentTemplate.create({
      name, category: String(req.body?.category || '自定义'), scope: String(req.body?.scope || '全部'),
      description: String(req.body?.description || '').trim(), docTitle: String(req.body?.docTitle || name),
      intro: String(req.body?.intro || ''), fields: normalizeFields(req.body?.fields), clauses: normalizeStrings(req.body?.clauses),
      signatures: normalizeSignatures(req.body?.signatures), dataSource: String(req.body?.dataSource || ''),
      tableColumns: normalizeColumns(req.body?.tableColumns), sortOrder: Number(req.body?.sortOrder || 200), isBuiltIn: 0,
    } as any);
    res.json({ code: 200, data: row, message: '模板已创建' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message || '创建模板失败' }); }
});

// PUT /api/attachment-templates/:id — 修改（内置模板也可改内容）
router.put('/:id', requirePermission('contract', 'update'), auditLog('合同', '修改附件单据模板'), async (req: AuthRequest, res) => {
  try {
    const row = await AttachmentTemplate.findByPk(req.params.id);
    if (!row) return res.status(404).json({ code: 404, message: '模板不存在' });
    const m = req.body || {};
    if (m.name !== undefined) { const n = String(m.name).trim(); if (!n) return res.status(400).json({ code: 400, message: '模板名称不能为空' }); (row as any).name = n; }
    if (m.category !== undefined) (row as any).category = String(m.category || '自定义');
    if (m.scope !== undefined) (row as any).scope = String(m.scope || '全部');
    if (m.description !== undefined) (row as any).description = String(m.description || '').trim();
    if (m.docTitle !== undefined) (row as any).docTitle = String(m.docTitle || '');
    if (m.intro !== undefined) (row as any).intro = String(m.intro || '');
    if (m.fields !== undefined) (row as any).fields = normalizeFields(m.fields);
    if (m.clauses !== undefined) (row as any).clauses = normalizeStrings(m.clauses);
    if (m.signatures !== undefined) (row as any).signatures = normalizeSignatures(m.signatures);
    if (m.dataSource !== undefined) (row as any).dataSource = String(m.dataSource || '');
    if (m.tableColumns !== undefined) (row as any).tableColumns = normalizeColumns(m.tableColumns);
    if (m.sortOrder !== undefined) (row as any).sortOrder = Number(m.sortOrder || 200);
    await row.save();
    res.json({ code: 200, data: row, message: '模板已保存' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message || '保存模板失败' }); }
});

// DELETE /api/attachment-templates/:id
router.delete('/:id', requirePermission('contract', 'delete'), auditLog('合同', '删除附件单据模板'), async (req: AuthRequest, res) => {
  try {
    const row = await AttachmentTemplate.findByPk(req.params.id);
    if (!row) return res.status(404).json({ code: 404, message: '模板不存在' });
    if ((row as any).isBuiltIn === 1) return res.status(400).json({ code: 400, message: '内置模板不能删除，可直接修改内容' });
    await row.destroy();
    res.json({ code: 200, message: '模板已删除' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message || '删除模板失败' }); }
});

export default router;
