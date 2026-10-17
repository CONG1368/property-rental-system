/**
 * 附件列表操作（用户 2026-10-17 要求：上传后的附件要能删除）。
 * 纯函数便于单测：按 path 或 index 定位要删的条目，返回新列表与被删条目（用于删磁盘文件）。
 */
export interface AttachmentItemLike { name?: string; path?: string; title?: string; size?: number }

export function removeAttachment(
  files: AttachmentItemLike[],
  target: { path?: string; index?: number },
): { list: AttachmentItemLike[]; removed: AttachmentItemLike | null } {
  const list = Array.isArray(files) ? [...files] : [];
  let idx = -1;
  if (target && typeof target.path === 'string' && target.path !== '') {
    idx = list.findIndex((f) => String(f?.path || '') === target.path);
  } else if (target && Number.isInteger(target.index)) {
    idx = Number(target.index);
  }
  if (idx < 0 || idx >= list.length) return { list, removed: null };
  const removed = list[idx];
  list.splice(idx, 1);
  return { list, removed };
}
