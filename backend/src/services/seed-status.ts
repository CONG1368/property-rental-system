import { Op } from 'sequelize';
import SystemConfig from '../models/SystemConfig.js';
import Contract from '../models/Contract.js';
import Property from '../models/Property.js';

/**
 * 演示数据「一次性初始化」状态管理。
 *
 * 背景（踩坑记录）：seedAllDemoData() 过去只靠「是否存在 CT-2024-001」判断是否已初始化，
 * 一旦用户删除了任意演示合同，重启后整套演示经营数据就会被重新生成 —— 表现为
 * 「删掉的种子数据又回来了」。这与 sqlite 无关，是种子入口缺少一个全局已初始化标记。
 *
 * 方案：在 system_configs 表写入内置布尔项 demo_seeded。
 *  - 全新数据库：无标记、也无演示数据 → 正常执行种子。
 *  - 老数据库（已初始化但无标记，CT-2024-001 存在）→ 首次启动补写标记并跳过重种。
 *  - 已初始化且带标记 → 彻底跳过，删掉任何演示数据都不再复活。
 */
export const DEMO_SEED_KEY = 'demo_seeded';

export type DemoSeedState = 'run' | 'already' | 'legacy';

function normalize(v: unknown): boolean {
  const s = String(v ?? '').trim().toLowerCase();
  return s === '1' || s === 'true' || s === 'yes' || s === 'on' || s === '已初始化';
}

async function readFlag(): Promise<boolean | null> {
  const row = await SystemConfig.findOne({ where: { configKey: DEMO_SEED_KEY } });
  if (!row) return null;
  return normalize((row as any).configValue);
}

/** 确保配置项存在（幂等），供系统参数中心展示。 */
export async function ensureSeedConfig(): Promise<void> {
  const row = await SystemConfig.findOne({ where: { configKey: DEMO_SEED_KEY } });
  if (!row) {
    await SystemConfig.create({
      configKey: DEMO_SEED_KEY,
      configValue: '1',
      description: '演示数据是否已初始化（内置，勿删）；=1 时不再重建演示数据',
      configGroup: '系统',
      valueType: 'boolean',
      isSensitive: false,
      builtIn: true,
      extra: { readonly: true },
    } as any);
  }
}

/** 判断这一次启动要不要真正跑演示数据种子。 */
export async function getDemoSeedState(): Promise<DemoSeedState> {
  const flag = await readFlag();
  // 已显式标记 → 永不重种
  if (flag === true) return 'already';
  if (flag === false) return 'run';

  // 老库迁移：无标记，但有演示数据（合同 CT-2024-001 或演示房源）→ 已初始化，补标记并跳过
  const ct = await Contract.findOne({ where: { contractNo: 'CT-2024-001' } });
  const demoProp = await Property.findOne({ where: { name: { [Op.in]: ['翡翠湾A座201', '科创园区1号厂房', '万象汇商铺1F-08'] } } });
  if (ct || demoProp) {
    await ensureSeedConfig();
    return 'legacy';
  }
  return 'run';
}

/** 种子成功执行完毕后调用，写入一次性标记。 */
export async function markDemoSeeded(): Promise<void> {
  await ensureSeedConfig();
}
