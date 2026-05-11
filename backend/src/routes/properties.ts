import { Router } from 'express';
import Property from '../models/Property';
import { AuthRequest } from '../middleware/auth';
import { Op } from 'sequelize';
import multer from 'multer';
import * as XLSX from 'xlsx';

const router = Router();
const upload = multer({ dest: 'uploads/' });

// GET /api/properties — 房源列表（搜索、筛选、分页）
router.get('/', async (req: AuthRequest, res) => {
  try {
    const { page = 1, pageSize = 20, keyword, type, status } = req.query;
    const where: any = {};
    if (keyword) {
      where[Op.or] = [
        { name: { [Op.like]: `%${keyword}%` } },
        { address: { [Op.like]: `%${keyword}%` } },
      ];
    }
    if (type) where.type = type;
    if (status) where.status = status;

    const { count, rows } = await Property.findAndCountAll({
      where,
      limit: Number(pageSize),
      offset: (Number(page) - 1) * Number(pageSize),
      order: [['createdAt', 'DESC']],
    });

    res.json({
      code: 200,
      data: { total: count, list: rows, page: Number(page), pageSize: Number(pageSize) },
    });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

// POST /api/properties — 创建房源
router.post('/', async (req: AuthRequest, res) => {
  try {
    const property = await Property.create(req.body);
    res.json({ code: 200, data: property, message: '房源创建成功' });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

// GET /api/properties/:id — 房源详情
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const property = await Property.findByPk(req.params.id);
    if (!property) return res.status(404).json({ code: 404, message: '房源不存在' });
    res.json({ code: 200, data: property });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

// PUT /api/properties/:id — 更新房源
router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const property = await Property.findByPk(req.params.id);
    if (!property) return res.status(404).json({ code: 404, message: '房源不存在' });
    await property.update(req.body);
    res.json({ code: 200, data: property, message: '房源更新成功' });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

// DELETE /api/properties/:id — 软删除房源
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const property = await Property.findByPk(req.params.id);
    if (!property) return res.status(404).json({ code: 404, message: '房源不存在' });
    await property.destroy();
    res.json({ code: 200, message: '房源已删除' });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

// PATCH /api/properties/:id/status — 状态转换
router.patch('/:id/status', async (req: AuthRequest, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['空置', '已预订', '已出租', '维修中', '退租中'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ code: 400, message: '无效的房源状态' });
    }
    const property = await Property.findByPk(req.params.id);
    if (!property) return res.status(404).json({ code: 404, message: '房源不存在' });
    await property.update({ status });
    res.json({ code: 200, data: property, message: '状态更新成功' });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

// POST /api/properties/import — Excel批量导入
router.post('/import', upload.single('file'), async (req: AuthRequest, res) => {
  try {
    if (!req.file) return res.status(400).json({ code: 400, message: '请上传Excel文件' });
    const workbook = XLSX.readFile(req.file.path);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows: any[] = XLSX.utils.sheet_to_json(sheet);

    let imported = 0;
    for (const row of rows) {
      await Property.create({
        name: row['名称'] || row['name'] || '',
        type: row['类型'] || row['type'] || '公寓',
        area: Number(row['面积'] || row['area'] || 0),
        address: row['地址'] || row['address'] || '',
        floor: row['楼层'] || row['floor'] || '',
        unit: row['单元'] || row['unit'] || '',
        subType: row['子类型'] || row['subType'] || '',
        owner: row['业主'] || row['owner'] || '',
      });
      imported++;
    }

    res.json({ code: 200, data: { imported }, message: `成功导入${imported}条房源` });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

export default router;
