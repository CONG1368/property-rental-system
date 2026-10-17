/**
 * 条款合并（用户 2026-10-17 要求：合同条款模板支持自定义多选）。
 * 多选多个模板时，把各模板的条款并入当前条款列表：**重复的自动跳过**，
 * 已手工编辑过的条款不会被覆盖（只在末尾追加新条款），返回新增条数。
 */
export interface ClauseLike { title?: string; content?: string; sortOrder?: number }

const normKey = (c: ClauseLike) => String(c?.title || '').trim() + '|||' + String(c?.content || '').trim().replace(/\s+/g, ' ');

export interface ClauseItem { title: string; content: string; sortOrder: number }

export function mergeClauses(existing: ClauseLike[], incoming: ClauseLike[]): { list: ClauseItem[]; added: number } {
  const list: ClauseItem[] = (existing || []).map((c) => ({
    title: String(c?.title || ''),
    content: String(c?.content || ''),
    sortOrder: Number(c?.sortOrder || 0),
  }));
  const seen = new Set(list.map(normKey));
  let added = 0;
  for (const c of incoming || []) {
    const title = String(c?.title || '').trim();
    const content = String(c?.content || '').trim();
    if (!title && !content) continue;          // 空条款不入列
    const key = normKey({ title, content });
    if (seen.has(key)) continue;               // 重复条款跳过
    seen.add(key);
    list.push({ title, content, sortOrder: list.length });
    added += 1;
  }
  return { list, added };
}
