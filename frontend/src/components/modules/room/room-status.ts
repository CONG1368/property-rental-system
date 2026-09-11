// 房态（9 种）→ 视觉语义映射。
// 业务词汇只允许出现在 modules/ 层；base/ 的 StatusTag / DataTable 只渲染调用方传入的配置。
// 配色落点在 styles/global.scss 的 .room-chip--*（已纳入 check-contrast.cjs 门禁）。
import type { StatusTagItem } from '@/components/base/types';

/** 生命周期顺序：前四档蓝色强度递增表达「填充度」，末几项为过渡 / 异常态 */
export const ROOM_STATUSES = ['空置', '已锁定', '已预订', '已出租', '退租中', '待保洁', '待验收', '维修中', '已冻结'];

/** 房态 → 色调键（对应 .room-chip--<tone>） */
const ROOM_STATUS_TONE: Record<string, string> = {
  '空置': 'vacant',
  '已锁定': 'locked',
  '已预订': 'booked',
  '已出租': 'rented',
  '退租中': 'ending',
  '待保洁': 'cleaning',
  '待验收': 'inspecting',
  '维修中': 'maintenance',
  '已冻结': 'frozen',
};

/** 未知房态回落到中性（不冒充某种业务状态） */
const FALLBACK_TONE = 'frozen';

/** 房态 chip 的 class（令牌驱动，见 docs/UI设计准则.md 3.4） */
export function roomStatusClass(status?: string | null): string {
  const tone = ROOM_STATUS_TONE[String(status ?? '')] || FALLBACK_TONE;
  return 'room-chip room-chip--' + tone;
}

/** 供 DataTable 的 status 列 / StatusTag 使用 */
export const ROOM_STATUS_MAP: Record<string, StatusTagItem> = ROOM_STATUSES.reduce<Record<string, StatusTagItem>>((acc, s) => {
  acc[s] = { label: s, className: roomStatusClass(s) };
  return acc;
}, {});
