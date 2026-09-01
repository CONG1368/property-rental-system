/**
 * 前端 Excel 工具（基于 exceljs）
 *
 * 替换 xlsx(SheetJS)：npm 版停更在 0.18.5，两条 high 告警（原型链污染 / ReDoS）在 npm 渠道无补丁。
 * 与后端 backend/src/utils/excel.ts 保持同一套语义，便于前后端解析结果一致。
 *
 * 注意：exceljs 只支持 .xlsx（OOXML），不支持旧版 .xls（BIFF）。
 */
import ExcelJS from 'exceljs';

function cellValue(v: any): any {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v;
  if (typeof v === 'object') {
    if ('result' in v) return cellValue(v.result);
    if ('richText' in v) return v.richText.map((t: any) => t.text).join('');
    if ('text' in v) return v.text;
    if ('error' in v) return '';
  }
  return v;
}

/** 读取首个工作表 → 首行表头 → 每行对象（等价于旧代码的 sheet_to_json） */
export async function readSheetAsObjects(data: ArrayBuffer): Promise<Record<string, any>[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(data);
  const ws = wb.worksheets[0];
  if (!ws) return [];

  const headers: string[] = [];
  ws.getRow(1).eachCell({ includeEmpty: false }, (cell, col) => {
    headers[col] = String(cellValue(cell.value)).trim();
  });

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

/** 从 File 直接读取 */
export async function readFileAsObjects(file: File): Promise<Record<string, any>[]> {
  return readSheetAsObjects(await file.arrayBuffer());
}

export interface SheetSpec {
  name: string;
  rows: Record<string, any>[];
  columns?: string[];
}

/** 生成工作簿 Blob（多 Sheet；Sheet 名超 31 字符会被 Excel 拒绝，此处截断） */
export async function buildWorkbookBlob(sheets: SheetSpec[]): Promise<Blob> {
  const wb = new ExcelJS.Workbook();
  for (const s of sheets) {
    if (!s.rows?.length) continue;
    const ws = wb.addWorksheet(s.name.slice(0, 31));
    const cols = s.columns?.length ? s.columns : Object.keys(s.rows[0] || {});
    if (!cols.length) continue;
    ws.addRow(cols);
    ws.getRow(1).font = { bold: true };
    for (const r of s.rows) ws.addRow(cols.map((c) => r[c] ?? ''));
    cols.forEach((c, i) => {
      let width = String(c).length;
      for (const r of s.rows.slice(0, 200)) width = Math.max(width, String(r[c] ?? '').length);
      ws.getColumn(i + 1).width = Math.min(50, Math.max(10, width + 2));
    });
  }
  if (!wb.worksheets.length) wb.addWorksheet('空表');
  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

/** 生成并触发浏览器下载 */
export async function downloadWorkbook(sheets: SheetSpec[], filename: string): Promise<void> {
  const blob = await buildWorkbookBlob(sheets);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.xlsx') ? filename : filename + '.xlsx';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
