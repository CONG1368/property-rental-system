import Contract from '../models/Contract.js';

interface CheckResult {
  name: string;
  passed: boolean;
  detail?: string;
}

export async function runComplianceCheck(contractId: number): Promise<{
  passed: boolean;
  checks: CheckResult[];
}> {
  const contract = await Contract.findByPk(contractId);
  if (!contract) throw new Error('合同不存在');

  const checks: CheckResult[] = [];

  // 检查租期合理性
  checks.push({
    name: '租期检查',
    passed: new Date(contract.endDate) > new Date(contract.startDate),
    detail: '结束日期必须晚于开始日期',
  });

  // 检查租金合理性
  checks.push({
    name: '租金检查',
    passed: Number(contract.rentAmount) > 0,
    detail: '租金必须大于0',
  });

  // 检查押金
  checks.push({
    name: '押金检查',
    passed: Number(contract.depositAmount) >= 0,
    detail: '押金不能为负',
  });

  // 检查租期长度（不超过20年）
  const start = new Date(contract.startDate).getTime();
  const end = new Date(contract.endDate).getTime();
  const years = (end - start) / (365 * 24 * 60 * 60 * 1000);
  checks.push({
    name: '租期上限',
    passed: years <= 20,
    detail: `租期 ${years.toFixed(1)} 年，法定上限 20 年`,
  });

  return {
    passed: checks.every((c) => c.passed),
    checks,
  };
}
