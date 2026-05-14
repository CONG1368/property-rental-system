import * as XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';
import { Op } from 'sequelize';
import Voucher from '../models/Voucher.js';
import VoucherEntry from '../models/VoucherEntry.js';
import ChartOfAccount from '../models/ChartOfAccount.js';
import Bill from '../models/Bill.js';
import Contract from '../models/Contract.js';
import dayjs from 'dayjs';

/**
 * 税务数据导出服务
 * 生成电子税务局所需格式的申报数据（增值税、房产税、土地使用税、印花税、企业所得税）
 */

export interface TaxExportOptions {
  type: 'vat' | 'property-tax' | 'land-tax' | 'stamp-tax' | 'cit';
  period: string; // YYYY-MM 或 YYYY-QQ 或 YYYY
  format: 'excel' | 'csv' | 'xml';
}

/**
 * 导出税务申报数据
 */
export async function exportTaxData(options: TaxExportOptions): Promise<string> {
  switch (options.type) {
    case 'vat': return exportVat(options);
    case 'property-tax': return exportPropertyTax(options);
    case 'land-tax': return exportLandTax(options);
    case 'stamp-tax': return exportStampTax(options);
    case 'cit': return exportCit(options);
    default: throw new Error(`不支持的税种: ${options.type}`);
  }
}

/**
 * 增值税申报导出
 * 包含销项税额、进项税额、应纳税额
 */
async function exportVat(opts: TaxExportOptions): Promise<string> {
  const [year, month] = opts.period.split('-');
  const startOfMonth = dayjs(`${year}-${month}-01`);
  const endOfMonth = startOfMonth.endOf('month');

  // 销项税额：从已开票的租金收入中提取
  const bills = await Bill.findAll({
    where: {
      status: '已缴',
      paidDate: { [Op.between]: [startOfMonth.toDate(), endOfMonth.toDate()] },
    },
    include: [{ model: Contract, as: 'contract' }],
  });

  const outputTax = bills.reduce((sum, b) => sum + Number(b.totalAmount || 0) * 0.09, 0); // 不动产租赁 9%

  // 进项税额：从费用凭证中提取
  const expenseEntries = await VoucherEntry.findAll({
    where: { '$voucher.period$': opts.period },
    include: [{ model: Voucher, as: 'voucher', where: { type: '付' } }],
  });
  const inputTax = expenseEntries.reduce((sum, e) => sum + Number(e.debitAmount || 0), 0) * 0.06;

  const data = [
    { 项目: '销项税额', 金额: outputTax.toFixed(2) },
    { 项目: '进项税额', 金额: inputTax.toFixed(2) },
    { 项目: '应纳税额', 金额: (outputTax - inputTax).toFixed(2) },
  ];

  return writeDataFile(data, opts, `增值税申报_${opts.period}`);
}

/**
 * 房产税申报导出（从租计征：租金收入 × 12%）
 */
async function exportPropertyTax(opts: TaxExportOptions): Promise<string> {
  const [year] = opts.period.split('-');
  const startOfYear = dayjs(`${year}-01-01`);
  const endOfYear = dayjs(`${year}-12-31`);

  const bills = await Bill.findAll({
    where: {
      status: '已缴',
      paidDate: { [Op.between]: [startOfYear.toDate(), endOfYear.toDate()] },
    },
  });

  const totalRent = bills.reduce((s, b) => s + Number(b.totalAmount || 0), 0);
  const taxAmount = totalRent * 0.12;

  const data = [
    { 项目: '租金收入总额', 金额: totalRent.toFixed(2) },
    { 项目: '房产税应纳税额（从租12%）', 金额: taxAmount.toFixed(2) },
  ];

  return writeDataFile(data, opts, `房产税申报_${opts.period}`);
}

/**
 * 城镇土地使用税申报导出
 */
async function exportLandTax(opts: TaxExportOptions): Promise<string> {
  // 基于房源面积 × 适用税额（各地不同，默认 10元/㎡）
  const data = [
    { 项目: '备注', 金额: '0.00' },
    { 项目: '说明', 金额: '需在系统中维护房源的土地等级和面积信息' },
  ];

  return writeDataFile(data, opts, `土地使用税申报_${opts.period}`);
}

/**
 * 印花税申报导出（租赁合同金额 × 0.1%）
 */
async function exportStampTax(opts: TaxExportOptions): Promise<string> {
  const [year] = opts.period.split('-');
  const startOfYear = dayjs(`${year}-01-01`);
  const endOfYear = dayjs(`${year}-12-31`);

  const contracts = await Contract.findAll({
    where: {
      signedAt: { [Op.between]: [startOfYear.toDate(), endOfYear.toDate()] },
    },
  });

  const totalContractAmount = contracts.reduce((s, c) => s + Number(c.rentAmount || 0), 0);
  const taxAmount = totalContractAmount * 0.001; // 租赁合同印花税 0.1%

  const data = [
    { 项目: '合同总金额', 金额: totalContractAmount.toFixed(2) },
    { 项目: '印花税应纳税额（0.1%）', 金额: taxAmount.toFixed(2) },
  ];

  return writeDataFile(data, opts, `印花税申报_${opts.period}`);
}

/**
 * 企业所得税申报导出（季度预缴）
 */
async function exportCit(opts: TaxExportOptions): Promise<string> {
  const [year] = opts.period.split('-');

  // 汇总收入类科目
  const revenueAccounts = await ChartOfAccount.findAll({
    where: { type: '收入' },
  });
  const accountIds = revenueAccounts.map((a) => a.id);

  const entries = await VoucherEntry.findAll({
    where: { accountId: { [Op.in]: accountIds } },
    include: [{ model: Voucher, as: 'voucher', where: { period: { [Op.like]: `${year}%` } } }],
  });

  const totalRevenue = entries.reduce((s, e) => s + Number(e.creditAmount || 0), 0);
  const taxableIncome = totalRevenue * 0.25; // 简化：25% CIT 税率

  const data = [
    { 项目: '营业收入', 金额: totalRevenue.toFixed(2) },
    { 项目: '应纳税所得额（估算）', 金额: taxableIncome.toFixed(2) },
  ];

  return writeDataFile(data, opts, `企业所得税申报_${opts.period}`);
}

/**
 * 写入导出文件
 */
function writeDataFile(
  data: Record<string, string>[],
  opts: TaxExportOptions,
  fileName: string
): string {
  const exportDir = path.join(process.cwd(), 'exports');
  if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir, { recursive: true });
  }

  if (opts.format === 'csv') {
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map((d) => Object.values(d).join(',')).join('\n');
    const filePath = path.join(exportDir, `${fileName}.csv`);
    fs.writeFileSync(filePath, `${headers}\n${rows}`, 'utf-8');
    return filePath;
  }

  if (opts.format === 'xml') {
    const xmlRows = data.map((d) =>
      `  <row>${Object.entries(d).map(([k, v]) => `<${k}>${v}</${k}>`).join('')}</row>`
    ).join('\n');
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<tax-export>\n${xmlRows}\n</tax-export>`;
    const filePath = path.join(exportDir, `${fileName}.xml`);
    fs.writeFileSync(filePath, xml, 'utf-8');
    return filePath;
  }

  // 默认 Excel
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet(data);
  XLSX.utils.book_append_sheet(workbook, sheet, '税务数据');
  const filePath = path.join(exportDir, `${fileName}.xlsx`);
  XLSX.writeFile(workbook, filePath);
  return filePath;
}
