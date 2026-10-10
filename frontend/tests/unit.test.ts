import { describe, it, expect } from 'vitest';
import { toChineseAmount, formatDate } from '@/utils/print-service';
import { buildBillHTML } from '@/components/print/BillPrint';
import { buildReceiptHTML } from '@/components/print/ReceiptPrint';
import { buildContractHTML } from '@/components/print/ContractPrint';
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

describe('合同乙方证件与联系方式开关（用户 2026-10-10 要求）', () => {
  const base: any = {
    contractNo: 'HT-TEST-001',
    propertyName: 'A栋101',
    propertyAddress: '示例路1号',
    propertyArea: 88,
    tenantName: '张三',
    tenantIdType: '身份证',
    tenantIdNumber: '320102199001011234',
    tenantPhone: '13800138000',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    rentAmount: 3000,
    depositAmount: 3000,
    paymentCycle: '月',
    status: '起草中',
    notes: '',
    companyName: '回归测试物业公司',
  };

  it('开关关闭时乙方栏不出现证件号与联系电话', () => {
    const html = buildContractHTML({ ...base, showTenantContact: false });
    expect(html).not.toContain('320102199001011234');
    expect(html).not.toContain('13800138000');
    expect(html).toContain('张三');           // 姓名仍要打印
  });

  it('开关打开时照常写入；未传该值时保持老合同行为（写入）', () => {
    expect(buildContractHTML({ ...base, showTenantContact: true })).toContain('320102199001011234');
    expect(buildContractHTML({ ...base })).toContain('13800138000');
  });

  it('租客只登记了证件类型没填证件号时，不出现孤立的「证件类型：身份证」', () => {
    const html = buildContractHTML({ ...base, tenantIdType: '身份证', tenantIdNumber: '', showTenantContact: true });
    expect(html).not.toContain('证件类型：身份证');
  });
});

describe('履约违约金与押金的月份折算（用户 2026-10-10 要求）', () => {
  const base: any = {
    contractNo: 'HT-TEST-002', propertyName: 'A栋101', propertyAddress: '示例路1号', propertyArea: 88,
    tenantName: '张三', tenantIdType: '', tenantIdNumber: '', tenantPhone: '',
    startDate: '2026-01-01', endDate: '2026-12-31',
    rentAmount: 3000, depositAmount: 3000, performancePenalty: 3000,
    paymentCycle: '月', status: '起草中', notes: '', companyName: '回归测试物业公司',
  };

  it('押金与履约违约金各注明金额与相当于几个月租金', () => {
    const html = buildContractHTML(base);
    expect(html).toContain('履约违约金');
    expect(html).toContain('相当于 1 个月租金');
    expect(html).toContain('月租金 ¥3000.00');
  });

  it('自定义倍数如实折算（押金 1.5 个月、履约违约金 0.5 个月）', () => {
    const html = buildContractHTML({ ...base, rentAmount: 2000, depositAmount: 3000, performancePenalty: 1000 });
    expect(html).toContain('相当于 1.5 个月租金');
    expect(html).toContain('相当于 0.5 个月租金');
  });

  it('新合同不再打印违约金比例，老合同（存有 lateFeeRate）保持原样', () => {
    expect(buildContractHTML(base)).not.toContain('% / 月');
    expect(buildContractHTML({ ...base, performancePenalty: 0, lateFeeRate: 0.05 })).toContain('5.0% / 月');
  });

  it('未填履约违约金时不出现该行', () => {
    expect(buildContractHTML({ ...base, performancePenalty: 0 })).not.toContain('履约违约金');
  });
});

describe('首期应交租金可自定义（用户 2026-10-10 要求）', () => {
  const base: any = {
    contractNo: 'HT-TEST-003', propertyName: 'A栋101', propertyAddress: '示例路1号', propertyArea: 88,
    tenantName: '张三', tenantIdType: '', tenantIdNumber: '', tenantPhone: '',
    startDate: '2026-01-01', endDate: '2028-12-31',
    rentAmount: 3000, depositAmount: 3000, performancePenalty: 3000,
    paymentCycle: '年', status: '起草中', notes: '', companyName: '回归测试物业公司',
  };

  it('默认自动：付款周期为年时按 12 个月计算，并注明相当于几个月租金', () => {
    const html = buildContractHTML(base);
    expect(html).toContain('首年应交租金');
    expect(html).toContain('36000.00');
    expect(html).toContain('相当于 12 个月租金');
  });

  it('自定义时按填写的金额出票（三年一起交 = 108000）', () => {
    const html = buildContractHTML({ ...base, firstPeriodRent: 108000 });
    expect(html).toContain('首期应交租金');
    expect(html).toContain('108000.00');
    expect(html).toContain('相当于 36 个月租金');
    expect(html).not.toContain('36000.00');
  });

  it('自定义时按月计的费用随实际月数缩放（体现在首年费用合计里）', () => {
    const withFees = (extra: any) => buildContractHTML({
      ...base, ...extra,
      feeItems: [{ name: '物业费', amount: 500, unit: '元/月' }],
    });
    // 模板中「首年费用合计」印的是 租金 + 费用：
    //   自动 12 个月 → 36000 + 500×12 = 42000；自定义 36 个月 → 108000 + 500×36 = 126000
    // 若费用没跟着缩放（仍按 12 个月），自定义那侧会变成 114000，断言即失败
    expect(withFees({})).toContain('42000.00');
    expect(withFees({ firstPeriodRent: 108000 })).toContain('126000.00');
    expect(withFees({ firstPeriodRent: 108000 })).not.toContain('114000.00');
  });
});

describe('合同底部签章区（甲乙双方签约信息，用户 2026-10-10 要求）', () => {
  const base: any = {
    contractNo: 'HT-SIGN-001', propertyName: 'A栋101', propertyAddress: '示例路1号', propertyArea: 88,
    tenantName: '张三', tenantIdType: '身份证', tenantIdNumber: '320102199001011234', tenantPhone: '13800138000',
    startDate: '2026-01-01', endDate: '2026-12-31', rentAmount: 3000, depositAmount: 3000,
    paymentCycle: '月', status: '起草中', notes: '', companyName: '回归测试物业公司', companyPhone: '025-88880000',
  };

  it('甲乙双方要求的字段标签齐全，且各自带日期栏', () => {
    const html = buildContractHTML(base);
    for (const label of ['甲方', '签约代表人', '邮编', '开户银行', '帐户名', '帐　号', '乙方', '法定代表人', '（授权代表）', '身份证号码']) {
      expect(html).toContain(label);
    }
    expect(html.match(/日期：＿＿＿＿年＿＿月＿＿日/g)?.length).toBe(2);
  });

  it('系统里的数据自动带出（甲方名称/电话/收款账号、乙方名称/证件号/联系人/地址）', () => {
    const html = buildContractHTML({
      ...base,
      companySigner: '张经理', companyAddress: '示例路9号', companyPostcode: '210000',
      bankName: '中国工商银行示例支行', bankAccountName: '回归测试物业公司', bankAccountNumber: '6222020200112233',
      tenantContactPerson: '李四', tenantAddress: '南京市玄武区示例路1号',
    });
    for (const v of ['张经理', '示例路9号', '210000', '中国工商银行示例支行', '6222020200112233', '李四', '南京市玄武区示例路1号']) {
      expect(html).toContain(v);
    }
    expect(html).toContain('张三');
    expect(html).toContain('320102199001011234');
  });

  it('没有配置的值留空划线（不再出现旧的「（盖章）」占位符）', () => {
    expect(buildContractHTML(base)).not.toContain('（盖章）');
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
