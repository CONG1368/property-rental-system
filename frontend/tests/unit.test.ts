import { describe, it, expect } from 'vitest';
import { toChineseAmount, formatDate } from '@/utils/print-service';
import { buildBillHTML } from '@/components/print/BillPrint';
import { buildReceiptHTML } from '@/components/print/ReceiptPrint';
import { buildContractHTML } from '@/components/print/ContractPrint';
import { isAllowedAttachment, splitAllowed, attachmentLabel, checklistSummary, extOf, ATTACHMENT_ACCEPT, ATTACHMENT_GROUPS, groupAttachments } from '@/utils/attachment-upload';
import { renderPlaceholders, buildDocContext, buildRows, buildDocHTML, docxFileName, cloneTemplate, duplicateName } from '@/utils/attachment-docs';
import { mergeClauses } from '@/utils/clause-merge';
import { extOfName, buildAttachmentContentHTML } from '@/utils/attachment-print';
import { buildDocxBlob, DOCX_MIME } from '@/utils/docx';
import JSZip from 'jszip';
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

  it('押金与履约违约金只写金额，不再注明「相当于几个月租金」（用户 2026-10-16：押金常取整收，注明月数会与实际不符）', () => {
    const html = buildContractHTML(base);
    expect(html).toContain('押金');
    expect(html).toContain('履约违约金');
    expect(html).toContain('3000.00');
    // 全篇只剩「首期应交租金」那一行带月数说明
    expect((html.match(/相当于/g) || []).length).toBe(1);
    const depositRow = html.slice(html.indexOf('押金'), html.indexOf('履约违约金'));
    expect(depositRow).not.toContain('相当于');
    expect(depositRow).not.toContain('个月租金');
  });

  it('押金/履约违约金按自定义金额原样打印，不再折算成几个月', () => {
    const html = buildContractHTML({ ...base, rentAmount: 2000, depositAmount: 3000, performancePenalty: 1000 });
    expect(html).toContain('3000.00');
    expect(html).toContain('1000.00');
    expect(html).not.toContain('1.5 个月租金');
    expect(html).not.toContain('0.5 个月租金');
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

describe('合同附件清单（用户 2026-10-16 要求：签名在附件之前、只列用户上传的附件）', () => {
  const base: any = {
    contractNo: 'HT-ATT-001', propertyName: 'A栋101', propertyAddress: '示例路1号', propertyArea: 88,
    tenantName: '张三', startDate: '2026-01-01', endDate: '2026-12-31', rentAmount: 3000, depositAmount: 3000,
    paymentCycle: '月', status: '已签订', notes: '', companyName: '回归测试物业公司',
    clauses: [{ title: '房屋用途', content: '仅用于居住。', sortOrder: 0 }],
  };

  it('甲乙双方签名排在附件清单之前', () => {
    const html = buildContractHTML({ ...base, attachments: [{ name: '身份证复印件.pdf' }] });
    const sign = html.indexOf('class="sign-area"');
    const att = html.indexOf('附件目录');
    expect(sign).toBeGreaterThan(-1);
    expect(att).toBeGreaterThan(-1);
    expect(sign).toBeLessThan(att);
  });

  it('消防不再自动作为附件：只配置了消防、没有上传附件时，附件清单不出现（消防条款仍印在正文）', () => {
    const html = buildContractHTML({ ...base, fireSafety: { clauses: [{ title: '消防责任', content: '乙方为承租区域消防安全第一责任人。' }] } });
    expect(html).not.toContain('附件目录');
    expect(html).not.toContain('具体文件另附');
    // 正文里的消防安全约定区块不受影响（只是不再自动进附件清单）
    expect(html).toContain('消防安全约定');
    expect(html).toContain('乙方为承租区域消防安全第一责任人');
  });

  it('既没有上传附件也没有消防配置时，同样不出现附件清单', () => {
    const html = buildContractHTML(base);
    expect(html).not.toContain('附件目录');
    expect(html).not.toContain('具体文件另附');
  });

  it('用户上传的附件按顺序列出、去掉扩展名、编号从附件1 起（消防不占位）', () => {
    const html = buildContractHTML({
      ...base,
      fireSafety: { clauses: [{ title: '消防责任', content: '乙方为消防安全第一责任人。' }] },
      attachments: [{ name: '房屋交接单.docx' }, { name: '营业执照.jpg' }],
    });
    expect(html).toContain('附件1');
    expect(html).toContain('附件2');
    expect(html).toContain('房屋交接单');
    expect(html).toContain('营业执照');
    expect(html).not.toContain('附件3');
    expect(html).not.toContain('.docx');
    expect(html).not.toContain('.jpg');
    // 附件清单区块内不应出现消防
    const start = html.indexOf('附件目录');
    const listHtml = html.slice(start, html.indexOf('</div>', start));
    expect(listHtml).not.toContain('消防安全约定');
  });

  it('没有消防但有上传附件时，附件从 1 开始编号', () => {
    const html = buildContractHTML({ ...base, attachments: [{ name: '押金收据.png' }] });
    expect(html).toContain('附件1');
    expect(html).toContain('押金收据');
    expect(html).not.toContain('消防安全约定');
  });

  it('附件设有标题/备注时优先显示标题，未设置才回退文件名（用户 2026-10-16 追加）', () => {
    const html = buildContractHTML({ ...base, attachments: [{ name: 'scan_20261016.pdf', title: '房屋交接单' }, { name: '营业执照.jpg' }] });
    expect(html).toContain('房屋交接单');
    expect(html).not.toContain('scan_20261016');
    expect(html).toContain('营业执照');
  });

  it('标题里的 & < > 会被转义，不会破坏附件清单排版', () => {
    const html = buildContractHTML({ ...base, attachments: [{ name: 'a.pdf', title: '附件&<测试>' }] });
    expect(html).toContain('附件&amp;&lt;测试&gt;');
  });
});

describe('合同 Word 导出（用户 2026-10-11 要求：字体清晰、绝不能模糊或乱字符）', () => {
  const base: any = {
    contractNo: 'HT-DOCX-001', propertyName: '翡翠湾A座101', propertyAddress: '示例路1号', propertyArea: 88.5,
    tenantName: '张三', tenantIdType: '身份证', tenantIdNumber: '320102199001011234', tenantPhone: '13800138000',
    tenantLegalPerson: '李四', tenantSignAddress: '南京市玄武区示例路1号', tenantPostcode: '210008',
    tenantBankName: '招商银行示例支行', tenantBankAccount: '6214830200112233',
    startDate: '2026-01-01', endDate: '2027-12-31', rentAmount: 3000, depositAmount: 4500, performancePenalty: 3000,
    firstPeriodRent: 9000, paymentCycle: '季', status: '已签订', notes: '双方另约定：物业费由乙方承担。',
    companyName: '回归测试物业公司', companyPhone: '025-88880000', companySigner: '张经理',
    companyAddress: '南京市建邺区示例大道9号', companyPostcode: '210019',
    bankName: '中国工商银行示例支行', bankAccountName: '回归测试物业公司', bankAccountNumber: '6222020200112233',
    clauses: [{ title: '第一条　房屋用途', content: '仅用于居住 & 经营，不得转租 <含转租>。', sortOrder: 1 }],
  };
  const readDoc = async (html: string) => {
    const blob = await buildDocxBlob(html, { title: '物业租赁合同' });
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    return { blob, zip, doc: await zip.file('word/document.xml')!.async('string') };
  };
  const plain = (xml: string) => xml.replace(/<[^>]+>/g, '');

  it('产出的是合法 docx 包：ZIP 结构与 8 个必需部件齐全', async () => {
    const { blob, zip } = await readDoc(buildContractHTML(base));
    expect(blob.type).toBe(DOCX_MIME);
    for (const part of ['[Content_Types].xml', '_rels/.rels', 'word/document.xml', 'word/styles.xml', 'word/settings.xml', 'word/_rels/document.xml.rels', 'docProps/core.xml', 'docProps/app.xml']) {
      expect(await zip.file(part)?.async('string')).toBeTruthy();
    }
  });

  it('中文字体显式声明（宋体 eastAsia + Times New Roman），正文是文字不是位图', async () => {
    const { zip, doc } = await readDoc(buildContractHTML(base));
    expect(doc).toContain('w:eastAsia="宋体"');
    expect(doc).toContain('w:ascii="Times New Roman"');
    expect(doc).toContain('w:eastAsia="黑体"');
    expect(await zip.file('word/styles.xml')!.async('string')).toContain('w:eastAsia="宋体"');
    expect(doc).not.toContain('<w:drawing');
  });

  it('文本全部走 XML 转义：& < > 不会破坏文档结构', async () => {
    const { doc } = await readDoc(buildContractHTML(base));
    expect(doc).toContain('仅用于居住 &amp; 经营，不得转租 &lt;含转租&gt;。');
    expect(doc).not.toContain('不得转租 <含转租>');
  });

  it('Word 正文与打印 HTML 同源：标题/编号/金额/条款/签章字段都在', async () => {
    const { doc } = await readDoc(buildContractHTML(base));
    const text = plain(doc);
    for (const s of ['物业租赁合同', '合同编号：HT-DOCX-001', '出租方（甲方）', '回归测试物业公司', '承租方（乙方）', '张三',
                     '翡翠湾A座101', '第一条　房屋用途', '双方另约定：物业费由乙方承担', '履约违约金', '首期应交租金',
                     '招商银行示例支行', '6214830200112233', '日期：']) {
      expect(text).toContain(s);
    }
  });

  it('没有条款时 Word 同样不出现兜底条款与条款章节', async () => {
    const { doc } = await readDoc(buildContractHTML({ ...base, clauses: [] }));
    const text = plain(doc);
    expect(text).not.toContain('乙方应按约定时间及时缴纳租金');
    expect(text).not.toContain('合同条款');
  });
});

describe('合同条款排版（用户 2026-10-11 要求：取消系统兜底、条款完全由用户自定义）', () => {
  const base: any = {
    contractNo: 'HT-CLAUSE-001', propertyName: 'A栋101', propertyAddress: '示例路1号', propertyArea: 88,
    tenantName: '张三', startDate: '2026-01-01', endDate: '2026-12-31', rentAmount: 3000, depositAmount: 3000,
    paymentCycle: '月', status: '已签订', notes: '', companyName: '回归测试物业公司', renewalNotice: 30,
  };

  it('没有任何条款时，合同不再自动补兜底条款，且不出现「合同条款」章节', () => {
    for (const html of [buildContractHTML({ ...base, clauses: [] }), buildContractHTML(base)]) {
      expect(html).not.toContain('合同条款');
      expect(html).not.toContain('乙方应按约定时间及时缴纳租金');
      expect(html).not.toContain('本合同一式两份');
    }
  });

  it('用户自带编号时原样打印，不再叠加系统「第N条」', () => {
    const html = buildContractHTML({
      ...base,
      clauses: [
        { title: '第一条　房屋用途', content: '仅用于居住，不得改作他用。', sortOrder: 1 },
        { title: '二、转租限制', content: '未经甲方书面同意不得转租。', sortOrder: 2 },
      ],
    });
    expect(html).toContain('第一条　房屋用途');
    expect(html).toContain('二、转租限制');
    expect(html).not.toContain('第1条　第一条');
    expect(html).not.toContain('第2条　二、');
    expect(html).toContain('仅用于居住，不得改作他用。');
  });

  it('用户没编号时仍按顺序补「第N条」', () => {
    const html = buildContractHTML({
      ...base,
      clauses: [
        { title: '房屋用途', content: '仅用于居住。', sortOrder: 1 },
        { title: '转租限制', content: '不得转租。', sortOrder: 2 },
      ],
    });
    expect(html).toContain('第1条　房屋用途');
    expect(html).toContain('第2条　转租限制');
  });

  it('标题留空时只打印内容段落（可当纯文本条款用）', () => {
    const html = buildContractHTML({
      ...base,
      clauses: [{ title: '', content: '双方另行约定：租期内甲方不得随意涨租。', sortOrder: 1 }],
    });
    expect(html).toContain('双方另行约定：租期内甲方不得随意涨租。');
    expect(html).toContain('合同条款');
    expect(html).not.toContain('第1条　');
  });
});

describe('合同底部签章区（甲乙双方签约信息，用户 2026-10-10 要求）', () => {
  const base: any = {
    contractNo: 'HT-SIGN-001', propertyName: 'A栋101', propertyAddress: '示例路1号', propertyArea: 88,
    tenantName: '张三', tenantIdType: '身份证', tenantIdNumber: '320102199001011234', tenantPhone: '13800138000',
    startDate: '2026-01-01', endDate: '2026-12-31', rentAmount: 3000, depositAmount: 3000,
    paymentCycle: '月', status: '起草中', notes: '', companyName: '回归测试物业公司', companyPhone: '025-88880000',
  };

  it('合同上不打印状态提示（给租户签署的合同不能出现「起草中」）', () => {
    const html = buildContractHTML({ ...base, status: '起草中' });
    expect(html).not.toContain('状态：');
    expect(html).not.toContain('起草中');
    expect(html).toContain('合同编号：HT-SIGN-001');
  });

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
      tenantLegalPerson: '李四', tenantSignAddress: '南京市玄武区示例路1号', tenantPostcode: '210008',
      tenantBankName: '招商银行示例支行', tenantBankAccount: '6214830200112233',
    });
    for (const v of ['张经理', '示例路9号', '210000', '中国工商银行示例支行', '6222020200112233',
                     '李四', '南京市玄武区示例路1号', '210008', '招商银行示例支行', '6214830200112233']) {
      expect(html).toContain(v);
    }
    expect(html).toContain('张三');
    expect(html).toContain('320102199001011234');
  });

  it('没有配置的值留空划线（不再出现旧的「（盖章）」占位符）', () => {
    expect(buildContractHTML(base)).not.toContain('（盖章）');
  });
});

