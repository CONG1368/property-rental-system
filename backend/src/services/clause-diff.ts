/**
 * 合同条款比对（用户 2026-10-11 要求）：
 * 租户把改过的合同回传后，上传即可自动拆条、与合同现有条款比对，明确告诉用户「改了哪些内容」，
 * 方便逐条查看与采纳。纯函数、无 IO，可单测。
 */

export interface ClauseItem { title: string; content: string; sortOrder: number }
export type ClauseStatus = 'unchanged' | 'modified' | 'added' | 'removed';
export interface ClauseFragment { type: 'same' | 'add' | 'remove'; text: string }
export interface ClauseDiffItem {
  index: number;                 // 在新条款列表中的位置（1 起；removed 为 -1）
  status: ClauseStatus;
  oldTitle: string; newTitle: string;
  oldContent: string; newContent: string;
  fragments: ClauseFragment[];   // 正文片段级差异（same/add/remove 相邻同类已合并）
  titleChanged: boolean;
  note: string;                  // 给用户看的一句话说明
}
export interface ClauseDiffResult {
  items: ClauseDiffItem[];
  counts: { added: number; removed: number; modified: number; unchanged: number };
  summary: string;               // 「新增 1 条、修改 2 条、删除 0 条」
  details: string[];             // 逐条提示（只列有变化的）
}

const HEADING_PATTERNS: RegExp[] = [
  /^第[0-9一二三四五六七八九十百零〇两]+[条章节款项]/,
  /^[一二三四五六七八九十]+[、.．]/,
  /^[0-9]+[、.．)）]/,
];

/**
 * 把提取出来的合同正文拆成条款：优先用「第X条」标题，其次中文数字、阿拉伯数字编号，
 * 都没有时按自然段拆（标题留空）。标题保留原文（含用户自己的编号），打印时会原样输出。
 */
export function splitClausesFromText(text: string): ClauseItem[] {
  const raw = String(text || '').replace(/\r\n?/g, '\n');
  const lines = raw.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
  if (lines.length === 0) return [];

  // 上传的多半是整份合同：只取「合同条款」章节范围内的文字，避免把双方信息、金额表、签章区当成条款正文
  let scoped = lines;
  const secStart = lines.findIndex((l) => l.includes('合同条款') && l.length <= 20);
  if (secStart >= 0) {
    let secEnd = lines.length;
    for (let i = secStart + 1; i < lines.length; i++) {
      // 下一个章节标题（一、二、…）即结束；条款标题「第X条」不会命中这个模式
      if (/^[一二三四五六七八九十]+[、.．]/.test(lines[i]) && lines[i].length <= 20) { secEnd = i; break; }
    }
    const region = lines.slice(secStart + 1, secEnd);
    if (region.length > 0) scoped = region;
  }

  const headingRe = HEADING_PATTERNS.find((re) => scoped.some((l) => re.test(l)));
  const items: ClauseItem[] = [];

  if (!headingRe) {
    raw.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean).forEach((p) => {
      items.push({ title: '', content: p, sortOrder: items.length });
    });
    return items;
  }

  let cur: ClauseItem | null = null;
  for (const line of scoped) {
    // 标题行一般很短；避免把「第一条…然后一大段正文」的长行误判成标题
    const isHeading = headingRe.test(line) && line.length <= 40;
    if (isHeading) {
      cur = { title: line, content: '', sortOrder: items.length };
      items.push(cur);
    } else if (cur) {
      cur.content += (cur.content ? '\n' : '') + line;
    } else {
      items.push({ title: '', content: line, sortOrder: items.length });
    }
  }
  return items.filter((i) => i.title || i.content);
}

/** 标题比对用归一化：去掉「第X条」等编号前缀、空白与标点 */
export function titleKey(title: string): string {
  return String(title || '')
    .replace(/^第[0-9一二三四五六七八九十百零〇两]+[条章节款项]/, '')
    .replace(/^[一二三四五六七八九十]+[、.．]/, '')
    .replace(/^[0-9]+[、.．)）]/, '')
    .replace(/[（(][0-9一二三四五六七八九十]+[)）]/, '')
    .replace(/[\s　:：、.。，,;；\-_]/g, '')
    .toLowerCase();
}

function bodyKey(text: string): string {
  return String(text || '').replace(/\s+/g, '');
}

