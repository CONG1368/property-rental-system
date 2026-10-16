import { Router } from 'express';
import { Op } from 'sequelize';
import Contract from '../models/Contract.js';
import AttachmentGroup from '../models/AttachmentGroup.js';
import { AuthRequest } from '../middleware/auth.js';
import { auditLog } from '../middleware/audit-log.js';
import { requirePermission } from '../middleware/rbac.js';
import '../models/index.js';

/**
 * 合同附件便捷化（用户 2026-10-16 要求，13 项方案中的 ⑨⑩⑤ 落地为同一套机制）：
 * - 常用附件组（套餐）：一份「这类合同通常要附哪些材料」的清单，可自定义增删改，内置 4 个可改不可删；
 * - 应用到合同 → 写入 billingConfig.attachmentChecklist（要求项），系统按已上传附件自动判定「已有/还缺」；
 * - 从其他合同继承附件：续约 / 同租客 / 同房源时一键把上份合同的附件条目与清单带过来。
 */
const router = Router();

const BUILT_IN_GROUPS = [
  {
    name: '公寓标准附件包', scope: '公寓', description: '住宅类合同常附的证件与交接单据（可按需删改）', sortOrder: 10,
    items: [
      { title: '身份证复印件', required: true, note: '承租方及同住人' },
      { title: '房屋交接单', required: true, note: '交房时双方签字确认' },
      { title: '消防安全责任书', required: true, note: '可与合同一并签署' },
      { title: '押金收据', required: true, note: '收款后出具' },
      { title: '水电燃气表底数确认单', required: false, note: '入住当日抄表' },
    ],
  },
  {
    name: '厂房仓库标准附件包', scope: '厂房', description: '工业类合同常附的证照与安全材料', sortOrder: 20,
    items: [
      { title: '营业执照复印件', required: true, note: '承租企业' },
      { title: '安全生产责任书', required: true, note: '' },
      { title: '消防验收/备案材料', required: true, note: '' },
      { title: '水电容量确认单', required: false, note: '含变压器容量' },
      { title: '法定代表人身份证复印件', required: true, note: '' },
    ],
  },
  {
    name: '商铺标准附件包', scope: '商铺', description: '临街/商场铺位常附的证照与经营材料', sortOrder: 30,
    items: [
      { title: '营业执照复印件', required: true, note: '' },
      { title: '门店平面图', required: false, note: '' },
      { title: '消防安全责任书', required: true, note: '' },
      { title: '招牌/外立面效果图', required: false, note: '需物业审核' },
    ],
  },
  {
    name: '续约补充附件包', scope: '全部', description: '续约时通常只需要补充的材料', sortOrder: 40,
    items: [
      { title: '续约确认单', required: true, note: '' },
      { title: '最新身份证/营业执照复印件', required: true, note: '证照过期时重新提供' },
    ],
  },
];

/** 首次访问时幂等写入内置组（用户可改内容，但内置组不允许删除） */
export async function ensureAttachmentGroups(): Promise<void> {
  try {
    for (const g of BUILT_IN_GROUPS) {
      const exist = await AttachmentGroup.findOne({ where: { name: g.name, isBuiltIn: 1 } });
      if (!exist) {
        await AttachmentGroup.create({ name: g.name, scope: g.scope, description: g.description, items: g.items, sortOrder: g.sortOrder, isBuiltIn: 1 } as any);
      }
    }
  } catch (e: any) {
    console.error('[附件组] 内置组初始化失败：' + (e?.message || e));
  }
}

function normalizeItems(items: any): { title: string; required: boolean; note: string }[] {
  if (!Array.isArray(items)) return [];
  return items
    .map((i: any) => ({ title: String(i?.title || '').trim(), required: !!i?.required, note: String(i?.note || '').trim() }))
    .filter((i) => i.title)
    .slice(0, 50);
}

/** 已上传附件 ↔ 清单要求项 的匹配（标题相同，或文件名去扩展名后相同） */
function isDone(item: { title: string }, attachments: any[]): string | null {
  const t = item.title.trim();
  const hit = (attachments || []).find((a: any) => {
    const title = String(a?.title || '').trim();
    const bare = String(a?.name || '').replace(/\.[A-Za-z0-9]{1,6}$/, '').trim();
    return (title && title === t) || (bare && bare === t);
  });
  if (!hit) return null;
  return String(hit.title || hit.name || '');
}

function buildChecklistView(contract: any) {
  const cfg = (contract as any).billingConfig || {};
  const checklist: any[] = Array.isArray(cfg.attachmentChecklist) ? cfg.attachmentChecklist : [];
  const attachments: any[] = Array.isArray(cfg.attachments) ? cfg.attachments : [];
  const view = checklist.map((it: any) => {
    const matched = isDone(it, attachments);
    return { title: String(it?.title || '').trim(), required: !!it?.required, note: String(it?.note || ''), done: !!matched, matchedBy: matched || '' };
  });
  const missing = view.filter((v) => !v.done);
  const missingRequired = missing.filter((v) => v.required);
  return { checklist: view, attachments, missing: missing.length, missingRequired: missingRequired.length };
}

