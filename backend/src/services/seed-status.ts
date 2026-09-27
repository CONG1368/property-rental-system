import { Op } from 'sequelize';
import SystemConfig from '../models/SystemConfig.js';
import Contract from '../models/Contract.js';
import Property from '../models/Property.js';

/**
 * 演示数据「是否生成」+「一次性初始化」状态管理。
 *
 * 背景（踩坑记录）：seedAllDemoData() 过去只靠「是否存在 CT-2024-001」判断是否已初始化，
 * 一旦用户删除了任意演示合同，重启后整套演示经营数据就会被重新生成 —— 表现为
 * 「删掉的种子数据又回来了」。这与 sqlite 无关，是种子入口缺少一个全局已初始化标记。
 *
 * 两个内置布尔项（system_configs）：
 *  - demo_enabled：是否生成演示数据（系统参数中心可改）。=0 时完全不再生成/重建。
 *  - demo_seeded：演示数据是否已初始化（一次性标记，内部使用）。=1 时不再重种。
 *
 * 状态判定（getDemoSeedState）：
 *  - demo_enabled=0 → disabled（完全不跑演示种子）
 *  - 已标记 demo_seeded=1 → already（永不重种）
 *  - 老库（无标记但有演示数据 CT-2024-001/演示房源）→ legacy（补标记并跳过）
 *  - 其余 → run
 */
export const DEMO_SEED_KEY = 'demo_seeded';
export const DEMO_ENABLE_KEY = 'demo_enabled';

export type DemoSeedState = 'run' | 'already' | 'legacy' | 'disabled';

function normalize(v: unknown): boolean {
  const s = String(v ?? '').trim().toLowerCase();
  return s === '1' || s === 'true' || s === 'yes' || s === 'on' || s === '已初始化' || s === '是';
}

async function readConfig(key: string): Promise<boolean | null> {
  const row = await SystemConfig.findOne({ where: { configKey: key } });
  if (!row) return null;
  return normalize((row as any).configValue);
}

/** 确保存在（幂等）。注意：只建 demo_enabled，不预置 demo_seeded（须真正种完才写）。 */
export async function ensureSeedConfig(): Promise<void> {
  const enableRow = await SystemConfig.findOne({ where: { configKey: DEMO_ENABLE_KEY } });
  if (!enableRow) {
    await SystemConfig.create({
      configKey: DEMO_ENABLE_KEY,
      configValue: '1',
      description: '是否生成演示数据（新装/空库时）；关=0 后不再生成任何演示数据',
      configGroup: '系统',
      valueType: 'boolean',
      isSensitive: false,
      builtIn: true,
    } as any);
  }
}

/** 是否允许生成演示数据：缺省为 true；显式 =0 才视为关闭。 */
export async function isDemoEnabled(): Promise<boolean> {
  const v = await readConfig(DEMO_ENABLE_KEY);
  return v !== false;
}

/** 写入一次性标记（仅当演示数据确实已生成）。 */
export async function markDemoSeeded(): Promise<void> {
  if (!(await isDemoEnabled())) return;
  await SystemConfig.upsert({
    configKey: DEMO_SEED_KEY,
    configValue: '1',
    description: '演示数据是否已初始化（内置，勿改）；=1 时不再重建演示数据',
    configGroup: '系统',
    valueType: 'boolean',
    isSensitive: false,
    builtIn: true,
    extra: { readonly: true },
  } as any);
}

/** 判断这一次启动要不要真正跑演示数据种子。 */
export async function getDemoSeedState(): Promise<DemoSeedState> {
  if (!(await isDemoEnabled())) return 'disabled';

  const flag = await readConfig(DEMO_SEED_KEY);
  // 已显式标记 → 永不重种
  if (flag === true) return 'already';
  if (flag === false) return 'run';

  // 老库迁移：无标记，但有演示数据（合同 CT-2024-001 或演示房源）→ 已初始化，补标记并跳过
  const ct = await Contract.findOne({ where: { contractNo: 'CT-2024-001' } });
  const demoProp = await Property.findOne({ where: { name: { [Op.in]: ['翡翠湾A座201', '科创园区1号厂房', '万象汇商铺1F-08'] } } });
  if (ct || demoProp) {
    await markDemoSeeded();
    return 'legacy';
  }
  return 'run';
}
