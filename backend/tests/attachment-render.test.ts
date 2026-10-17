import { describe, it, expect } from 'vitest';
import { textToHtml, rowsToTableHtml } from '../src/services/attachment-render.js';

/**
 * 附件正文转换（用户 2026-10-17 要求：Word/Excel 附件的正文也要打印在合同后面）。
 * 这里只测纯函数部分；mammoth/word-extractor/exceljs 的实际解析由端到端验证覆盖。
 */
describe('textToHtml：纯文本转段落（.doc 走这条路）', () => {
  it('按行拆段、跳过空行、转义 HTML 特殊字符', () => {
    const html = textToHtml('第一段\n\n第二段 <b>不是标签</b>\r\n第三段');
    expect(html.split('\n').length).toBe(3);
    expect(html).toContain('第一段');
    expect(html).toContain('&lt;b&gt;不是标签&lt;/b&gt;');
    expect(html).not.toContain('<b>不是标签</b>');
    expect(html).toContain('第三段');
  });

  it('空文本返回空串', () => {
    expect(textToHtml('')).toBe('');
    expect(textToHtml('   \n  \n')).toBe('');
  });
});

describe('rowsToTableHtml：工作表转表格（.xlsx 走这条路）', () => {
  it('首行当表头、跳过全空行、带工作表名', () => {
    const html = rowsToTableHtml([['项目', '金额'], ['水费', 100], ['', ''], ['电费', 200]], '1月账单');
    expect(html).toContain('1月账单');
    expect(html).toContain('<th');
    expect(html).toContain('项目');
    expect(html).toContain('水费');
    expect(html).toContain('电费');
    // 全空行被跳过：只有表头 + 2 行数据
    expect((html.match(/<tr>/g) || []).length).toBe(3);
  });

  it('空数据返回空串；内容转义', () => {
    expect(rowsToTableHtml([], 'x')).toBe('');
    expect(rowsToTableHtml([['<script>']], 'x')).toContain('&lt;script&gt;');
  });
});
