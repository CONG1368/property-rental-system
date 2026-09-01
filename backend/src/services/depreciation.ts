import FixedAsset from '../models/FixedAsset.js';

/** 当前期间 YYYY-MM */
function currentPeriod(d = new Date()): string {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

/**
 * 月度折旧计提。
 *
 * **幂等保证（重要）**：折旧是累加操作，同一期间跑第二次会导致重复计提、账面价值被多扣。
 * 因此以 `lastDepreciationPeriod` 作为期间水位线——本期已计提的资产直接跳过。
 * 定时任务与「系统运维」页的手动触发共用本函数，重复点击不会造成脏数据。
 *
 * @param period 指定期间（YYYY-MM），默认当前月
 * @returns 本次真正计提的资产数（已跳过的不计入）
 */
export async function runMonthlyDepreciation(period = currentPeriod()): Promise<number> {
  const assets = await FixedAsset.findAll({
    where: { status: '使用中' },
  });

  let processed = 0;
  let skipped = 0;
  for (const asset of assets) {
    // 本期已计提 → 跳过（幂等水位线）
    if (String((asset as any).lastDepreciationPeriod || '') === period) { skipped++; continue; }

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
    const residual = Number(asset.residualValue);
    // 累计折旧不得超过「原值 - 残值」，超出部分截断
    const cap = Math.max(0, original - residual);
    const capped = Math.min(Math.round(acc * 100) / 100, cap);
    const newStatus = capped >= cap ? '已折旧完毕' : '使用中';
    await asset.update({
      accumulatedDepreciation: capped,
      status: newStatus,
      lastDepreciationPeriod: period,
    } as any);
    processed++;
  }

  console.log('[Depreciation] period=' + period + ' processed=' + processed + ' skipped=' + skipped);
  return processed;
}
