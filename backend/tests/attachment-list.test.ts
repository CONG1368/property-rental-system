import { describe, it, expect } from 'vitest';
import { removeAttachment } from '../src/services/attachment-list.js';

/**
 * 附件删除（用户 2026-10-17 要求）：支持按 path 或 index 删除，返回新列表与被删条目。
 */
describe('removeAttachment：按 path / index 删除附件', () => {
  const files = [
    { name: 'a.pdf', path: '/u/a' },
    { name: 'b.png', path: '/u/b' },
    { name: '引用条目', path: '' },
  ];

  it('按 path 删除并返回被删条目（原数组不变）', () => {
    const r = removeAttachment(files, { path: '/u/b' });
    expect(r.removed?.name).toBe('b.png');
    expect(r.list.map((f) => f.name)).toEqual(['a.pdf', '引用条目']);
    expect(files.length).toBe(3);
  });

  it('按 index 删除；越界/找不到返回 null 且列表不变', () => {
    expect(removeAttachment(files, { index: 0 }).removed?.name).toBe('a.pdf');
    expect(removeAttachment(files, { index: 9 }).removed).toBeNull();
    expect(removeAttachment(files, { index: 9 }).list.length).toBe(3);
    expect(removeAttachment(files, { path: '/nope' }).removed).toBeNull();
  });

  it('空列表 / 非法入参安全返回', () => {
    expect(removeAttachment([], { path: '/u/a' }).removed).toBeNull();
    expect(removeAttachment(null as any, { index: 0 }).list).toEqual([]);
  });
});
