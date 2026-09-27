// 账单打印：收据（已缴/部分缴，80mm 热敏）与账单（A4）两条路径。
// 从 BillList.vue 外提，页面只保留一行调用。
import request from '@/api/request';
import { printDocument } from '@/utils/print-service';
import { buildReceiptHTML } from '@/components/print/ReceiptPrint';
import { buildBillHTML } from '@/components/print/BillPrint';

async function getCompanyInfo() {
  try {
    const res = await request.get('/system-configs/keys', { params: { keys: 'company_name_for_print,company_logo,company_seal' } });
    const map: Record<string, string> = {};
    (res.data || []).forEach((c: any) => { map[c.configKey] = c.configValue; });
    return { companyName: map['company_name_for_print'] || '物业租赁管理公司', companyLogo: map['company_logo'] || '', companySeal: map['company_seal'] || '' };
  } catch { return { companyName: '物业租赁管理公司', companyLogo: '', companySeal: '' }; }
}

/** 打印/导出账单：mode = 'native' 直接打印 | 'pdf' 导出 PDF */
export async function printBillDocument(row: any, mode: 'native' | 'pdf') {
  const info = await getCompanyInfo();
  const tenantName = row.contract?.tenant?.name || '-';
  const propertyName = row.contract?.property?.name || '-';
  const isPaid = row.status === '已缴' || row.status === '部分缴';
  const html = isPaid
    ? buildReceiptHTML({
        receiptNo: row.billNo || 'REC-' + row.id, tenantName, propertyName,
        amount: Number(row.totalAmount || 0), paymentChannel: row.paymentChannel || '-',
        paidAt: row.paidDate || new Date(), period: row.period || '-',
        transactionNo: 'TXN' + row.id, ...info,
      })
    : buildBillHTML({
        billNo: row.billNo || 'BL-' + row.id, period: row.period || '-', tenantName, propertyName,
        rentAmount: Number(row.rentAmount || 0), waterFee: Number(row.waterFee || 0),
        electricFee: Number(row.electricFee || 0), utilityAmount: Number(row.utilityAmount || 0),
        propertyFee: Number(row.propertyFee || 0), otherAmount: Number(row.otherAmount || 0),
        lateFee: Number(row.lateFee || 0), totalAmount: Number(row.totalAmount || 0),
        dueDate: row.dueDate, status: row.status,
        paidDate: row.paidDate || null, paymentChannel: row.paymentChannel || null, ...info,
      });
  await printDocument({
    title: (isPaid ? '收据_' : '账单_') + row.billNo,
    paperSize: isPaid ? '80mm' : 'A4',
    htmlContent: html,
    mode,
  });
}
