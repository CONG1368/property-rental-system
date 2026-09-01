/**
 * Excel 读写工具（基于 exceljs）
 *
 * 为什么不用 xlsx(SheetJS)：npm 上的 xlsx 停更在 0.18.5，原型链污染（GHSA-4r6h-8v6p-xvw6）
 * 与 ReDoS（GHSA-5pgg-2g8v-p4x9）两条 high 告警在 npm 渠道永远修不掉——补丁只在其自有 CDN 发布。
 * 本项目已依赖 exceljs（报表导出在用），故统一到 exceljs，彻底移除 xlsx。
 *
 * **注意：exceljs 只支持 .xlsx（OOXML），不支持 .xls（BIFF 二进制）**。
 * 因此所有上传入口的 fileFilter 已收紧为仅 .xlsx，并给出「另存为 .xlsx」的提示。
 */
import ExcelJS from 'exceljs';

/** 单元格值转成朴素 JS 值：公式取结果，富文本取纯文本，日期保留 Date */
function cellValue(v: any): any {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v;
  if (typeof v === 'object') {
    if ('result' in v) return cellValue((v as any).result);          // 公式单元格
    if ('richText' in v) return (v as any).richText.map((t: any) => t.text).join('');
    if ('text' in v) return (v as any).text;                          // 超链接
    if ('error' in v) return '';
  }
  return v;
}

/**
 * 读取工作簿首个工作表，按「首行表头 → 每行对象」返回，
 * 语义与旧代码里的 XLSX.utils.sheet_to_json 一致，便于原地替换。
 */
export async function readSheetAsObjects(filePath: string): Promise<Record<string, any>[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  const ws = wb.worksheets[0];
  if (!ws) return [];

  const headers: string[] = [];
  const headerRow = ws.getRow(1);
  headerRow.eachCell({ includeEmpty: false }, (cell, col) => {
    headers[col] = String(cellValue(cell.value)).trim();
  });
  if (!headers.some((h) => h)) return [];

  const rows: Record<string, any>[] = [];
  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const obj: Record<string, any> = {};
    let hasValue = false;
    row.eachCell({ includeEmpty: false }, (cell, col) => {
      const key = headers[col];
      if (!key) return;
      const val = cellValue(cell.value);
      if (val !== '' && val !== null && val !== undefined) hasValue = true;
      obj[key] = val;
    });
    if (hasValue) rows.push(obj);
  });
  return rows;
}

export interface SheetSpec {
  name: string;
  rows: Record<string, any>[];
  columns?: string[];   // 不传则取首行对象的键
}

function fillSheet(ws: ExcelJS.Worksheet, spec: SheetSpec): void {
  const cols = spec.columns && spec.columns.length ? spec.columns : Object.keys(spec.rows[0] || {});
  if (!cols.length) return;
  ws.addRow(cols);
  ws.getRow(1).font = { bold: true };
  for (const r of spec.rows) ws.addRow(cols.map((c) => r[c] ?? ''));
  // 简单列宽自适应（表头与前 200 行取最大长度，限制在 10~50）
  cols.forEach((c, i) => {
    let width = String(c).length;
    for (const r of spec.rows.slice(0, 200)) width = Math.max(width, String(r[c] ?? '').length);
    ws.getColumn(i + 1).width = Math.min(50, Math.max(10, width + 2));
  });
}

/** 生成多 Sheet 工作簿的 Buffer（Sheet 名超过 31 字符会被 Excel 拒绝，此处截断） */
export async function buildWorkbookBuffer(sheets: SheetSpec[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  for (const s of sheets) {
    if (!s.rows.length) continue;
    fillSheet(wb.addWorksheet(s.name.slice(0, 31)), s);
  }
  if (!wb.worksheets.length) wb.addWorksheet('空报表');
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** 生成单 Sheet 工作簿并写入磁盘 */
export async function writeWorkbookFile(filePath: string, sheet: SheetSpec): Promise<void> {
  const wb = new ExcelJS.Workbook();
  fillSheet(wb.addWorksheet(sheet.name.slice(0, 31)), sheet);
  await wb.xlsx.writeFile(filePath);
}
