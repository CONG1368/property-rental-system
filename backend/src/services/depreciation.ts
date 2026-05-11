import FixedAsset from '../models/FixedAsset.js';

export async function runMonthlyDepreciation(): Promise<number> {
  const assets = await FixedAsset.findAll({
    where: { status: '使用中' },
  });

  let processed = 0;
  for (const asset of assets) {
    const monthly = Number(asset.monthlyDepreciation) || 0;
    if (monthly === 0) {
      // 计算月折旧额
      const original = Number(asset.originalValue);
      const residual = Number(asset.residualValue);
      const months = asset.usefulMonths;
      const calcMonthly = months > 0 ? Math.round((original - residual) / months * 100) / 100 : 0;
      await asset.update({ monthlyDepreciation: calcMonthly });
    }
    const acc = Number(asset.accumulatedDepreciation) + (Number(asset.monthlyDepreciation) || 0);
    const original = Number(asset.originalValue);
    const newStatus = acc >= original - Number(asset.residualValue) ? '已折旧完毕' : '使用中';
    await asset.update({
      accumulatedDepreciation: Math.round(acc * 100) / 100,
      status: newStatus,
    });
    processed++;
  }

  console.log(`[Depreciation] Processed ${processed} assets`);
  return processed;
}
