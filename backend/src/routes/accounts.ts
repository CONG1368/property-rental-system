import { Router } from 'express';
import { Op } from 'sequelize';
import ChartOfAccount from '../models/ChartOfAccount.js';
import { AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/', async (req: AuthRequest, res) => {
  try {
    const { bookId, keyword, ids, pageSize } = req.query;
    const where: any = {};
    if (bookId) where.bookId = Number(bookId);

    // 按ID列表查询（逗号分隔）
    if (ids) {
      const idList = (ids as string).split(',').map(Number).filter(n => !isNaN(n));
      if (idList.length > 0) where.id = { [Op.in]: idList };
    }

    // 关键字搜索（科目编码或名称）
    if (keyword) {
      where[Op.or] = [
        { code: { [Op.like]: `%${keyword}%` } },
        { name: { [Op.like]: `%${keyword}%` } },
      ];
    }

    const limit = pageSize ? Number(pageSize) : 200;
    const accounts = await ChartOfAccount.findAll({ where, order: [['code', 'ASC']], limit });
    res.json({ code: 200, data: { list: accounts } });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

router.post('/', async (req: AuthRequest, res) => {
  try {
    const account = await ChartOfAccount.create(req.body);
    res.json({ code: 200, data: account, message: '科目创建成功' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const account = await ChartOfAccount.findByPk(req.params.id);
    if (!account) return res.status(404).json({ code: 404, message: '科目不存在' });
    await account.update(req.body);
    res.json({ code: 200, data: account, message: '科目更新成功' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const account = await ChartOfAccount.findByPk(req.params.id);
    if (!account) return res.status(404).json({ code: 404, message: '科目不存在' });
    await account.destroy();
    res.json({ code: 200, message: '科目已删除' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

export default router;