/** 句子切分（保留句末标点），用于片段级差异 */
export function splitSentences(text: string): string[] {
  return String(text || '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .flatMap((line) => line.match(/[^。；！？!?;]*[。；！？!?;]?/g) || [])
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** LCS 片段差异：逐句比对，输出 same/add/remove 片段（相邻同类合并，便于前端高亮） */
export function diffFragments(oldText: string, newText: string): ClauseFragment[] {
  const a = splitSentences(oldText);
  const b = splitSentences(newText);
  const n = a.length;
  const m = b.length;
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const out: ClauseFragment[] = [];
  const push = (type: 'same' | 'add' | 'remove', text: string) => {
    if (!text) return;
    const last = out[out.length - 1];
    if (last && last.type === type) last.text += text;
    else out.push({ type, text });
  };
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { push('same', a[i]); i++; j++; }
    else if (lcs[i + 1][j] >= lcs[i][j + 1]) { push('remove', a[i]); i++; }
    else { push('add', b[j]); j++; }
  }
  while (i < n) { push('remove', a[i]); i++; }
  while (j < m) { push('add', b[j]); j++; }
  return out;
}

function similarity(oldText: string, newText: string): number {
  const a = new Set(splitSentences(oldText));
  const b = splitSentences(newText);
  if (a.size === 0 && b.length === 0) return 1;
  const common = b.filter((s) => a.has(s)).length;
  return common / Math.max(a.size, b.length, 1);
}

/**
 * 比对两批条款：
 * 1) 标题（去编号后）一致 → 同一条；
 * 2) 正文句子重合度 ≥ 50% → 同一条被改过（标题可能也改了）；
 * 3) 剩下没配上的新条款 = 新增，没配上的旧条款 = 删除。
 */
export function diffClauseLists(oldList: ClauseItem[], newList: ClauseItem[]): ClauseDiffResult {
  const oldItems = (oldList || []).map((c) => ({ title: c.title || '', content: c.content || '' }));
  const newItems = (newList || []).map((c) => ({ title: c.title || '', content: c.content || '' }));
  const usedOld = new Set<number>();
  const pairs: { newIdx: number; oldIdx: number; status: 'added' | 'removed' | 'paired' }[] = [];

  newItems.forEach((nw, nIdx) => {
    const key = titleKey(nw.title);
    if (!key) return;
    const oIdx = oldItems.findIndex((o, i) => !usedOld.has(i) && titleKey(o.title) === key);
    if (oIdx >= 0) { usedOld.add(oIdx); pairs.push({ newIdx: nIdx, oldIdx: oIdx, status: 'paired' }); }
  });

  newItems.forEach((nw, nIdx) => {
    if (pairs.some((p) => p.newIdx === nIdx)) return;
    let best = -1;
    let bestScore = 0;
    oldItems.forEach((o, oIdx) => {
      if (usedOld.has(oIdx)) return;
      const s = similarity(o.content, nw.content);
      if (s > bestScore) { bestScore = s; best = oIdx; }
    });
    if (best >= 0 && bestScore >= 0.5) {
      usedOld.add(best);
      pairs.push({ newIdx: nIdx, oldIdx: best, status: 'paired' });
    } else {
      pairs.push({ newIdx: nIdx, oldIdx: -1, status: 'added' });
    }
  });

  oldItems.forEach((_o, oIdx) => {
    if (!usedOld.has(oIdx)) pairs.push({ newIdx: -1, oldIdx: oIdx, status: 'removed' });
  });

  const items: ClauseDiffItem[] = pairs.map((p) => {
    const o = p.oldIdx >= 0 ? oldItems[p.oldIdx] : { title: '', content: '' };
    const nw = p.newIdx >= 0 ? newItems[p.newIdx] : { title: '', content: '' };
    const index = p.newIdx >= 0 ? p.newIdx + 1 : -1;
    if (p.status === 'added') {
      return { index, status: 'added' as ClauseStatus, oldTitle: '', newTitle: nw.title, oldContent: '', newContent: nw.content, fragments: [], titleChanged: false, note: `新增条款「${nw.title || '(无标题)'}」` };
    }
    if (p.status === 'removed') {
      return { index, status: 'removed' as ClauseStatus, oldTitle: o.title, newTitle: '', oldContent: o.content, newContent: '', fragments: [], titleChanged: false, note: `删除条款「${o.title || '(无标题)'}」` };
    }
    const fragments = diffFragments(o.content, nw.content);
    const titleChanged = o.title !== nw.title;
    const contentChanged = bodyKey(o.content) !== bodyKey(nw.content);
    const addCount = splitSentences(nw.content).filter((s) => !new Set(splitSentences(o.content)).has(s)).length;
    const removeCount = splitSentences(o.content).filter((s) => !new Set(splitSentences(nw.content)).has(s)).length;
    const parts: string[] = [];
    if (titleChanged) parts.push(`标题由「${o.title || '(无标题)'}」改为「${nw.title || '(无标题)'}」`);
    if (contentChanged) parts.push(`正文有改动（新增 ${addCount} 句、删除 ${removeCount} 句）`);
    const status: ClauseStatus = titleChanged || contentChanged ? 'modified' : 'unchanged';
    return {
      index, status, oldTitle: o.title, newTitle: nw.title, oldContent: o.content, newContent: nw.content,
      fragments, titleChanged, note: status === 'modified' ? `${nw.title || o.title || '(无标题)'}：${parts.join('；')}` : '',
    };
  });

  items.sort((a, b) => {
    const ai = a.status === 'removed' ? Number.MAX_SAFE_INTEGER : a.index;
    const bi = b.status === 'removed' ? Number.MAX_SAFE_INTEGER : b.index;
    return ai - bi;
  });

  const counts = {
    added: items.filter((i) => i.status === 'added').length,
    removed: items.filter((i) => i.status === 'removed').length,
    modified: items.filter((i) => i.status === 'modified').length,
    unchanged: items.filter((i) => i.status === 'unchanged').length,
  };
  const summaryParts: string[] = [];
  if (counts.added) summaryParts.push(`新增 ${counts.added} 条`);
  if (counts.modified) summaryParts.push(`修改 ${counts.modified} 条`);
  if (counts.removed) summaryParts.push(`删除 ${counts.removed} 条`);
  return {
    items,
    counts,
    summary: summaryParts.length > 0 ? summaryParts.join('、') : '未检测到条款变化',
    details: items.filter((i) => i.note).map((i) => i.note),
  };
}
