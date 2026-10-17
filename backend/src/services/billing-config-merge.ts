/**
 * billingConfig 合并（用户 2026-10-17 反馈：起草页保存后已上传附件消失、打印时没有附件目录）。
 *
 * 背景：合同更新接口曾把请求里的 billingConfig **整段覆盖**到库里。起草页保存时前端只回传
 * 表单相关字段（不含 attachments），于是「上传附件 → 保存/提交审批」会把附件列表整段清空。
 *
 * 规则：以库里的为基底，用请求里的覆盖；但**服务端托管的键**（附件列表、待审核箱、电子签流程）
 * 若请求里没带，则保留库里的值——这些键只由各自的专用端点维护，前端表单不该也无法负责。
 */
export const SERVER_MANAGED_BILLING_KEYS = ['attachments', 'attachmentInbox', 'eSignFlowId'] as const;

export function mergeBillingConfig(existing: any, incoming: any): any {
  const base = existing && typeof existing === 'object' && !Array.isArray(existing) ? { ...existing } : {};
  const next = incoming && typeof incoming === 'object' && !Array.isArray(incoming) ? { ...incoming } : { ...base };
  for (const key of SERVER_MANAGED_BILLING_KEYS) {
    if (!(key in next) && key in base) next[key] = base[key];
  }
  return next;
}
