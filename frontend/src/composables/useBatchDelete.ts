// 列表页通用「批量删除」：二次确认 + 逐条删除 + 汇总提示 + 回调刷新。
// 各列表页原先把这段复制了多份，此处收口为一处。
import { ElMessage, ElMessageBox } from 'element-plus';

export function useBatchDelete(opts: {
  /** 单条删除 */
  remove: (row: any) => Promise<any>;
  /** 行标签（用于跳过提示） */
  label: (row: any) => string;
  /** 称呼，如「租客」「账单」 */
  noun: string;
  /** 删除完成后的刷新 */
  onDone: () => void;
}) {
  return async function batchDelete(rows: any[]) {
    const n = rows.length;
    if (!n) return;
    try { await ElMessageBox.confirm('确定批量删除 ' + n + ' 个' + opts.noun + '? 此操作不可恢复!', '批量删除', { type: 'warning' }); } catch { return; }
    let done = 0; const skipped: string[] = [];
    for (const row of rows) {
      try { await opts.remove(row); done++; } catch { skipped.push(opts.label(row) + ': 删除失败'); }
    }
    if (skipped.length) ElMessage.warning('成功删除 ' + done + ' 个，跳过 ' + skipped.length + ' 个\n' + skipped.slice(0, 5).join('；'));
    else ElMessage.success('已删除 ' + done + ' 个' + opts.noun);
    opts.onDone();
  };
}
