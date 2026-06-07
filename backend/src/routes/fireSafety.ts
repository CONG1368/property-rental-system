import { Router } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { Op, fn, col } from 'sequelize';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import FireInspection from '../models/FireInspection.js';
import FireEquipment from '../models/FireEquipment.js';
import FireViolation from '../models/FireViolation.js';
import FireDrill from '../models/FireDrill.js';
import Property from '../models/Property.js';

const router = Router();
const uploadDir = 'uploads/fire';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({ dest: uploadDir, limits: { fileSize: 10 * 1024 * 1024 } });

// ====== 综合看板 ======
router.get('/dashboard', async (_req: AuthRequest, res) => {
  try {
    const now = new Date();
    const thirtyDaysLater = new Date(now.getTime() + 30 * 86400000).toISOString().slice(0, 10);
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const [totalEquipment, expiringEquipment, pendingViolations, monthInspections, equipmentByStatus, inspectionByResult, violationBySeverity] = await Promise.all([
      FireEquipment.count(),
      FireEquipment.count({ where: { status: { [Op.in]: ['即将过期', '已过期'] } } }),
      FireViolation.count({ where: { status: { [Op.in]: ['待整改', '整改中', '逾期未改'] } } }),
      FireInspection.count({ where: { inspectionDate: { [Op.like]: `${thisMonth}%` } as any } }),
      FireEquipment.findAll({ attributes: ['status', [fn('COUNT', col('id')), 'count']], group: ['status'], raw: true }),
      FireInspection.findAll({ attributes: ['result', [fn('COUNT', col('id')), 'count']], group: ['result'], raw: true }),
      FireViolation.findAll({ attributes: ['severity', [fn('COUNT', col('id')), 'count']], group: ['severity'], raw: true }),
    ]);

    const expiringList = await FireEquipment.findAll({
      where: { status: { [Op.in]: ['正常', '即将过期'] }, nextCheckDate: { [Op.lte]: thirtyDaysLater } as any },
      include: [{ model: Property, as: 'property', attributes: ['id', 'name'] }],
      limit: 10, order: [['nextCheckDate', 'ASC']], raw: false,
    });

    const pendingList = await FireViolation.findAll({
      where: { status: { [Op.in]: ['待整改', '整改中', '逾期未改'] } },
      include: [{ model: Property, as: 'property', attributes: ['id', 'name'] }],
      limit: 10, order: [['deadline', 'ASC']], raw: false,
    });

    res.json({ code: 200, data: {
      totalEquipment, expiringEquipment, pendingViolations, monthInspections,
      equipmentByStatus: equipmentByStatus.map((s: any) => ({ status: s.status, count: Number(s.count) })),
      inspectionByResult: inspectionByResult.map((s: any) => ({ result: s.result, count: Number(s.count) })),
      violationBySeverity: violationBySeverity.map((s: any) => ({ severity: s.severity, count: Number(s.count) })),
      expiringList: expiringList.map((e: any) => ({ id: e.id, name: e.name, propertyName: e.property?.name, status: e.status, nextCheckDate: e.nextCheckDate })),
      pendingList: pendingList.map((v: any) => ({ id: v.id, description: v.description, propertyName: v.property?.name, severity: v.severity, status: v.status, deadline: v.deadline })),
    } });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// ====== 检查记录 CRUD ======
router.get('/inspections', async (req: AuthRequest, res) => {
  try {
    const { page = '1', pageSize = '20', propertyId, result, startDate, endDate } = req.query;
    const where: any = {};
    if (propertyId) where.propertyId = Number(propertyId);
    if (result) where.result = result;
    if (startDate && endDate) where.inspectionDate = { [Op.between]: [startDate as string, endDate as string] };
    const { count, rows } = await FireInspection.findAndCountAll({
      where, limit: Number(pageSize), offset: (Number(page) - 1) * Number(pageSize),
      order: [['inspectionDate', 'DESC']],
      include: [{ model: Property, as: 'property', attributes: ['id', 'name'] }],
      raw: false,
    });
    res.json({ code: 200, data: { total: count, list: rows, page: Number(page), pageSize: Number(pageSize) } });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

router.get('/inspections/stats', async (req: AuthRequest, res) => {
  try {
    const { propertyId } = req.query;
    const where: any = {};
    if (propertyId) where.propertyId = Number(propertyId);
    const [total, byResult] = await Promise.all([
      FireInspection.count({ where }),
      FireInspection.findAll({ where, attributes: ['result', [fn('COUNT', col('id')), 'count']], group: ['result'], raw: true }),
    ]);
    res.json({ code: 200, data: { total, byResult: byResult.map((s: any) => ({ result: s.result, count: Number(s.count) })) } });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

router.get('/inspections/:id', async (req: AuthRequest, res) => {
  try {
    const insp = await FireInspection.findByPk(req.params.id, {
      include: [{ model: Property, as: 'property', attributes: ['id', 'name'] }],
    });
    if (!insp) return res.status(404).json({ code: 404, message: '检查记录不存在' });
    const violations = await FireViolation.findAll({ where: { inspectionId: (insp as any).id }, raw: true });
    res.json({ code: 200, data: { ...(insp as any).toJSON(), violations } });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

router.post('/inspections', async (req: AuthRequest, res) => {
  try {
    const insp = await FireInspection.create({ ...req.body, inspectorId: req.userId } as any);
    res.json({ code: 200, data: insp, message: '检查记录已创建' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

router.put('/inspections/:id', async (req: AuthRequest, res) => {
  try {
    const insp = await FireInspection.findByPk(req.params.id);
    if (!insp) return res.status(404).json({ code: 404, message: '检查记录不存在' });
    await insp.update(req.body);
    res.json({ code: 200, data: insp, message: '检查记录已更新' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

router.delete('/inspections/:id', async (req: AuthRequest, res) => {
  try {
    const insp = await FireInspection.findByPk(req.params.id);
    if (!insp) return res.status(404).json({ code: 404, message: '检查记录不存在' });
    await insp.destroy();
    res.json({ code: 200, message: '检查记录已删除' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

router.post('/inspections/:id/upload', upload.array('files', 10), async (req: AuthRequest, res) => {
  try {
    const insp = await FireInspection.findByPk(req.params.id);
    if (!insp) return res.status(404).json({ code: 404, message: '检查记录不存在' });
    const files = (req as any).files || [];
    const existing = ((insp as any).attachments || []) as any[];
    const newFiles = files.map((f: any) => ({ name: f.originalname, path: f.path, size: f.size, uploadedAt: new Date().toISOString() }));
    (insp as any).attachments = [...existing, ...newFiles];
    (insp as any).changed('attachments', true);
    await insp.save();
    res.json({ code: 200, data: newFiles, message: '附件上传成功' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// ====== 器材台账 CRUD ======
router.get('/equipment', async (req: AuthRequest, res) => {
  try {
    const { page = '1', pageSize = '20', propertyId, category, status, keyword } = req.query;
    const where: any = {};
    if (propertyId) where.propertyId = Number(propertyId);
    if (category) where.category = category;
    if (status) where.status = status;
    if (keyword) where.name = { [Op.like]: `%${keyword}%` };
    const { count, rows } = await FireEquipment.findAndCountAll({
      where, limit: Number(pageSize), offset: (Number(page) - 1) * Number(pageSize),
      order: [['createdAt', 'DESC']],
      include: [{ model: Property, as: 'property', attributes: ['id', 'name'] }],
      raw: false,
    });
    res.json({ code: 200, data: { total: count, list: rows, page: Number(page), pageSize: Number(pageSize) } });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

router.get('/equipment/stats', async (req: AuthRequest, res) => {
  try {
    const [total, byStatus] = await Promise.all([
      FireEquipment.count(),
      FireEquipment.findAll({ attributes: ['status', [fn('COUNT', col('id')), 'count']], group: ['status'], raw: true }),
    ]);
    res.json({ code: 200, data: { total, byStatus: byStatus.map((s: any) => ({ status: s.status, count: Number(s.count) })) } });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

router.get('/equipment/:id', async (req: AuthRequest, res) => {
  try {
    const eq = await FireEquipment.findByPk(req.params.id, { include: [{ model: Property, as: 'property', attributes: ['id', 'name'] }] });
    if (!eq) return res.status(404).json({ code: 404, message: '器材不存在' });
    res.json({ code: 200, data: eq });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

router.post('/equipment', async (req: AuthRequest, res) => {
  try {
    const eq = await FireEquipment.create(req.body as any);
    res.json({ code: 200, data: eq, message: '器材已添加' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

router.put('/equipment/:id', async (req: AuthRequest, res) => {
  try {
    const eq = await FireEquipment.findByPk(req.params.id);
    if (!eq) return res.status(404).json({ code: 404, message: '器材不存在' });
    await eq.update(req.body);
    res.json({ code: 200, data: eq, message: '器材已更新' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

router.delete('/equipment/:id', async (req: AuthRequest, res) => {
  try {
    const eq = await FireEquipment.findByPk(req.params.id);
    if (!eq) return res.status(404).json({ code: 404, message: '器材不存在' });
    await eq.destroy();
    res.json({ code: 200, message: '器材已删除' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// ====== 违规记录 CRUD ======
router.get('/violations', async (req: AuthRequest, res) => {
  try {
    const { page = '1', pageSize = '20', propertyId, status, severity } = req.query;
    const where: any = {};
    if (propertyId) where.propertyId = Number(propertyId);
    if (status) where.status = status;
    if (severity) where.severity = severity;
    const { count, rows } = await FireViolation.findAndCountAll({
      where, limit: Number(pageSize), offset: (Number(page) - 1) * Number(pageSize),
      order: [['createdAt', 'DESC']],
      include: [{ model: Property, as: 'property', attributes: ['id', 'name'] }],
      raw: false,
    });
    res.json({ code: 200, data: { total: count, list: rows, page: Number(page), pageSize: Number(pageSize) } });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

router.get('/violations/stats', async (req: AuthRequest, res) => {
  try {
    const [total, byStatus, bySeverity] = await Promise.all([
      FireViolation.count(),
      FireViolation.findAll({ attributes: ['status', [fn('COUNT', col('id')), 'count']], group: ['status'], raw: true }),
      FireViolation.findAll({ attributes: ['severity', [fn('COUNT', col('id')), 'count']], group: ['severity'], raw: true }),
    ]);
    res.json({ code: 200, data: { total, byStatus: byStatus.map((s: any) => ({ status: s.status, count: Number(s.count) })), bySeverity: bySeverity.map((s: any) => ({ severity: s.severity, count: Number(s.count) })) } });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

router.get('/violations/:id', async (req: AuthRequest, res) => {
  try {
    const v = await FireViolation.findByPk(req.params.id, { include: [{ model: Property, as: 'property', attributes: ['id', 'name'] }] });
    if (!v) return res.status(404).json({ code: 404, message: '违规记录不存在' });
    res.json({ code: 200, data: v });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

router.post('/violations', async (req: AuthRequest, res) => {
  try {
    const v = await FireViolation.create({ ...req.body, operatorId: req.userId } as any);
    res.json({ code: 200, data: v, message: '违规记录已创建' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

router.put('/violations/:id', async (req: AuthRequest, res) => {
  try {
    const v = await FireViolation.findByPk(req.params.id);
    if (!v) return res.status(404).json({ code: 404, message: '违规记录不存在' });
    await v.update(req.body);
    res.json({ code: 200, data: v, message: '违规记录已更新' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

router.post('/violations/:id/rectify', async (req: AuthRequest, res) => {
  try {
    const v = await FireViolation.findByPk(req.params.id);
    if (!v) return res.status(404).json({ code: 404, message: '违规记录不存在' });
    await v.update({ status: '已整改', rectifiedDate: new Date().toISOString().slice(0, 10), ...req.body } as any);
    res.json({ code: 200, data: v, message: '整改已提交' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// ====== 演练记录 CRUD ======
router.get('/drills', async (req: AuthRequest, res) => {
  try {
    const { page = '1', pageSize = '20', propertyId } = req.query;
    const where: any = {};
    if (propertyId) where.propertyId = Number(propertyId);
    const { count, rows } = await FireDrill.findAndCountAll({
      where, limit: Number(pageSize), offset: (Number(page) - 1) * Number(pageSize),
      order: [['drillDate', 'DESC']],
      include: [{ model: Property, as: 'property', attributes: ['id', 'name'] }],
      raw: false,
    });
    res.json({ code: 200, data: { total: count, list: rows, page: Number(page), pageSize: Number(pageSize) } });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

router.get('/drills/:id', async (req: AuthRequest, res) => {
  try {
    const d = await FireDrill.findByPk(req.params.id, { include: [{ model: Property, as: 'property', attributes: ['id', 'name'] }] });
    if (!d) return res.status(404).json({ code: 404, message: '演练记录不存在' });
    res.json({ code: 200, data: d });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

router.post('/drills', async (req: AuthRequest, res) => {
  try {
    const d = await FireDrill.create(req.body as any);
    res.json({ code: 200, data: d, message: '演练记录已创建' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

router.put('/drills/:id', async (req: AuthRequest, res) => {
  try {
    const d = await FireDrill.findByPk(req.params.id);
    if (!d) return res.status(404).json({ code: 404, message: '演练记录不存在' });
    await d.update(req.body);
    res.json({ code: 200, data: d, message: '演练记录已更新' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

router.delete('/drills/:id', async (req: AuthRequest, res) => {
  try {
    const d = await FireDrill.findByPk(req.params.id);
    if (!d) return res.status(404).json({ code: 404, message: '演练记录不存在' });
    await d.destroy();
    res.json({ code: 200, message: '演练记录已删除' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

export default router;
