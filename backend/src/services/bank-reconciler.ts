import PaymentRecord from '../models/PaymentRecord.js';
import { Op } from 'sequelize';
import * as XLSX from 'xlsx';

/**
 * 银行对账服务
 * 解析银行账单文件（Excel/CSV格式），与系统收款记录对账
 */

interface BankStatementRow {
  transactionDate: string;
  amount: number;
  description: string;
  transactionNo: string;
  counterParty: string;
}

interface ReconciliationResult {
  matched: number;
  unmatched: Array<{ bank: BankStatementRow; reason: string }>;
  totalBankAmount: number;
  totalSystemAmount: number;
  difference: number;
}

/**
 * 解析银行账单文件
 * @param filePath 上传的银行账单文件路径
 * @param bankFormat 银行格式：'icbc' | 'ccb' | 'boc' | 'cmb' | 'generic'
 */
export function parseBankStatement(
  filePath: string,
  bankFormat: string = 'generic'
): BankStatementRow[] {
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawRows: any[] = XLSX.utils.sheet_to_json(sheet);

  const rows: BankStatementRow[] = [];

  for (const row of rawRows) {
    // 根据银行格式映射字段
    const mapping = getMappingForBank(bankFormat);
    rows.push({
      transactionDate: String(row[mapping.date] || row['交易日期'] || row['date'] || ''),
      amount: Math.abs(Number(row[mapping.amount] || row['金额'] || row['amount'] || 0)),
      description: String(row[mapping.desc] || row['摘要'] || row['description'] || ''),
      transactionNo: String(row[mapping.txNo] || row['流水号'] || row['transactionNo'] || ''),
      counterParty: String(row[mapping.party] || row['对方户名'] || row['counterParty'] || ''),
    });
  }

  console.log(`[BankRec] Parsed ${rows.length} rows from ${filePath} (${bankFormat})`);
  return rows;
}

/**
 * 获得银行格式的列映射
 */
function getMappingForBank(format: string) {
  const mappings: Record<string, { date: string; amount: string; desc: string; txNo: string; party: string }> = {
    icbc: { date: '交易日期', amount: '发生金额', desc: '摘要', txNo: '凭证号', party: '对方户名' },
    ccb: { date: '记账日期', amount: '借贷金额', desc: '摘要', txNo: '凭证编号', party: '对方单位' },
    boc: { date: '交易日期', amount: '交易金额', desc: '摘要', txNo: '业务编号', party: '对方户名' },
    cmb: { date: '记账日期', amount: '交易金额', desc: '摘要', txNo: '流水号', party: '对方户名' },
    generic: { date: '交易日期', amount: '交易金额', desc: '摘要', txNo: '流水号', party: '对方户名' },
  };
  return mappings[format] || mappings.generic;
}

/**
 * 执行银行对账
 * 匹配规则：交易号精确匹配 → 金额+日期匹配
 */
export async function reconcileBankStatement(
  filePath: string,
  bankFormat: string = 'generic',
  startDate?: string,
  endDate?: string
): Promise<ReconciliationResult> {
  const bankRows = parseBankStatement(filePath, bankFormat);

  // 获取系统收款记录
  const where: any = {};
  if (startDate || endDate) {
    where.paidAt = {};
    if (startDate) where.paidAt[Op.gte] = new Date(startDate);
    if (endDate) where.paidAt[Op.lte] = new Date(endDate + 'T23:59:59');
  }

  const systemRecords = await PaymentRecord.findAll({ where });
  const matched: number[] = [];
  const unmatched: Array<{ bank: BankStatementRow; reason: string }> = [];

  for (const bankRow of bankRows) {
    let found = false;

    // 规则1: 交易号精确匹配
    for (const sysRecord of systemRecords) {
      if (sysRecord.transactionNo && bankRow.transactionNo &&
          sysRecord.transactionNo.trim() === bankRow.transactionNo.trim()) {
        found = true;
        matched.push(sysRecord.id);
        break;
      }
    }

    // 规则2: 金额+日期模糊匹配（容差 0.01 元）
    if (!found) {
      for (const sysRecord of systemRecords) {
        const sysDate = sysRecord.paidAt?.slice(0, 10);
        if (sysDate === bankRow.transactionDate.slice(0, 10) &&
            Math.abs(Number(sysRecord.amount) - bankRow.amount) < 0.01) {
          found = true;
          matched.push(sysRecord.id);
          break;
        }
      }
    }

    if (!found) {
      unmatched.push({ bank: bankRow, reason: '未找到匹配的系统收款记录' });
    }
  }

  const totalBankAmount = bankRows.reduce((s, r) => s + r.amount, 0);
  const totalSystemAmount = systemRecords
    .filter((r) => matched.includes(r.id))
    .reduce((s, r) => s + Number(r.amount), 0);

  const result: ReconciliationResult = {
    matched: matched.length,
    unmatched,
    totalBankAmount,
    totalSystemAmount,
    difference: Math.abs(totalBankAmount - totalSystemAmount),
  };

  console.log(`[BankRec] Reconciled: ${result.matched} matched, ${result.unmatched.length} unmatched, diff=${result.difference.toFixed(2)}`);
  return result;
}

/**
 * 快速对账：仅按金额和时间窗口匹配
 */
export async function quickReconcile(
  startDate: string,
  endDate: string
): Promise<{ bankCount: number; systemCount: number; bankAmount: number; systemAmount: number }> {
  // 此处调用完整对账，但在实际场景中可以从银行 API 拉取数据
  // 当前作为占位
  console.log(`[BankRec] Quick reconcile: ${startDate} ~ ${endDate}`);
  return { bankCount: 0, systemCount: 0, bankAmount: 0, systemAmount: 0 };
}
