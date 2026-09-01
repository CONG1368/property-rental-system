import { Router } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { Op } from 'sequelize';
import Meter from '../models/Meter.js';
import MeterReading from '../models/MeterReading.js';
import Property from '../models/Property.js';
import Tenant from '../models/Tenant.js';
import Contract from '../models/Contract.js';
import Bill from '../models/Bill.js';
import { sequelize } from '../config/database.js';

const router = Router();

// GET /api/meters — 表列表（过滤 type/keyword，分页，include property/tenant）
router.get('/', async (req: AuthRequest, res) => {
  try {
    const { page = '1', pageSize = '20', type, keyword } = req.query;
    const where: any = {};
    if (type) where.type = type;
    if (keyword) where.meterNo = { [Op.like]: '%' + keyword + '%' };
    const { count, rows } = await Meter.findAndCountAll({
      where, limit: Number(pageSize), offset: (Number(page) - 1) * Number(pageSize),
      order: [['createdAt', 'DESC']],
      include: [
        { model: Property, as: 'property', attributes: ['id', 'name'] },
        { model: Tenant, as: 'tenant', attributes: ['id', 'name'] },
      ],
      raw: false,
    });
    res.json({ code: 200, data: { total: count, list: rows, page: Number(page), pageSize: Number(pageSize) } });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// POST /api/meters — 创建表（设 lastReading=初始读数）
router.post('/', async (req: AuthRequest, res) => {
  try {
    const { propertyId, tenantId, type, unit, meterNo, lastReading, pricePerUnit, notes } = req.body;
    if (!propertyId || !tenantId) {
      return res.status(400).json({ code: 400, message: '房源和租客为必填项' });
    }
    const meter = await Meter.create({
      propertyId: Number(propertyId),
      tenantId: Number(tenantId),
      type: type || '电',
      unit: unit || '度',
      meterNo: meterNo || '',
      lastReading: Number(lastReading || 0),
      lastReadingDate: null,
      pricePerUnit: Number(pricePerUnit || 0),
      notes: notes || '',
    } as any);
    res.json({ code: 200, data: meter, message: '仪表已创建' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// GET /api/meters/readings — 抄表记录全局列表（供"抄表记录"页签使用）
router.get('/readings', async (req: AuthRequest, res) => {
  try {
    const { page = '1', pageSize = '20', period, type, billed } = req.query;
    const where: any = {};
    if (period) where.period = period;
    if (type) where.type = type;
    if (billed) where.billed = billed;
    const { count, rows } = await MeterReading.findAndCountAll({
      where, limit: Number(pageSize), offset: (Number(page) - 1) * Number(pageSize),
      order: [['period', 'DESC'], ['createdAt', 'DESC']],
      include: [
        { model: Meter, as: 'meter', attributes: ['id', 'meterNo', 'type', 'unit'] },
        { model: Property, as: 'property', attributes: ['id', 'name'] },
        { model: Tenant, as: 'tenant', attributes: ['id', 'name'] },
      ],
      raw: false,
    });
    res.json({ code: 200, data: { total: count, list: rows, page: Number(page), pageSize: Number(pageSize) } });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// POST /api/meters/readings/generate-bills — 生成账单（固定路径，须在 /:id 之前定义）
router.post('/readings/generate-bills', async (req: AuthRequest, res) => {
  try {
    const { period } = req.body;
    if (!period) return res.status(400).json({ code: 400, message: '请指定账期 period' });

    const readings = await MeterReading.findAll({ where: { period, billed: '未生成' } });
    let generated = 0;
    let skipped = 0;

    // 预取所有相关执行中合同，避免循环内 N+1 查询
    const pairs = Array.from(new Set(readings.map((r: any) => `${r.propertyId}-${r.tenantId}`)));
    const contracts = pairs.length
      ? await Contract.findAll({
          where: {
            status: '执行中',
            [Op.or]: pairs.map(p => {
              const [propertyId, tenantId] = p.split('-');
              return { propertyId: Number(propertyId), tenantId: Number(tenantId) };
            }),
          },
        })
      : [];
    const contractMap = new Map(contracts.map((c: any) => [`${c.propertyId}-${c.tenantId}`, c]));

    const transaction = await sequelize.transaction();
    try {
      for (const r of readings) {
        const contract = contractMap.get(`${(r as any).propertyId}-${(r as any).tenantId}`);
        if (!contract) { skipped++; continue; }

        const amount = Number((r as any).amount || 0);
        const type = (r as any).type as string;
        const billNo = 'MB-' + (contract as any).contractNo + '-' + period + '-' + (r as any).id;
        // 幂等：同合同+账期+抄表记录的账单已存在则跳过
        const exists = await Bill.findOne({ where: { billNo }, transaction });
        if (exists) { skipped++; continue; }

        await Bill.create({
          contractId: (contract as any).id,
          billNo, period,
          rentAmount: 0,
          waterFee: type === '水' ? amount : 0,
          electricFee: type === '电' ? amount : 0,
          utilityAmount: amount,
          propertyFee: 0, otherAmount: 0, lateFee: 0,
          totalAmount: amount,
          dueDate: new Date(period + '-15'),
          status: '未缴',
          periodMonths: 1,
        } as any, { transaction });

        await r.update({ billed: '已生成' } as any, { transaction });
        generated++;
      }
      await transaction.commit();
    } catch (err: any) {
      await transaction.rollback();
      throw err;
    }

    res.json({ code: 200, data: { generated, skipped }, message: '成功生成 ' + generated + ' 条账单，跳过 ' + skipped + ' 条' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// PUT /api/meters/:id — 更新表
router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const meter = await Meter.findByPk(req.params.id);
    if (!meter) return res.status(404).json({ code: 404, message: '仪表不存在' });
    await meter.update(req.body);
    res.json({ code: 200, data: meter, message: '仪表已更新' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// DELETE /api/meters/:id — 删除表
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const meter = await Meter.findByPk(req.params.id);
    if (!meter) return res.status(404).json({ code: 404, message: '仪表不存在' });
    await meter.destroy();
    res.json({ code: 200, message: '仪表已删除' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// GET /api/meters/:id/readings — 单表抄表记录列表（按 period DESC）
router.get('/:id/readings', async (req: AuthRequest, res) => {
  try {
    const { page = '1', pageSize = '20' } = req.query;
    const { count, rows } = await MeterReading.findAndCountAll({
      where: { meterId: req.params.id },
      limit: Number(pageSize), offset: (Number(page) - 1) * Number(pageSize),
      order: [['period', 'DESC'], ['createdAt', 'DESC']],
      raw: false,
    });
    res.json({ code: 200, data: { total: count, list: rows, page: Number(page), pageSize: Number(pageSize) } });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// POST /api/meters/:id/read — 抄表：生成 MeterReading 并回写 meter
router.post('/:id/read', async (req: AuthRequest, res) => {
  try {
    const meter = await Meter.findByPk(req.params.id);
    if (!meter) return res.status(404).json({ code: 404, message: '仪表不存在' });

    const { currentReading, reader, readDate } = req.body;
    if (currentReading === undefined || currentReading === null || currentReading === '') {
      return res.status(400).json({ code: 400, message: '本次读数为必填项' });
    }

    const current = Number(currentReading);
    const previous = Number((meter as any).lastReading || 0);
    const usage = current - previous;
    const price = (req.body.pricePerUnit !== undefined && req.body.pricePerUnit !== null && req.body.pricePerUnit !== '')
      ? Number(req.body.pricePerUnit) : Number((meter as any).pricePerUnit || 0);
    const amount = usage * price;

    const readDateStr = typeof readDate === 'string' && readDate
      ? readDate
      : (readDate ? new Date(readDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10));
    const period = readDateStr.slice(0, 7);

    const reading = await MeterReading.create({
      meterId: (meter as any).id,
      propertyId: (meter as any).propertyId,
      tenantId: (meter as any).tenantId,
      type: (meter as any).type,
      period,
      previousReading: previous,
      currentReading: current,
      usage,
      pricePerUnit: price,
      amount,
      reader: reader || '',
      readDate: readDateStr,
      billed: '未生成',
    } as any);

    // 回写 meter：lastReading/日期/单价
    await meter.update({ lastReading: current, lastReadingDate: readDateStr, pricePerUnit: price } as any);

    res.json({ code: 200, data: reading, message: '抄表成功' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

export default router;
