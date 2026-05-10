import { Router } from 'express';
import { AuthRequest } from '../middleware/auth';
import Property from '../models/Property';
import Tenant from '../models/Tenant';
import Contract from '../models/Contract';
import Bill from '../models/Bill';
import { Op } from 'sequelize';

const router = Router();

// GET /api/dashboard/rent — 收租看板数据
router.get('/rent', async (req: AuthRequest, res) => {
  try {
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const totalProperties = await Property.count({ where: { status: '已出租' } });
    const totalContracts = await Contract.count({ where: { status: '执行中' } });

    const monthBills = await Bill.findAll({
      where: { period: thisMonth },
      attributes: ['status', 'totalAmount'],
      raw: true,
    });

    const monthlyDue = monthBills.reduce((sum, b) => sum + Number(b.totalAmount), 0);
    const monthlyCollected = monthBills
      .filter((b) => b.status === '已缴')
      .reduce((sum, b) => sum + Number(b.totalAmount), 0);
    const arrearsCount = monthBills.filter((b) => b.status === '逾期').length;
    const overdueCount = monthBills.filter((b) => b.status === '逾期' || b.status === '部分缴').length;
    const collectionRate = monthBills.length > 0
      ? ((monthBills.filter((b) => b.status === '已缴').length / monthBills.length) * 100).toFixed(1)
      : '0';
    const overdueRate = monthBills.length > 0
      ? ((overdueCount / monthBills.length) * 100).toFixed(1)
      : '0';

    res.json({
      code: 200,
      data: {
        collectionRate: parseFloat(collectionRate),
        overdueRate: parseFloat(overdueRate),
        monthlyDue,
        monthlyCollected,
        arrearsCount,
        totalProperties,
        totalContracts,
      },
    });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

// GET /api/dashboard/finance — 财务看板数据
router.get('/finance', async (req: AuthRequest, res) => {
  res.json({
    code: 200,
    data: {
      totalRevenue: 0,
      totalExpense: 0,
      netProfit: 0,
      profitMargin: 0,
      taxRate: 0,
    },
  });
});

// GET /api/dashboard/contracts — 合同看板数据
router.get('/contracts', async (req: AuthRequest, res) => {
  try {
    const totalContracts = await Contract.count();
    const activeContracts = await Contract.count({ where: { status: '执行中' } });
    const expiringThisMonth = await Contract.count({
      where: {
        status: '执行中',
        endDate: {
          [Op.between]: [new Date(), new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)],
        } as any,
      },
    });

    res.json({
      code: 200,
      data: {
        totalContracts,
        activeRate: totalContracts > 0 ? parseFloat(((activeContracts / totalContracts) * 100).toFixed(1)) : 0,
        avgApprovalDays: 2.1,
        renewalRate: 78.5,
        expiringThisMonth,
      },
    });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

export default router;
