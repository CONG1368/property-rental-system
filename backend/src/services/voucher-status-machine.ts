// 凭证状态机：定义合法流转，防止任意跳转（如草稿直接过账、已过账回退）
// 状态：草稿 → 待复核 → 待审核 → 已过账 → 已作废（终态）
export type VoucherStatus = '草稿' | '待复核' | '待审核' | '已过账' | '已作废';

export const VOUCHER_STATUSES: VoucherStatus[] = ['草稿', '待复核', '待审核', '已过账', '已作废'];

// 合法流转表：key=当前状态，value=允许目标状态集合
const TRANSITIONS: Record<VoucherStatus, VoucherStatus[]> = {
  '草稿': ['待复核'],       // 提交
  '待复核': ['草稿', '待审核'], // 退回修正 / 复核通过
  '待审核': ['待复核', '已过账'], // 退回复核 / 审核过账
  '已过账': ['已作废'],      // 只能作废（不可回退，防篡改已过账凭证）
  '已作废': [],             // 终态
};

export interface TransitionResult { ok: boolean; reason?: string; }

export function canTransition(from: VoucherStatus | undefined, to: VoucherStatus): TransitionResult {
  if (!from) return { ok: true }; // 新建无状态限制
  if (!VOUCHER_STATUSES.includes(to)) return { ok: false, reason: '无效凭证状态' };
  const allowed = TRANSITIONS[from as VoucherStatus] || [];
  if (!allowed.includes(to)) {
    return { ok: false, reason: '非法的状态流转：' + from + ' → ' + to };
  }
  return { ok: true };
}
