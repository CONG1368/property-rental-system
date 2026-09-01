import { Router } from 'express';
import ParkingSpace from '../models/ParkingSpace.js';
import ParkingRecord from '../models/ParkingRecord.js';
import Property from '../models/Property.js';
import { AuthRequest } from '../middleware/auth.js';
import { Op } from 'sequelize';

const router = Router();

// ====== 车位管理 ======
router.get('/spaces', async (req: AuthRequest, res) => {
  try {
    const { page = 1, pageSize = 20, keyword, status, type } = req.query;
    const where: any = {};
    if (status) where.status = status;
    if (type) where.type = type;
    if (keyword) where[Op.or] = [{ spaceNo: { [Op.like]: `%${keyword}%` } }, { plateNumber: { [Op.like]: `%${keyword}%` } }];
    const { count, rows } = await ParkingSpace.findAndCountAll({
      where, limit: Number(pageSize), offset: (Number(page) - 1) * Number(pageSize),
      order: [['spaceNo', 'ASC']],
      include: [{ model: Property, as: 'property', attributes: ['id', 'name'] }],
      raw: false,
    });
    res.json({ code: 200, data: { total: count, list: rows, page: Number(page), pageSize: Number(pageSize) } });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

router.get('/spaces/stats', async (_req: AuthRequest, res) => {
  try {
    const [total, idle, occupied, monthly, mending] = await Promise.all([
      ParkingSpace.count(),
      ParkingSpace.count({ where: { status: '空闲' } }),
      ParkingSpace.count({ where: { status: '占用' } }),
      ParkingSpace.count({ where: { status: '月租' } }),
      ParkingSpace.count({ where: { status: '维修' } }),
    ]);
    res.json({ code: 200, data: { total, idle, occupied, monthly, mending } });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

router.post('/spaces', async (req: AuthRequest, res) => {
  try {
    const space = await ParkingSpace.create(req.body as any);
    res.json({ code: 200, data: space, message: '车位已创建' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

router.put('/spaces/:id', async (req: AuthRequest, res) => {
  try {
    const space = await ParkingSpace.findByPk(req.params.id);
    if (!space) return res.status(404).json({ code: 404, message: '车位不存在' });
    await space.update(req.body);
    res.json({ code: 200, data: space, message: '车位已更新' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// 车辆驶入
router.post('/spaces/:id/check-in', async (req: AuthRequest, res) => {
  try {
    const space = await ParkingSpace.findByPk(req.params.id);
    if (!space) return res.status(404).json({ code: 404, message: '车位不存在' });
    if (space.status === '占用' || space.status === '月租') return res.status(400).json({ code: 400, message: '车位已被占用' });
    const plate = req.body.plateNumber;
    const record = await ParkingRecord.create({
      spaceId: space.id, tenantId: req.body.tenantId || null, plateNumber: plate,
      type: req.body.type || '临停', amount: 0, startTime: new Date(), status: '进行中',
    } as any);
    await space.update({ status: req.body.type === '月租' ? '月租' : '占用', plateNumber: plate } as any);
    res.json({ code: 200, data: record, message: '车辆驶入登记成功' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// 车辆驶出/结费
router.post('/spaces/:id/check-out', async (req: AuthRequest, res) => {
  try {
    const space = await ParkingSpace.findByPk(req.params.id);
    if (!space) return res.status(404).json({ code: 404, message: '车位不存在' });
    const record = await ParkingRecord.findOne({ where: { spaceId: space.id, status: '进行中' }, order: [['id', 'DESC']] });
    if (!record) return res.status(400).json({ code: 400, message: '该车位无进行中的停车记录' });
    const endTime = new Date();
    const hours = Math.max(0, Math.ceil(((endTime.getTime() - new Date(record.startTime).getTime()) / 3600000)));
    const hourlyRate = 5; // 服务端统一费率（不信任客户端传入，可后续接入 SystemConfig）
    const amount = record.type === '月租' ? 0 : Number((hours * hourlyRate).toFixed(2));
    await record.update({ endTime, amount, status: '已支付' } as any);
    await space.update({ status: '空闲', plateNumber: '' } as any);
    res.json({ code: 200, data: { record, amount, hours }, message: `车辆驶出，计费 ${amount} 元` });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

router.delete('/spaces/:id', async (req: AuthRequest, res) => {
  try {
    const space = await ParkingSpace.findByPk(req.params.id);
    if (!space) return res.status(404).json({ code: 404, message: '车位不存在' });
    await space.destroy();
    res.json({ code: 200, message: '车位已删除' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

// ====== 停车记录 ======
router.get('/records', async (req: AuthRequest, res) => {
  try {
    const { page = 1, pageSize = 20, status, keyword } = req.query;
    const where: any = {};
    if (status) where.status = status;
    if (keyword) where.plateNumber = { [Op.like]: `%${keyword}%` };
    const { count, rows } = await ParkingRecord.findAndCountAll({
      where, limit: Number(pageSize), offset: (Number(page) - 1) * Number(pageSize),
      order: [['id', 'DESC']],
      include: [{ model: ParkingSpace, as: 'space', attributes: ['id', 'spaceNo'] }],
      raw: false,
    });
    res.json({ code: 200, data: { total: count, list: rows, page: Number(page), pageSize: Number(pageSize) } });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

export default router;
