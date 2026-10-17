import { describe, it, expect } from 'vitest';
import { mergeBillingConfig, SERVER_MANAGED_BILLING_KEYS } from '../src/services/billing-config-merge.js';

/**
 * billingConfig 合并（用户 2026-10-17 反馈）：起草页保存/提交审批时前端只回传表单字段，
 * 曾把已上传的 attachments 整段覆盖清空，导致「上传成功但打印合同后面没有附件目录」。
 */
describe('mergeBillingConfig：服务端托管的附件键不会被前端保存覆盖', () => {
  it('请求里没带 attachments 时保留库里的附件（核心回归）', () => {
    const existing = { feeItems: [], attachments: [{ name: 'a.pdf', path: '/x/a.pdf' }], attachmentInbox: [{ name: 'b.pdf' }], eSignFlowId: 'FLOW-1' };
    const incoming = { feeItems: [{ name: '水费' }], taxType: '含税' };
    const merged = mergeBillingConfig(existing, incoming);
    expect(merged.attachments).toHaveLength(1);
    expect(merged.attachments[0].name).toBe('a.pdf');
    expect(merged.attachmentInbox).toHaveLength(1);
    expect(merged.eSignFlowId).toBe('FLOW-1');
    // 表单字段按请求覆盖
    expect(merged.taxType).toBe('含税');
    expect(merged.feeItems).toHaveLength(1);
  });

  it('请求里显式带了 attachments 时以请求为准（删除附件走专用接口，但仍允许显式覆盖）', () => {
    const existing = { attachments: [{ name: 'old.pdf' }] };
    const merged = mergeBillingConfig(existing, { attachments: [{ name: 'new.pdf' }] });
    expect(merged.attachments[0].name).toBe('new.pdf');
  });

  it('库为空/请求为空/非法入参都不报错', () => {
    expect(mergeBillingConfig(undefined, { a: 1 })).toEqual({ a: 1 });
    expect(mergeBillingConfig({ attachments: [1] }, undefined)).toEqual({ attachments: [1] });
    expect(mergeBillingConfig(null as any, null as any)).toEqual({});
    expect(mergeBillingConfig({ x: 1 }, [1, 2] as any)).toEqual({ x: 1 });
    expect(SERVER_MANAGED_BILLING_KEYS).toContain('attachments');
  });
});