async function saveBillingConfig(contract: any, cfg: any): Promise<void> {
  (contract as any).billingConfig = cfg;
  // SQLite 上 JSON 字段必须显式标记变更（见 CLAUDE.md 陷阱）
  (contract as any).changed('billingConfig', true);
  await contract.save();
}

// ===================== 附件组 CRUD =====================

// GET /api/attachment-groups?scope=公寓
router.get('/', async (req: AuthRequest, res) => {
  try {
    await ensureAttachmentGroups();
    const scope = String(req.query.scope || '').trim();
    const where: any = {};
    if (scope && scope !== '全部') where[Op.or] = [{ scope }, { scope: '全部' }];
    const list = await AttachmentGroup.findAll({ where, order: [['sortOrder', 'ASC'], ['id', 'ASC']] });
    res.json({ code: 200, data: { list } });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message || '读取附件组失败' }); }
});

// POST /api/attachment-groups — 新建自定义组
router.post('/', requirePermission('contract', 'create'), auditLog('合同', '新建常用附件组'), async (req: AuthRequest, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    if (!name) return res.status(400).json({ code: 400, message: '请填写附件组名称' });
    const items = normalizeItems(req.body?.items);
    if (items.length === 0) return res.status(400).json({ code: 400, message: '附件组至少要有一条材料' });
    const dup = await AttachmentGroup.findOne({ where: { name } });
    if (dup) return res.status(409).json({ code: 409, message: '已存在同名附件组' });
    const row = await AttachmentGroup.create({
      name, scope: String(req.body?.scope || '全部'), description: String(req.body?.description || '').trim(),
      items, sortOrder: Number(req.body?.sortOrder || 100), isBuiltIn: 0,
    } as any);
    res.json({ code: 200, data: row, message: '附件组已创建' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message || '创建失败' }); }
});

// PUT /api/attachment-groups/:id — 修改（内置组也可改内容）
router.put('/:id', requirePermission('contract', 'update'), auditLog('合同', '修改常用附件组'), async (req: AuthRequest, res) => {
  try {
    const row = await AttachmentGroup.findByPk(req.params.id);
    if (!row) return res.status(404).json({ code: 404, message: '附件组不存在' });
    if (req.body?.name !== undefined) {
      const name = String(req.body.name).trim();
      if (!name) return res.status(400).json({ code: 400, message: '附件组名称不能为空' });
      (row as any).name = name;
    }
    if (req.body?.scope !== undefined) (row as any).scope = String(req.body.scope || '全部');
    if (req.body?.description !== undefined) (row as any).description = String(req.body.description || '').trim();
    if (req.body?.items !== undefined) {
      const items = normalizeItems(req.body.items);
      if (items.length === 0) return res.status(400).json({ code: 400, message: '附件组至少要有一条材料' });
      (row as any).items = items;
    }
    if (req.body?.sortOrder !== undefined) (row as any).sortOrder = Number(req.body.sortOrder || 100);
    await row.save();
    res.json({ code: 200, data: row, message: '附件组已保存' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message || '保存失败' }); }
});

// DELETE /api/attachment-groups/:id
router.delete('/:id', requirePermission('contract', 'delete'), auditLog('合同', '删除常用附件组'), async (req: AuthRequest, res) => {
  try {
    const row = await AttachmentGroup.findByPk(req.params.id);
    if (!row) return res.status(404).json({ code: 404, message: '附件组不存在' });
    if ((row as any).isBuiltIn === 1) return res.status(400).json({ code: 400, message: '内置附件组不能删除，可直接修改内容' });
    await row.destroy();
    res.json({ code: 200, message: '附件组已删除' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message || '删除失败' }); }
});

// ===================== 合同侧的待补清单 / 继承 =====================

// GET /api/attachment-groups/checklist/:contractId
router.get('/checklist/:contractId', async (req: AuthRequest, res) => {
  try {
    const contract = await Contract.findByPk(req.params.contractId);
    if (!contract) return res.status(404).json({ code: 404, message: '合同不存在' });
    res.json({ code: 200, data: buildChecklistView(contract) });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message || '读取待补清单失败' }); }
});

