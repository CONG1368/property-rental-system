/**
 * 合同附件上传的公共规则（用户 2026-10-16：附件便捷化第 ⑥⑨⑩ 项）。
 * 允许的类型与后端 multer 的 fileFilter 保持一致（contracts.ts 的 contractUpload）。
 */
export const ATTACHMENT_ACCEPT = '.pdf,.doc,.docx,.jpg,.jpeg,.png,.xls,.xlsx';

const ALLOWED_EXTS = ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png', 'xls', 'xlsx'];

/** 取扩展名（小写、不带点）。 */
export function extOf(name: string): string {
  const m = /\.[A-Za-z0-9]{1,8}$/.exec(String(name || ''));
  return m ? m[0].slice(1).toLowerCase() : '';
}

/** 是否支持上传（与后端一致）。 */
export function isAllowedAttachment(name: string): boolean {
  return ALLOWED_EXTS.includes(extOf(name));
}

/** 把一批文件拆成「可上传」与「被拒绝」两组，便于提示用户。 */
export function splitAllowed<T extends { name: string }>(files: T[]): { allowed: T[]; rejected: string[] } {
  const allowed: T[] = [];
  const rejected: string[] = [];
  for (const f of files || []) {
    if (isAllowedAttachment(f?.name)) allowed.push(f);
    else rejected.push(String(f?.name || ''));
  }
  return { allowed, rejected };
}

/** 附件清单里的展示标题：优先用户自定义标题，其次去掉扩展名的文件名。 */
export function attachmentLabel(a: { title?: string; name?: string } | null | undefined): string {
  const title = String(a?.title || '').trim();
  if (title) return title;
  return String(a?.name || '').replace(/\.[A-Za-z0-9]{1,8}$/, '').trim();
}

/** 附件分组（用户 2026-10-16：第 ⑪ 项——附件可按类分组、排序，打印时按分组列目录）。 */
export const ATTACHMENT_GROUPS = ['证件类', '交接类', '财务类', '消防类', '其他'];

export interface GroupedAttachments<T> { group: string; items: { item: T; index: number }[] }

/**
 * 按分组归类附件（纯函数，保持数组原顺序＝用户自定义排序）。
 * 未分组的一律归到「未分组」并排在最后；同一分组内按原索引升序。
 */
export function groupAttachments<T extends { group?: string }>(list: T[]): GroupedAttachments<T>[] {
  const order: string[] = [];
  const map: Record<string, { item: T; index: number }[]> = {};
  (list || []).forEach((item, index) => {
    const raw = String((item as any)?.group || '').trim();
    const g = raw || '未分组';
    if (!map[g]) { map[g] = []; order.push(g); }
    map[g].push({ item, index });
  });
  // 具名分组按 ATTACHMENT_GROUPS 的顺序排（未列出的自定义分组排在具名之后），「未分组」永远最后
  const rank = (g: string) => (g === '未分组' ? 999 : (ATTACHMENT_GROUPS.indexOf(g) >= 0 ? ATTACHMENT_GROUPS.indexOf(g) : 500));
  return order.sort((x, y) => rank(x) - rank(y)).map((g) => ({ group: g, items: map[g] }));
}

/** 待补材料的进度文案。 */
export function checklistSummary(v: { missing?: number; missingRequired?: number } | null | undefined): string {
  const miss = Number(v?.missing || 0);
  const req = Number(v?.missingRequired || 0);
  if (!miss) return '材料已齐';
  return '还缺 ' + miss + ' 项' + (req > 0 ? '（其中必选 ' + req + ' 项）' : '');
}
