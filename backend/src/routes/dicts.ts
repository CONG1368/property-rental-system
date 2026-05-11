import { Router } from 'express';
import DictType from '../models/DictType';
import DictItem from '../models/DictItem';
import { AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/types', async (req: AuthRequest, res) => {
  try {
    const types = await DictType.findAll({ order: [['code', 'ASC']] });
    res.json({ code: 200, data: { list: types } });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

router.get('/items', async (req: AuthRequest, res) => {
  try {
    const { typeCode } = req.query;
    const where: any = {};
    if (typeCode) where.typeCode = typeCode;
    const items = await DictItem.findAll({ where, order: [['sortOrder', 'ASC']] });
    res.json({ code: 200, data: { list: items } });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

export default router;