// POST /api/attachment-groups/checklist/:contractId/apply — 把某个附件组应用到合同（按标题去重合并）
router.post('/checklist/:contractId/apply', requirePermission('contract', 'update'), auditLog('合同', '应用常用附件组'), async (req: AuthRequest, res) => {
  try {
    const contract = await Contract.findByPk(req.params.contractId);
    if (!contract) return res.status(404).json({ code: 404, message: '合同不存在' });
    const group = await AttachmentGroup.findByPk(req.body?.groupId);
    if (!group) return res.status(404).json({ code: 404, message: '附件组不存在' });
    const cfg = { ...(((contract as any).billingConfig as any) || {}) };
    const current: any[] = Array.isArray(cfg.attachmentChecklist) ? [...cfg.attachmentChecklist] : [];
    const have = new Set(current.map((i: any) => String(i?.title || '').trim()));
    let added = 0;
    for (const it of normalizeItems((group as any).items)) {
      if (have.has(it.title)) continue;
      current.push(it);
      have.add(it.title);
      added += 1;
    }
    cfg.attachmentChecklist = current;
    await saveBillingConfig(contract, cfg);
    res.json({ code: 200, data: buildChecklistView(contract), message: '已加入「' + (group as any).name + '」' + added + ' 项待补材料' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message || '应用附件组失败' }); }
});

// DELETE /api/attachment-groups/checklist/:contractId/item — 移除某项要求
router.delete('/checklist/:contractId/item', requirePermission('contract', 'update'), auditLog('合同', '移除待补材料要求'), async (req: AuthRequest, res) => {
  try {
    const contract = await Contract.findByPk(req.params.contractId);
    if (!contract) return res.status(404).json({ code: 404, message: '合同不存在' });
    const title = String(req.body?.title || '').trim();
    const cfg = { ...(((contract as any).billingConfig as any) || {}) };
    const current: any[] = Array.isArray(cfg.attachmentChecklist) ? cfg.attachmentChecklist : [];
    cfg.attachmentChecklist = current.filter((i: any) => String(i?.title || '').trim() !== title);
    await saveBillingConfig(contract, cfg);
    res.json({ code: 200, data: buildChecklistView(contract), message: '已移除该要求' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message || '移除失败' }); }
});

// POST /api/attachment-groups/inherit/:contractId — 从其他合同继承附件与清单（续约/同租客/同房源）
// body: { fromContractId } 或 { fromTenantId }（后者取该租客最近一份合同）
router.post('/inherit/:contractId', requirePermission('contract', 'update'), auditLog('合同', '继承其他合同的附件'), async (req: AuthRequest, res) => {
  try {
    const contract = await Contract.findByPk(req.params.contractId);
    if (!contract) return res.status(404).json({ code: 404, message: '合同不存在' });

    let source: any = null;
    if (req.body?.fromContractId) {
      source = await Contract.findByPk(req.body.fromContractId);
    } else if (req.body?.fromTenantId) {
      source = await Contract.findOne({
        where: { tenantId: req.body.fromTenantId, id: { [Op.ne]: (contract as any).id } },
        order: [['createdAt', 'DESC']],
      });
    }
    if (!source) return res.status(404).json({ code: 404, message: '没有找到可继承的合同' });
    if ((source as any).id === (contract as any).id) return res.status(400).json({ code: 400, message: '不能从当前合同自身继承' });

    const srcCfg = (source as any).billingConfig || {};
    const cfg = { ...(((contract as any).billingConfig as any) || {}) };
    const mine: any[] = Array.isArray(cfg.attachments) ? [...cfg.attachments] : [];
    const minePaths = new Set(mine.map((a: any) => String(a?.path || '')));
    let files = 0;
    for (const a of (Array.isArray(srcCfg.attachments) ? srcCfg.attachments : [])) {
      if (!a?.path || minePaths.has(String(a.path))) continue;
      mine.push({ name: a.name || '', path: a.path, size: a.size || 0, uploadedAt: new Date().toISOString(), title: a.title || '', inheritedFrom: (source as any).contractNo || '' });
      minePaths.add(String(a.path));
      files += 1;
    }
    cfg.attachments = mine;

    const current: any[] = Array.isArray(cfg.attachmentChecklist) ? [...cfg.attachmentChecklist] : [];
    const have = new Set(current.map((i: any) => String(i?.title || '').trim()));
    let items = 0;
    for (const it of (Array.isArray(srcCfg.attachmentChecklist) ? srcCfg.attachmentChecklist : [])) {
      const title = String(it?.title || '').trim();
      if (!title || have.has(title)) continue;
      current.push({ title, required: !!it.required, note: String(it.note || '') });
      have.add(title);
      items += 1;
    }
    cfg.attachmentChecklist = current;
    await saveBillingConfig(contract, cfg);

    const view = buildChecklistView(contract);
    res.json({ code: 200, data: { ...view, inheritedFiles: files, inheritedItems: items, from: (source as any).contractNo || '' }, message: '已从合同 ' + ((source as any).contractNo || '') + ' 继承 ' + files + ' 个附件、' + items + ' 项材料要求' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message || '继承附件失败' }); }
});

export default router;
