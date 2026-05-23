import { Router } from 'express';
import Property from '../models/Property.js';
import Contract from '../models/Contract.js';
import Tenant from '../models/Tenant.js';
import DoorLock from '../models/DoorLock.js';
import RoomStatusLog from '../models/RoomStatusLog.js';
import { AuthRequest } from '../middleware/auth.js';
import { Op, fn, col, literal } from 'sequelize';
import multer from 'multer';
import * as XLSX from 'xlsx';
import { transitionRoomStatus, getValidTransitions, ROOM_STATUSES } from '../services/room-status-workflow.js';
import { broadcast } from '../websocket/index.js';

const router = Router();
const upload = multer({ dest: 'uploads/' });

// ==================== 固定路径路由（必须在 /:id 之前） ====================

// GET /api/properties/rooms/kanban — 房态看板数据
router.get('/rooms/kanban', async (req: AuthRequest, res) => {
  try {
    const { buildingName, floorOrder, status, type } = req.query;
    const where: any = {};
    if (type) where.type = type;
    if (buildingName) where.buildingName = buildingName;
    if (floorOrder !== undefined) where.floorOrder = Number(floorOrder);
    if (status) where.status = status;

    const properties = await Property.findAll({
      where,
      order: [['buildingOrder', 'ASC'], ['floorOrder', 'ASC'], ['roomNumber', 'ASC']],
    });

    // 获取所有房源关联的门锁信息（批量查询）
    const propertyIds = properties.map(p => p.id);
    const doorLocks = await DoorLock.findAll({
      where: { propertyId: { [Op.in]: propertyIds } },
      attributes: ['id', 'propertyId', 'name', 'category', 'status'],
      raw: true,
    });
    const lockMap: Record<number, any[]> = {};
    doorLocks.forEach((dl: any) => {
      if (!lockMap[dl.propertyId]) lockMap[dl.propertyId] = [];
      lockMap[dl.propertyId].push(dl);
    });

    // 获取已出租房源的当前租客信息
    const rentedProps = properties.filter(p => p.status === '已出租');
    const contractMap: Record<number, any> = {};
    if (rentedProps.length > 0) {
      const contracts = await Contract.findAll({
        where: { propertyId: { [Op.in]: rentedProps.map(p => p.id) }, status: '执行中' },
        include: [{ model: Tenant, as: 'tenant', attributes: ['id', 'name'] }],
        attributes: ['id', 'propertyId', 'tenantId', 'endDate', 'rentAmount', 'contractNo'],
        raw: false,
      });
      contracts.forEach((c: any) => {
        contractMap[c.propertyId] = {
          tenantName: c.tenant?.name || '',
          contractEndDate: c.endDate,
          rentAmount: c.rentAmount,
          contractNo: c.contractNo,
        };
      });
    }

    // 按楼栋+楼层分组
    const buildingMap: Record<string, { buildingName: string; buildingOrder: number; floors: Record<number, any[]> }> = {};
    const buildings: string[] = [];

    for (const p of properties) {
      const bn = (p as any).buildingName || '';
      const fo = (p as any).floorOrder || 0;
      if (!buildingMap[bn]) {
        buildingMap[bn] = { buildingName: bn, buildingOrder: (p as any).buildingOrder || 0, floors: {} };
        buildings.push(bn);
      }
      if (!buildingMap[bn].floors[fo]) {
        buildingMap[bn].floors[fo] = [];
      }
      buildingMap[bn].floors[fo].push({
        id: p.id,
        name: p.name,
        roomNumber: (p as any).roomNumber || '',
        floor: p.floor,
        floorOrder: fo,
        status: p.status,
        area: p.area,
        type: p.type,
        buildingName: bn,
        contract: contractMap[p.id] || null,
        doorLocks: lockMap[p.id] || [],
      });
    }

    // 组装楼层数组
    const buildingFloors = buildings.map(bn => {
      const b = buildingMap[bn];
      const floors = Object.keys(b.floors)
        .map(Number)
        .sort((a, b) => a - b)
        .map(f => ({ floorOrder: f, label: `${f}F`, rooms: b.floors[f] }));
      return { buildingName: b.buildingName, buildingOrder: b.buildingOrder, floors };
    }).sort((a, b) => a.buildingOrder - b.buildingOrder);

    // 统计
    const total = properties.length;
    const statusCounts: Record<string, number> = {};
    ROOM_STATUSES.forEach(s => { statusCounts[s] = 0; });
    properties.forEach(p => { statusCounts[p.status] = (statusCounts[p.status] || 0) + 1; });

    res.json({
      code: 200,
      data: {
        buildings: buildingFloors,
        allFloors: buildingFloors.flatMap(b => b.floors),
        stats: {
          total,
          ...statusCounts,
          occupancyRate: total > 0 ? Math.round((statusCounts['已出租'] / total) * 1000) / 10 : 0,
          vacancyRate: total > 0 ? Math.round((statusCounts['空置'] / total) * 1000) / 10 : 0,
        },
      },
    });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

// GET /api/properties/rooms/stats — 房态统计数据
router.get('/rooms/stats', async (req: AuthRequest, res) => {
  try {
    const { type } = req.query;
    const where: any = {};
    if (type) where.type = type;
    const total = await Property.count({ where });
    const statusCounts: Record<string, number> = {};
    for (const s of ROOM_STATUSES) {
      statusCounts[s] = await Property.count({ where: { ...where, status: s } });
    }

    // 楼栋统计
    const buildingStats = await Property.findAll({
      where,
      attributes: ['buildingName', [fn('COUNT', col('id')), 'count'], [fn('SUM', literal("CASE WHEN status = '已出租' THEN 1 ELSE 0 END")), 'occupied']],
      group: ['buildingName'],
      raw: true,
    });

    res.json({
      code: 200,
      data: {
        total,
        statusCounts,
        occupancyRate: total > 0 ? Math.round((statusCounts['已出租'] / total) * 1000) / 10 : 0,
        buildingStats,
      },
    });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

// GET /api/properties/rooms/analytics — 可视化分析数据
router.get('/rooms/analytics', async (req: AuthRequest, res) => {
  try {
    const { type } = req.query;
    const where: any = {};
    if (type) where.type = type;

    // 楼栋对比数据
    const buildingData = await Property.findAll({
      where,
      attributes: [
        'buildingName',
        [fn('COUNT', col('id')), 'total'],
        [fn('SUM', literal("CASE WHEN status = '已出租' THEN 1 ELSE 0 END")), 'occupied'],
        [fn('SUM', literal("CASE WHEN status = '空置' THEN 1 ELSE 0 END")), 'vacant'],
        [fn('SUM', literal("CASE WHEN status = '维修中' THEN 1 ELSE 0 END")), 'maintenance'],
      ],
      group: ['buildingName'],
      order: [['buildingName', 'ASC']],
      raw: true,
    });

    // 楼层热力图数据
    const floorData = await Property.findAll({
      where,
      attributes: [
        'buildingName', 'floorOrder',
        [fn('COUNT', col('id')), 'total'],
        [fn('SUM', literal("CASE WHEN status = '已出租' THEN 1 ELSE 0 END")), 'occupied'],
      ],
      group: ['buildingName', 'floorOrder'],
      order: [['buildingName', 'ASC'], ['floorOrder', 'ASC']],
      raw: true,
    });

    // 状态流转桑基图数据（最近500条日志）
    const logs = await RoomStatusLog.findAll({
      attributes: ['oldStatus', 'newStatus', [fn('COUNT', col('id')), 'count']],
      where: { oldStatus: { [Op.ne]: '' } },
      group: ['oldStatus', 'newStatus'],
      order: [[fn('COUNT', col('id')), 'DESC']],
      limit: 50,
      raw: true,
    });

    res.json({
      code: 200,
      data: {
        buildingData,
        floorHeatmap: floorData,
        statusFlow: logs,
      },
    });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

// POST /api/properties/rooms/batch-generate — 批量生成房间
router.post('/rooms/batch-generate', async (req: AuthRequest, res) => {
  try {
    const {
      buildingName, buildingOrder = 0,
      startFloor, endFloor,
      roomsPerFloor,       // number[] — 每层房间数
      roomNamingRule = 'sequential', // sequential | floorBased
      roomNamePrefix = '',
      defaultArea = 35,
      defaultRentWaterFee = 5.0,
      defaultRentElectricFee = 1.2,
      defaultRentPropertyFee = 3.5,
    } = req.body;

    if (!buildingName) return res.status(400).json({ code: 400, message: '请输入楼栋名称' });
    if (startFloor == null || endFloor == null) return res.status(400).json({ code: 400, message: '请输入起止楼层' });

    const generated: any[] = [];
    const floorCount = endFloor - startFloor + 1;
    const roomsArr = Array.isArray(roomsPerFloor) && roomsPerFloor.length === floorCount
      ? roomsPerFloor
      : Array(floorCount).fill(roomsPerFloor?.[0] || 4);

    for (let fi = 0; fi < floorCount; fi++) {
      const floorNum = startFloor + fi;
      const roomCount = roomsArr[fi];
      for (let ri = 1; ri <= roomCount; ri++) {
        let roomNumber: string;
        if (roomNamingRule === 'floorBased') {
          roomNumber = `${roomNamePrefix || buildingName}${floorNum}F-${String(ri).padStart(2, '0')}`;
        } else {
          roomNumber = `${roomNamePrefix || ''}${floorNum}${String(ri).padStart(2, '0')}`;
        }
        const name = `${buildingName}${roomNumber}室`;

        // 检查重复
        const existing = await Property.findOne({ where: { buildingName, roomNumber } });
        if (existing) continue;

        const property = await Property.create({
          name,
          type: '公寓',
          area: defaultArea,
          buildingName,
          roomNumber,
          buildingOrder,
          floorOrder: floorNum,
          floor: String(floorNum),
          address: `${buildingName}${floorNum}楼${roomNumber}室`,
          waterFeeRate: defaultRentWaterFee,
          electricFeeRate: defaultRentElectricFee,
          propertyFeeRate: defaultRentPropertyFee,
          status: '空置',
        } as any);

        generated.push({ id: property.id, name, roomNumber, floor: floorNum });
      }
    }

    res.json({
      code: 200,
      data: { generated: generated.length, buildingName, rooms: generated },
      message: `成功生成${generated.length}间房源`,
    });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

// PATCH /api/properties/rooms/batch-status — 批量更新房间状态
router.patch('/rooms/batch-status', async (req: AuthRequest, res) => {
  try {
    const { ids, newStatus, notes } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ code: 400, message: '请选择至少一间房源' });
    }
    if (!ROOM_STATUSES.includes(newStatus)) {
      return res.status(400).json({ code: 400, message: '无效的房源状态' });
    }

    const results: any[] = [];
    const errors: any[] = [];
    for (const id of ids) {
      try {
        const { property, oldStatus } = await transitionRoomStatus(id, newStatus, (req as any).user?.userId || 1, {
          action: 'batch',
          notes: notes || '批量状态变更',
        });
        results.push({ id, name: property.name, oldStatus, newStatus });
      } catch (e: any) {
        errors.push({ id, message: e.message });
      }
    }

    res.json({
      code: 200,
      data: { success: results, failed: errors },
      message: `成功更新${results.length}间，失败${errors.length}间`,
    });

    // 广播批量房态变更事件
    if (results.length > 0) {
      broadcast('room:batch-status-changed', {
        ids: results.map((r: any) => r.id),
        newStatus,
        count: results.length,
        timestamp: Date.now(),
      });
    }
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

// GET /api/properties/rooms/export — 导出房态报表
router.get('/rooms/export', async (req: AuthRequest, res) => {
  try {
    const { format = 'xlsx', buildingName, status, type, ids } = req.query;
    const where: any = {};
    if (buildingName) where.buildingName = buildingName;
    if (status) where.status = status;
    if (type) where.type = type;
    if (ids) {
      const idArr = String(ids).split(',').map(Number).filter(n => !isNaN(n));
      if (idArr.length > 0) where.id = { [Op.in]: idArr };
    }

    const properties = await Property.findAll({
      where,
      order: [['buildingOrder', 'ASC'], ['floorOrder', 'ASC'], ['roomNumber', 'ASC']],
    });

    // 获取租客和合同关联信息
    const propertyIds = properties.map(p => p.id);
    const contracts = await Contract.findAll({
      where: { propertyId: { [Op.in]: propertyIds }, status: '执行中' },
      include: [{ model: Tenant, as: 'tenant', attributes: ['id', 'name'] }],
      attributes: ['id', 'propertyId', 'tenantId', 'endDate', 'rentAmount', 'contractNo'],
      raw: false,
    });
    const contractMap: Record<number, any> = {};
    contracts.forEach((c: any) => {
      contractMap[c.propertyId] = {
        tenantName: c.tenant?.name || '',
        contractEndDate: c.endDate,
        rentAmount: c.rentAmount,
        contractNo: c.contractNo,
      };
    });

    // 门锁
    const doorLocks = await DoorLock.findAll({
      where: { propertyId: { [Op.in]: propertyIds } },
      attributes: ['id', 'propertyId', 'category', 'status'],
      raw: true,
    });
    const lockMap: Record<number, string> = {};
    doorLocks.forEach((dl: any) => {
      lockMap[dl.propertyId] = `${dl.category === '智能门锁' ? '智能' : '传统'}·${dl.status}`;
    });

    if (format === 'pdf') {
      // PDF 导出 — 使用 html2canvas 截图法（前端调用打印服务更合适）
      // 这里返回渲染 PDF 所需的数据，由前端 jspdf 完成
      const rows = properties.map(p => ({
        roomNumber: (p as any).roomNumber || '',
        buildingName: (p as any).buildingName || '',
        floor: p.floor,
        status: p.status,
        area: Number(p.area),
        tenantName: contractMap[p.id]?.tenantName || '-',
        contractEndDate: contractMap[p.id]?.contractEndDate || '-',
        lockStatus: lockMap[p.id] || '-',
        rentAmount: contractMap[p.id]?.rentAmount || '-',
      }));

      // 按楼栋分组统计
      const buildingRows: Record<string, { total: number; occupied: number }> = {};
      properties.forEach(p => {
        const bn = (p as any).buildingName || '未分组';
        if (!buildingRows[bn]) buildingRows[bn] = { total: 0, occupied: 0 };
        buildingRows[bn].total++;
        if (p.status === '已出租') buildingRows[bn].occupied++;
      });

      res.json({
        code: 200,
        data: {
          type: 'pdf',
          rows,
          buildingSummary: Object.entries(buildingRows).map(([name, stats]) => ({
            buildingName: name, total: stats.total, occupied: stats.occupied,
            occupancyRate: stats.total > 0 ? Math.round((stats.occupied / stats.total) * 1000) / 10 : 0,
          })),
          total: properties.length,
          exportTime: new Date().toISOString(),
        },
      });
    } else {
      // Excel 导出 — 使用 exceljs 在后端生成 xlsx
      try {
        const ExcelJS: any = await import('exceljs');
        const workbook = new ExcelJS.Workbook();
        workbook.creator = '物业租赁综合管理系统';

        // Sheet 1: 房态明细
        const sheet1 = workbook.addWorksheet('房态明细');
        sheet1.columns = [
          { header: '房号', key: 'roomNumber', width: 12 },
          { header: '楼栋', key: 'buildingName', width: 10 },
          { header: '楼层', key: 'floor', width: 8 },
          { header: '状态', key: 'status', width: 10 },
          { header: '面积(㎡)', key: 'area', width: 10 },
          { header: '租客', key: 'tenantName', width: 14 },
          { header: '合同到期日', key: 'contractEndDate', width: 14 },
          { header: '月租金', key: 'rentAmount', width: 12 },
          { header: '门锁', key: 'lockStatus', width: 12 },
        ];
        // 设置表头样式
        const headerStyle = { font: { bold: true, color: { argb: 'FFFFFFFF' } }, fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF4472C4' } } };
        sheet1.getRow(1).eachCell((cell: any) => { cell.font = headerStyle.font; cell.fill = headerStyle.fill; });

        properties.forEach(p => {
          sheet1.addRow({
            roomNumber: (p as any).roomNumber || '',
            buildingName: (p as any).buildingName || '',
            floor: p.floor,
            status: p.status,
            area: Number(p.area),
            tenantName: contractMap[p.id]?.tenantName || '-',
            contractEndDate: contractMap[p.id]?.contractEndDate ? String(contractMap[p.id].contractEndDate) : '-',
            rentAmount: contractMap[p.id]?.rentAmount || '-',
            lockStatus: lockMap[p.id] || '-',
          });
        });

        // Sheet 2: 楼栋汇总
        const sheet2 = workbook.addWorksheet('楼栋汇总');
        sheet2.columns = [
          { header: '楼栋', key: 'buildingName', width: 15 },
          { header: '总套数', key: 'total', width: 10 },
          { header: '已出租', key: 'occupied', width: 10 },
          { header: '空置', key: 'vacant', width: 10 },
          { header: '入住率', key: 'occupancyRate', width: 12 },
        ];
        sheet2.getRow(1).eachCell((cell: any) => { cell.font = headerStyle.font; cell.fill = headerStyle.fill; });

        const bStats: Record<string, any> = {};
        properties.forEach(p => {
          const bn = (p as any).buildingName || '未分组';
          if (!bStats[bn]) bStats[bn] = { total: 0, occupied: 0, vacant: 0 };
          bStats[bn].total++;
          if (p.status === '已出租') bStats[bn].occupied++;
          if (p.status === '空置') bStats[bn].vacant++;
        });
        for (const [name, stats] of Object.entries(bStats)) {
          sheet2.addRow({
            buildingName: name, total: stats.total, occupied: stats.occupied, vacant: stats.vacant,
            occupancyRate: stats.total > 0 ? `${Math.round((stats.occupied / stats.total) * 1000) / 10}%` : '0%',
          });
        }

        // Sheet 3: 状态分布
        const sheet3 = workbook.addWorksheet('状态分布');
        const statusCols = ROOM_STATUSES.map(s => ({ header: s, key: s, width: 12 }));
        sheet3.columns = [{ header: '楼栋', key: 'buildingName', width: 15 }, ...statusCols];
        sheet3.getRow(1).eachCell((cell: any) => { cell.font = headerStyle.font; cell.fill = headerStyle.fill; });

        const statusDist: Record<string, Record<string, number>> = {};
        properties.forEach(p => {
          const bn = (p as any).buildingName || '未分组';
          if (!statusDist[bn]) {
            statusDist[bn] = {};
            ROOM_STATUSES.forEach(s => { statusDist[bn][s] = 0; });
          }
          statusDist[bn][p.status]++;
        });
        for (const [name, dist] of Object.entries(statusDist)) {
          sheet3.addRow({ buildingName: name, ...dist });
        }

        const buffer = await workbook.xlsx.writeBuffer();
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=房态报表_${new Date().toISOString().slice(0, 10)}.xlsx`);
        res.send(Buffer.from(buffer));
      } catch (e: any) {
        // exceljs 未安装时降级返回 JSON 数据给前端处理
        res.json({ code: 200, data: { type: 'xlsx_fallback', message: '请在前端使用 xlsx 库导出', properties } });
      }
    }
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

// GET /api/properties/import — 导入模板（必须在 /:id 前面）
// （无此端点，跳过）

// GET /api/properties/rooms/stats — 已在上面定义
// GET /api/properties/rooms/kanban — 已在上面定义

// ==================== 参数路径路由（在固定路径之后） ====================

// GET /api/properties — 房源列表（搜索、筛选、分页）
router.get('/', async (req: AuthRequest, res) => {
  try {
    const { page = 1, pageSize = 20, keyword, type, status, buildingName, roomNumber } = req.query;
    const where: any = {};
    if (keyword) {
      where[Op.or] = [
        { name: { [Op.like]: `%${keyword}%` } },
        { address: { [Op.like]: `%${keyword}%` } },
      ];
    }
    if (type) where.type = type;
    if (status) where.status = status;
    if (buildingName) where.buildingName = buildingName;
    if (roomNumber) where.roomNumber = { [Op.like]: `%${roomNumber}%` };

    const { count, rows } = await Property.findAndCountAll({
      where,
      limit: Number(pageSize),
      offset: (Number(page) - 1) * Number(pageSize),
      order: [['buildingOrder', 'ASC'], ['floorOrder', 'ASC'], ['roomNumber', 'ASC']],
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
        buildingName: row['楼栋'] || row['buildingName'] || '',
        roomNumber: row['房号'] || row['roomNumber'] || '',
        buildingOrder: Number(row['楼栋排序'] || row['buildingOrder'] || 0),
        floorOrder: Number(row['楼层排序'] || row['floorOrder'] || 0),
        subType: row['子类型'] || row['subType'] || '',
        owner: row['业主'] || row['owner'] || '',
        status: '空置',
        amenities: {},
        notes: '',
      } as any);
      imported++;
    }

    res.json({ code: 200, data: { imported }, message: `成功导入${imported}条房源` });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

// GET /api/properties/:id/status-logs — 房源状态变更历史
router.get('/:id/status-logs', async (req: AuthRequest, res) => {
  try {
    const logs = await RoomStatusLog.findAll({
      where: { propertyId: req.params.id },
      order: [['createdAt', 'DESC']],
      limit: 50,
    });
    res.json({ code: 200, data: logs });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

// GET /api/properties/:id — 房源详情
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const property = await Property.findByPk(req.params.id);
    if (!property) return res.status(404).json({ code: 404, message: '房源不存在' });

    // 获取可流转的目标状态
    const validTransitions = getValidTransitions(property.status);

    res.json({ code: 200, data: { ...property.toJSON(), validTransitions } });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

// PUT /api/properties/:id — 更新房源
router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const property = await Property.findByPk(req.params.id);
    if (!property) return res.status(404).json({ code: 404, message: '房源不存在' });

    // 如果请求中包含 status 变更，走状态机验证
    if (req.body.status && req.body.status !== property.status) {
      await transitionRoomStatus(property.id, req.body.status, (req as any).user?.userId || 1, {
        action: 'manual',
        notes: req.body.statusNotes || '手动更新房源状态',
      });
      // 更新其他字段
      const { status, statusNotes, ...otherFields } = req.body;
      if (Object.keys(otherFields).length > 0) {
        await property.update(otherFields);
      }
    } else {
      await property.update(req.body);
    }

    // 重新获取更新后的数据
    const updated = await Property.findByPk(req.params.id);
    res.json({ code: 200, data: updated, message: '房源更新成功' });
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

// PATCH /api/properties/:id/status — 状态转换（使用状态机）
router.patch('/:id/status', async (req: AuthRequest, res) => {
  try {
    const { status, notes } = req.body;
    if (!ROOM_STATUSES.includes(status)) {
      return res.status(400).json({ code: 400, message: `无效的房源状态，有效值: ${ROOM_STATUSES.join('、')}` });
    }

    const { property, oldStatus } = await transitionRoomStatus(
      Number(req.params.id),
      status,
      (req as any).user?.userId || 1,
      { action: 'manual', notes: notes || '手动状态变更' }
    );

    res.json({
      code: 200,
      data: { property, oldStatus, newStatus: status },
      message: `状态已从"${oldStatus}"更新为"${status}"`,
    });
  } catch (err: any) {
    res.status(400).json({ code: 400, message: err.message });
  }
});

export default router;
