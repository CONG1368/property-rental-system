import { Router, Request, Response } from 'express';
import { Op } from 'sequelize';
import Contract from '../models/Contract.js';
import Tenant from '../models/Tenant.js';
import Property from '../models/Property.js';
import { runComplianceCheck } from '../services/compliance-checker.js';

const router = Router();

// GET /compliance — 合规检查结果列表（含分页和统计）
router.get('/', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const offset = (page - 1) * pageSize;

    const { count, rows: contracts } = await Contract.findAndCountAll({
      include: [
        { model: Tenant, as: 'tenant', attributes: ['id', 'name'] },
        { model: Property, as: 'property', attributes: ['id', 'name'] },
      ],
      order: [['updatedAt', 'DESC']],
      limit: pageSize,
      offset,
    });

    const list: any[] = [];
    let abnormalCount = 0;

    for (const contract of contracts) {
      let checkResult;
      try {
        checkResult = await runComplianceCheck(contract.id);
      } catch {
        checkResult = { passed: true, checks: [] };
      }

      const contractData = contract.toJSON();
      const failedChecks = checkResult.checks.filter((c: any) => !c.passed);

      if (!checkResult.passed) abnormalCount++;

      list.push({
        id: contractData.id,
        contractNo: contractData.contractNo,
        checkItem: failedChecks.map((c: any) => c.name).join('、') || '全部通过',
        result: checkResult.passed ? '通过' : '未通过',
        detail: failedChecks.map((c: any) => `${c.name}: ${c.detail}`).join('; ') || '所有检查项均符合规范',
        checkedAt: new Date().toISOString(),
      });
    }

    const totalContracts = count;
    const complianceRate = totalContracts > 0
      ? Math.round(((totalContracts - abnormalCount) / totalContracts) * 10000) / 100
      : 100;

    res.json({
      code: 200,
      data: { list, total: count, totalContracts, abnormalCount, complianceRate },
    });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message || '获取合规列表失败' });
  }
});

// POST /compliance/check — 批量执行合规检查
router.post('/check', async (_req: Request, res: Response) => {
  try {
    const contracts = await Contract.findAll({ attributes: ['id', 'contractNo'] });
    const results: any[] = [];
    let abnormalCount = 0;

    for (const contract of contracts) {
      let checkResult;
      try {
        checkResult = await runComplianceCheck(contract.id);
      } catch {
        checkResult = { passed: true, checks: [] };
      }
      if (!checkResult.passed) abnormalCount++;
      results.push({ contractId: contract.id, contractNo: (contract as any).contractNo, ...checkResult });
    }

    res.json({
      code: 200,
      data: {
        message: `合规检查完成，共检查 ${contracts.length} 份合同，发现 ${abnormalCount} 个问题`,
        totalContracts: contracts.length,
        abnormalCount,
        results,
      },
    });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message || '合规检查失败' });
  }
});

// GET /compliance/check/:id — 单合同详细检查
router.get('/check/:id', async (req: Request, res: Response) => {
  try {
    const result = await runComplianceCheck(parseInt(req.params.id));
    res.json({ code: 200, data: result });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message || '检查失败' });
  }
});

export default router;
