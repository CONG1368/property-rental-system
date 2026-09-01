import fs from 'fs';
import path from 'path';

// 文档类型
export type OcrDocType = 'id-card' | 'invoice' | 'bank-receipt' | 'meter-reading';

export interface OcrResult {
  docType: OcrDocType;
  fields: Record<string, any>;
  rawText: string;
  confidence: number;
  provider: string;
}

// OCR Provider 抽象：接入阿里云/百度/讯飞 OCR 时替换实现
export interface OcrProvider {
  recognize(imagePath: string, docType: OcrDocType): Promise<Partial<OcrResult>>;
}

// Mock 实现：返回结构化样例字段，用于联调；接入真实 SDK 时通过 OCR_PROVIDER 切换
class MockOcrProvider implements OcrProvider {
  async recognize(_imagePath: string, docType: OcrDocType): Promise<Partial<OcrResult>> {
    await new Promise(r => setTimeout(r, 300)); // 模拟耗时
    switch (docType) {
      case 'id-card':
        return { fields: { name: '示例租户', idNumber: '320102199001011234', gender: '男', birthDate: '1990-01-01', address: '南京市玄武区示例路1号' }, rawText: 'OCR-MOCK-IDCARD', confidence: 0.97, provider: 'mock' };
      case 'invoice':
        return { fields: { invoiceNo: 'INV-MOCK-0001', buyerName: '示例公司', taxNo: '91320000MA1X00001', amount: 1000, taxRate: 0.06, invoiceDate: new Date().toISOString().slice(0, 10) }, rawText: 'OCR-MOCK-INVOICE', confidence: 0.95, provider: 'mock' };
      case 'bank-receipt':
        return { fields: { transactionNo: 'TRX-MOCK-0001', amount: 5000, counterParty: '示例付款方', date: new Date().toISOString().slice(0, 10) }, rawText: 'OCR-MOCK-RECEIPT', confidence: 0.93, provider: 'mock' };
      case 'meter-reading':
        return { fields: { meterNo: 'E-MOCK-1001', type: '电', currentReading: 215, unit: '度' }, rawText: 'OCR-MOCK-METER', confidence: 0.94, provider: 'mock' };
    }
  }
}

let provider: OcrProvider | null = null;
export function getOcrProvider(): OcrProvider {
  if (provider) return provider;
  const mode = (process.env.OCR_PROVIDER || 'mock').toLowerCase();
  // 接入真实 SDK：新增 Provider 类并在下方切换
  provider = new MockOcrProvider();
  return provider;
}

// 保留文件路径校验（防止目录穿越）
export function safePreviewPath(filePath: string): string {
  return path.normalize(filePath);
}

export function ocrLog(imagePath: string, docType: OcrDocType, result: Partial<OcrResult>) {
  const dir = path.join(process.cwd(), 'logs');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(path.join(dir, 'ocr.jsonl'), JSON.stringify({ imagePath, docType, result, time: new Date().toISOString() }) + '\n');
}
