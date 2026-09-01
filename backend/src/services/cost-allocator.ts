import Property from '../models/Property.js';
import { Op } from 'sequelize';

/**
 * 公共费用分摊
 * @param totalCost 总费用
 * @param rule 分摊规则: 'area'(按面积) | 'equal'(均分) | 'custom'
 * @returns 每个房源应分摊的金额 { propertyId: amount }
 */
export async function allocateCost(
  totalCost: number,
  rule: 'area' | 'equal' | 'custom' = 'area',
  propertyIds?: number[]
): Promise<{ propertyId: number; amount: number }[]> {
  const where: any = propertyIds && propertyIds.length
    ? { id: { [Op.in]: propertyIds } }
    : { status: '已出租' };
  const properties = await Property.findAll({
    where,
    attributes: ['id', 'area'],
  });

  if (properties.length === 0) return [];

  if (rule === 'equal') {
    const perUnit = totalCost / properties.length;
    return properties.map((p: any) => ({
      propertyId: p.id,
      amount: Math.round(perUnit * 100) / 100,
    }));
  }

  // 按面积分摊
  const totalArea = properties.reduce((sum: number, p: any) => sum + Number(p.area), 0);
  return properties.map((p: any) => ({
    propertyId: p.id,
    amount: Math.round((Number(p.area) / totalArea) * totalCost * 100) / 100,
  }));
}