describe('合同消防安全约定区块（用户 2026-10-10 要求）', () => {
  const base: any = {
    contractNo: 'HT-FIRE-001', propertyName: 'A栋101', propertyAddress: '示例路1号', propertyArea: 88,
    tenantName: '张三', tenantIdType: '身份证', tenantIdNumber: '320102199001011234', tenantPhone: '13800138000',
    startDate: '2026-01-01', endDate: '2026-12-31', rentAmount: 3000, depositAmount: 3000,
    paymentCycle: '月', status: '已签订', notes: '', companyName: '回归测试物业公司',
  };

  it('消防责任方 / 检查频率不再打印；只配这两项时整段标题也不出', () => {
    const html = buildContractHTML({ ...base, fireSafety: { responsibilityParty: '双方', inspectionFrequency: '每季' } });
    expect(html).not.toContain('消防责任方');
    expect(html).not.toContain('检查频率');
    expect(html).not.toContain('每季');
    expect(html).not.toContain('消防安全约定');
  });

  it('消防条款 / 禁止事项 / 配备器材 / 违规处罚仍照常打印', () => {
    const html = buildContractHTML({
      ...base,
      fireSafety: {
        responsibilityParty: '双方', inspectionFrequency: '每季',
        violationPenalty: '违规用电罚款 200 元',
        equipment: ['灭火器', '烟感探测器'],
        restrictions: ['禁止堵塞消防通道'],
        clauses: [{ title: '消防责任', content: '乙方应配合甲方开展消防检查。' }],
      },
    });
    for (const v of ['消防安全约定', '违规处罚', '违规用电罚款 200 元', '配备器材', '灭火器', '禁止事项', '禁止堵塞消防通道', '消防责任', '乙方应配合甲方开展消防检查']) {
      expect(html).toContain(v);
    }
    expect(html).not.toContain('消防责任方');
    expect(html).not.toContain('检查频率');
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

describe('附件上传与待补清单工具（用户 2026-10-16：附件便捷化 ⑥⑨⑩）', () => {
  it('允许的类型与后端 multer fileFilter 一致（PDF/Word/图片/Excel）', () => {
    expect(isAllowedAttachment('房屋交接单.docx')).toBe(true);
    expect(isAllowedAttachment('扫描件.PDF')).toBe(true);
    expect(isAllowedAttachment('照片.jpeg')).toBe(true);
    expect(isAllowedAttachment('底数.xlsx')).toBe(true);
    expect(isAllowedAttachment('说明.txt')).toBe(false);
    expect(isAllowedAttachment('压缩包.zip')).toBe(false);
    expect(isAllowedAttachment('无扩展名')).toBe(false);
    expect(ATTACHMENT_ACCEPT).toContain('.pdf');
    expect(ATTACHMENT_ACCEPT).toContain('.docx');
  });

  it('extOf 取小写扩展名（无扩展名返回空串）', () => {
    expect(extOf('A.DOCX')).toBe('docx');
    expect(extOf('无后缀')).toBe('');
  });

  it('splitAllowed 拆分「可上传」与「被拒」两组，便于逐个提示', () => {
    const r = splitAllowed([{ name: 'a.pdf' }, { name: 'b.txt' }, { name: 'c.png' }, { name: 'd' }]);
    expect(r.allowed.map((f) => f.name)).toEqual(['a.pdf', 'c.png']);
    expect(r.rejected).toEqual(['b.txt', 'd']);
  });

  it('attachmentLabel 优先自定义标题、其次去掉扩展名的文件名', () => {
    expect(attachmentLabel({ name: 'scan_2026.pdf', title: '房屋交接单' })).toBe('房屋交接单');
    expect(attachmentLabel({ name: 'scan_2026.pdf' })).toBe('scan_2026');
    expect(attachmentLabel(null)).toBe('');
  });

  it('checklistSummary 输出「还缺 N 项（其中必选 M 项）」', () => {
    expect(checklistSummary({ missing: 0, missingRequired: 0 })).toBe('材料已齐');
    expect(checklistSummary({ missing: 4, missingRequired: 3 })).toBe('还缺 4 项（其中必选 3 项）');
    expect(checklistSummary({ missing: 2, missingRequired: 0 })).toBe('还缺 2 项');
    expect(checklistSummary(null)).toBe('材料已齐');
  });
});

describe('附件单据渲染引擎（用户 2026-10-16：附件便捷化 ①②③）', () => {
  const ctx = buildDocContext({
    contract: { contractNo: 'HT-1', rentAmount: 3000, depositAmount: 3500, performancePenalty: 0, firstPeriodRent: 0, paymentCycle: '月', startDate: '2026-01-01', endDate: '2026-12-31' },
    tenant: { name: '张三', legalPerson: '张三', idNumber: '320102199001011234', phone: '13800138000' },
    property: { name: 'A栋101', address: '示例路1号', area: 88.5 },
    companyName: '测试物业公司', companySigner: '李四', today: '2026-10-16',
  });

  it('占位符替换支持 ${} 与 {{}}，未知键替换为空（合同上不会残留 ${xxx}）', () => {
    expect(renderPlaceholders('承租人：${tenantName}', ctx)).toBe('承租人：张三');
    expect(renderPlaceholders('房源：{{propertyName}}', ctx)).toBe('房源：A栋101');
    expect(renderPlaceholders('缺失：${notExist}!', ctx)).toBe('缺失：!');
  });

  it('上下文带齐合同/租客/房源字段，金额统一两位小数', () => {
    expect(ctx.contractNo).toBe('HT-1');
    expect(ctx.rentAmount).toBe('3000.00');
    expect(ctx.depositAmount).toBe('3500.00');
    expect(ctx.performancePenalty).toBe('0.00');
    expect(ctx.today).toBe('2026-10-16');
    expect(ctx.companySigner).toBe('李四');
    expect(ctx.propertyArea).toBe('88.5');
  });

  it('系统记录映射：消防器材台账 / 账单 / 合同条款（含消防约定）', () => {
    const eq = buildRows('fire-equipment', [{ name: '灭火器', type: '干粉', location: '1F', quantity: 4, status: '正常', expireDate: '2027-01-01' }]);
    expect(eq[0].name).toBe('灭火器');
    expect(eq[0].quantity).toBe(4);
    const bills = buildRows('bills', [{ billNo: 'BL-1', period: '2026-01', totalAmount: 3000, paidAmount: 0, dueDate: '2026-01-05', status: '未缴' }]);
    expect(bills[0].totalAmount).toBe('3000.00');
    expect(bills[0].status).toBe('未缴');
    const clauses = buildRows('contract-clauses', {
      clauses: [{ title: '房屋用途', content: '仅用于居住。' }],
      billingConfig: { fireSafety: { clauses: [{ title: '消防责任', content: '乙方为第一责任人。' }], restrictions: ['禁止堵塞通道'], equipment: ['灭火器'], violationPenalty: '罚款 200 元' } },
    });
    expect(clauses.length).toBe(5);
    expect(clauses[0].title).toBe('房屋用途');
    expect(clauses.map((r) => r.title)).toContain('违规处罚');
    expect(buildRows('unknown-source', [{}])).toEqual([]);
  });

  it('渲染 HTML：标题/合同编号抬头/字段表/条款编号/签署区/系统记录表格', () => {
    const tpl = {
      name: '房屋交接单', docTitle: '房屋交接单', intro: '甲方 ${companyName} 与乙方 ${tenantName} 交接 ${propertyName}：',
      fields: [{ label: '合同编号', value: '${contractNo}' }, { label: '交接日期', value: '${today}' }],
      clauses: ['现状已查验无异议。', '底数作为结算依据。'],
      signatures: [{ label: '甲方', name: '${companySigner}' }, { label: '乙方', name: '${tenantName}' }],
    };
    const html = buildDocHTML(tpl, ctx, []);
    expect(html).toContain('房屋交接单');
    expect(html).toContain('HT-1');
    expect(html).toContain('甲方 测试物业公司 与乙方 张三 交接 A栋101');
    expect(html).toContain('1、现状已查验无异议。');
    expect(html).toContain('2、底数作为结算依据。');
    expect(html).toContain('class="sign-area"');
    expect(html).toContain('乙方：张三');
    // 系统记录：给了行就用模板列
    const withRows = buildDocHTML({ name: '消防器材台账（系统记录）', tableColumns: [{ key: 'name', label: '器材名称' }, { key: 'quantity', label: '数量' }] }, ctx, [{ name: '灭火器', quantity: 4 }]);
    expect(withRows).toContain('器材名称');
    expect(withRows).toContain('灭火器');
    // 无列定义但有数据时，用行键兜底成列
    const fallback = buildDocHTML({ name: '条款全文', tableColumns: [] }, ctx, [{ no: '1', title: '房屋用途' }]);
    expect(fallback).toContain('房屋用途');
  });

  it('文件名：模板名+合同编号，过滤 Windows 非法字符，无编号时只用模板名', () => {
    expect(docxFileName('房屋交接单', 'HT-1')).toBe('房屋交接单_HT-1.docx');
    expect(docxFileName('交接单/消防:责任', 'HT:2')).toBe('交接单消防责任_HT2.docx');
    expect(docxFileName('押金收据', '')).toBe('押金收据.docx');
  });

  it('cloneTemplate：深拷贝成可编辑草稿并补齐空数组（编辑界面不会因空字段报错）', () => {
    const src = { id: 5, name: '房屋交接单', isBuiltIn: 1, fields: [{ label: '合同编号', value: 'x' }], clauses: ['a'] };
    const draft = cloneTemplate(src);
    expect(draft.id).toBe(5);
    expect(draft.isBuiltIn).toBe(1);
    expect(draft.name).toBe('房屋交接单');
    expect(draft.category).toBe('自定义');
    expect(draft.fields.length).toBe(1);
    expect(draft.clauses.length).toBe(1);
    draft.fields[0].label = '改过';
    expect(src.fields[0].label).toBe('合同编号'); // 深拷贝，不污染原模板
    const blank = cloneTemplate({ name: 'X' });
    expect(blank.fields.length).toBe(1);
    expect(blank.clauses.length).toBe(1);
    expect(blank.id).toBe(0);
  });

  it('duplicateName：副本命名不重复（X 副本 / X 副本 2 …）', () => {
    expect(duplicateName('房屋交接单')).toBe('房屋交接单 副本');
    expect(duplicateName('房屋交接单', ['房屋交接单 副本'])).toBe('房屋交接单 副本 2');
    expect(duplicateName('房屋交接单', ['房屋交接单 副本', '房屋交接单 副本 2'])).toBe('房屋交接单 副本 3');
    expect(duplicateName('')).toBe('模板 副本');
  });
});

describe('附件正文打印（用户 2026-10-17 要求：附件内容也要打印在合同后面）', () => {
  it('extOfName：扩展名识别（大小写、无扩展名、多点文件名）', () => {
    expect(extOfName('附件一消防.PDF')).toBe('pdf');
    expect(extOfName('照片.jpeg')).toBe('jpeg');
    expect(extOfName('无扩展名')).toBe('');
    expect(extOfName('a.b.c.png')).toBe('png');
    expect(extOfName('')).toBe('');
  });

  it('buildAttachmentContentHTML：Word/Excel 由后端转 HTML 后整页嵌入（用户 2026-10-17）', async () => {
    const html = await buildAttachmentContentHTML(
      [{ name: '合同附件.docx', title: '补充协议', index: 0 }, { name: '清单.xlsx', index: 1 }],
      async () => null,
      async (i) => (i === 0 ? { html: '<p>补充协议正文</p>' } : { html: '<table><tr><th>项目</th></tr></table>' }),
    );
    expect(html).toContain('page-break-before:always');
    expect(html).toContain('附件1：补充协议');
    expect(html).toContain('附件2：清单');
    expect(html).toContain('<p>补充协议正文</p>');
    expect(html).toContain('<table>');
    expect(html).not.toContain('请查阅原件');
    expect(html.match(/page-break-before:always/g)!.length).toBe(2);
  });

  it('buildAttachmentContentHTML：转换失败时给出「转换失败，请查阅原件」提示', async () => {
    const html = await buildAttachmentContentHTML([{ name: '坏的文档.docx', index: 0 }], async () => null, async () => null);
    expect(html).toContain('正文转换失败');
  });

  it('buildAttachmentContentHTML：图片附件转 dataURL，原件缺失时给出提示', async () => {
    const pngBytes = new Uint8Array([137, 80, 78, 71]);
    const html = await buildAttachmentContentHTML(
      [{ name: '照片.png', index: 0 }, { name: '丢失的图片.jpg', index: 1 }],
      async (i) => (i === 0 ? new Blob([pngBytes], { type: 'application/octet-stream' }) : null),
    );
    expect(html).toContain('data:image/png;base64');
    expect(html).toContain('附件原件缺失');
  });
});

describe('条款模板多选合并（用户 2026-10-17 要求）', () => {
  it('mergeClauses：追加不覆盖、重复跳过、空条款忽略', () => {
    const existing = [{ title: '第一条 用途', content: '仅用于居住。' }];
    const incoming = [
      { title: '第一条 用途', content: '仅用于居住。' },        // 重复 → 跳过
      { title: '第二条 租金', content: '月租金 3000 元。' },
      { title: '', content: '' },                                // 空 → 忽略
      { title: '第三条 押金', content: '押金 3000 元。' },
    ];
    const r = mergeClauses(existing, incoming as any);
    expect(r.added).toBe(2);
    expect(r.list.length).toBe(3);
    expect(r.list[0].title).toBe('第一条 用途');
    expect(r.list.map((c) => c.title)).toEqual(['第一条 用途', '第二条 租金', '第三条 押金']);
    expect(r.list.map((c) => c.sortOrder)).toEqual([0, 1, 2]);
  });

  it('mergeClauses：同一模板勾选两次不会重复并入；标题相同内容不同视为不同条款', () => {
    const tpl = [{ title: '第一条 用途', content: '仅用于居住。' }, { title: '第二条 租金', content: '月租金 3000 元。' }];
    const once = mergeClauses([], tpl as any);
    const twice = mergeClauses(once.list, [...tpl, ...tpl] as any);
    expect(once.added).toBe(2);
    expect(twice.added).toBe(0);
    expect(twice.list.length).toBe(2);
    const other = mergeClauses(once.list, [{ title: '第一条 用途', content: '可用于仓储。' }] as any);
    expect(other.added).toBe(1);
    expect(other.list.length).toBe(3);
  });

  it('mergeClauses：空入参安全返回空列表', () => {
    expect(mergeClauses([], []).list).toEqual([]);
    expect(mergeClauses([], []).added).toBe(0);
  });
});

describe('附件分组与打印附件目录（用户 2026-10-16：第 ⑪ 项）', () => {
  it('groupAttachments：具名分组按预设顺序、自定义分组居中、未分组排最后，组内保持原顺序', () => {
    const list = [
      { name: 'c.pdf', group: '' },
      { name: 'a.pdf', group: '财务类' },
      { name: 'b.pdf', group: '证件类' },
      { name: 'd.pdf', group: '自定义组' },
      { name: 'e.pdf', group: '证件类' },
    ];
    const grouped = groupAttachments(list);
    expect(grouped.map((g) => g.group)).toEqual(['证件类', '财务类', '自定义组', '未分组']);
    expect(grouped[0].items.map((x) => x.item.name)).toEqual(['b.pdf', 'e.pdf']);
    expect(grouped[3].items.map((x) => x.item.name)).toEqual(['c.pdf']);
    // 索引仍指向原数组位置，便于排序时定位
    expect(grouped[0].items[0].index).toBe(2);
    expect(ATTACHMENT_GROUPS).toContain('证件类');
    expect(groupAttachments([])).toEqual([]);
  });

  it('打印：附件目录按分组列出、编号跨组连续、独立成页、末尾标注件数与签字位', () => {
    const base: any = {
      contractNo: 'HT-ATT-002', propertyName: 'A栋101', propertyAddress: '示例路1号', propertyArea: 88,
      tenantName: '张三', startDate: '2026-01-01', endDate: '2026-12-31', rentAmount: 3000, depositAmount: 3000,
      paymentCycle: '月', status: '已签订', notes: '', companyName: '回归测试物业公司', clauses: [],
      attachments: [
        { name: 'id.pdf', title: '身份证复印件', group: '证件类' },
        { name: 'handover.pdf', title: '房屋交接单', group: '交接类' },
        { name: 'misc.pdf', title: '其他材料' },
      ],
    };
    const html = buildContractHTML(base);
    expect(html).toContain('附件目录');
    expect(html).toContain('page-break-before:always');
    expect(html).toContain('附件共 3 件');
    for (const kw of ['证件类', '交接类', '未分组', '附件1', '附件2', '附件3']) expect(html).toContain(kw);
    // 分组顺序：证件类 → 交接类 → 未分组
    expect(html.indexOf('>证件类<')).toBeLessThan(html.indexOf('>交接类<'));
    expect(html.indexOf('>交接类<')).toBeLessThan(html.indexOf('>未分组<'));
    // 编号跨组连续：身份证复印件是附件1
    expect(html).toMatch(/附件1[\s\S]*身份证复印件/);
  });

  it('打印：附件只有 path 没有 name 时用文件名兜底，绝不出现空行（用户 2026-10-17 反馈）', () => {
    const html = buildContractHTML({
      contractNo: 'HT-ATT-004', propertyName: 'A栋101', propertyAddress: '示例路1号', propertyArea: 88,
      tenantName: '张三', startDate: '2026-01-01', endDate: '2026-12-31', rentAmount: 3000, depositAmount: 3000,
      paymentCycle: '月', status: '已签订', notes: '', companyName: '回归测试物业公司', clauses: [],
      attachments: [{ path: 'uploads/contracts/abc123' } as any, { name: '', title: '', path: '' } as any],
    } as any);
    expect(html).toContain('附件目录');
    expect(html).toContain('abc123'.slice(0, 3));   // path 的文件名兜底
    expect(html).toContain('未命名附件');             // 连 path 都没有时兜底文案
    expect(html).toContain('附件共 2 件');
  });

  it('打印：都没有分组时不出现分组小标题，只有连续编号', () => {
    const html = buildContractHTML({
      contractNo: 'HT-ATT-003', propertyName: 'A栋101', propertyAddress: '示例路1号', propertyArea: 88,
      tenantName: '张三', startDate: '2026-01-01', endDate: '2026-12-31', rentAmount: 3000, depositAmount: 3000,
      paymentCycle: '月', status: '已签订', notes: '', companyName: '回归测试物业公司', clauses: [],
      attachments: [{ name: 'a.pdf' }, { name: 'b.pdf' }],
    } as any);
    expect(html).toContain('附件目录');
    expect(html).toContain('附件1');
    expect(html).toContain('附件2');
    expect(html).not.toContain('未分组');
  });
});
