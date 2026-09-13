import { describe, it, expect } from 'vitest';
import { toChineseAmount, formatDate } from '@/utils/print-service';
import { buildBillHTML } from '@/components/print/BillPrint';
import { buildReceiptHTML } from '@/components/print/ReceiptPrint';
import { readSheetAsObjects, buildWorkbookBlob } from '@/utils/excel';

describe('金额大写（打印/收据的法律要件）', () => {
  it('整数金额', () => {
    expect(toChineseAmount(0)).toContain('零');
    expect(toChineseAmount(1)).toContain('壹');
    expect(toChineseAmount(10)).toContain('拾');
  });

  it('含角分的金额不丢精度', () => {
    const s = toChineseAmount(1234.56);
    expect(s).toContain('壹');
    expect(s).toContain('角');
    expect(s).toContain('分');
  });

  it('万位以上金额', () => {
    expect(toChineseAmount(58000)).toContain('万');
  });
});

describe('账单打印模板', () => {
  const data: any = {
    billNo: 'BL-TEST-001',
    period: '2026-09',
    tenantName: '张三',
    propertyName: 'A栋101',
    rentAmount: 3000,
    waterFee: 0,
    electricFee: 0,
    utilityAmount: 0,
    propertyFee: 500.5,
    otherAmount: 0,
    lateFee: 0,
    totalAmount: 3500.5,
    dueDate: '2026-09-10',
    status: '未缴',
    paidDate: null,
    paymentChannel: null,
    companyName: '回归测试物业公司',
  };

  it('渲染出账单编号、租客与金额大写', () => {
    const html = buildBillHTML(data);
    expect(html).toContain('BL-TEST-001');
    expect(html).toContain('张三');
    expect(html).toContain(toChineseAmount(3500.5));
  });

  it('费用分项逐条出现且金额精确到分', () => {
    const html = buildBillHTML(data);
    expect(html).toContain('房租');
    expect(html).toContain('物业费');
    expect(html).toContain('3000.00');
    expect(html).toContain('500.50');
  });

  it('公司抬头出现在票面上', () => {
    expect(buildBillHTML(data)).toContain('回归测试物业公司');
  });

  it('输出为可直接打印的 HTML 片段（表格 + 账期）', () => {
    const html = buildBillHTML(data);
    expect(html.length).toBeGreaterThan(200);
    expect(html).toContain('<table');
    expect(html).toContain('2026-09');   // 账期出现在票面
  });
});

describe('收款凭证打印模板（80mm 热敏小票）', () => {
  const data: any = {
    receiptNo: 'REC-2026-0001',
    tenantName: '张伟明',
    propertyName: '阳光花园 A-1203',
    amount: 2500,
    paymentChannel: '微信支付',
    paidAt: '2026-09-13 10:30',
    period: '2026-09',
    transactionNo: 'TXN2500',
    companyLogo: '',
    companySeal: '',
  };

  it('票面抬头不打印甲方公司名，只保留标题「收款凭证」', () => {
    const html = buildReceiptHTML({ ...data, companyName: '某某物业管理有限公司' } as any);
    expect(html).not.toContain('某某物业管理有限公司');
    expect(html).not.toContain('物业租赁管理公司');   // 旧的兜底甲方名也不能再出现
    expect(html).toContain('收款凭证');
  });

  it('全文不加粗（热敏机上粗体笔画互相挤压会糊版）', () => {
    const html = buildReceiptHTML(data);
    expect(html).not.toMatch(/font-weight\s*:\s*(bold|[6-9]\d\d)/i);
    expect(html).toContain('font-weight: 400');
  });

  it('金额大写与 60mm 内容宽（防右侧裁字）保持不变', () => {
    const html = buildReceiptHTML(data);
    expect(html).toContain(toChineseAmount(2500));
    expect(html).toContain('width: 60mm');
  });
});

describe('日期格式化', () => {
  it('标准化为 YYYY-MM-DD 可读形式', () => {
    const s = formatDate('2026-09-01');
    expect(String(s)).toMatch(/2026/);
  });
  it('空值不抛异常', () => {
    expect(() => formatDate('')).not.toThrow();
  });
});

describe('前端 Excel 工具（迁移 exceljs 后的读写契约）', () => {
  it('写出的工作簿能被自己读回，中文表头与数字保真', async () => {
    const blob = await buildWorkbookBlob([{
      name: '导入模板',
      rows: [{ 名称: 'A栋101', 面积: 88.5 }, { 名称: 'B栋202', 面积: 120 }],
    }]);
    const buf = await blob.arrayBuffer();
    const rows = await readSheetAsObjects(buf);
    expect(rows).toHaveLength(2);
    expect(rows[0]['名称']).toBe('A栋101');
    expect(rows[0]['面积']).toBe(88.5);
  });

  it('空数据也返回合法 xlsx（不抛异常）', async () => {
    const blob = await buildWorkbookBlob([{ name: '空', rows: [] }]);
    expect(blob.size).toBeGreaterThan(0);
  });
});
