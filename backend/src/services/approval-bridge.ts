import ApprovalRequest from '../models/ApprovalRequest.js';
import FlowDefinition from '../models/FlowDefinition.js';

// 通用审批桥接：按业务类型找到缺省流程并创建审批请求；无配置流程则跳过
export async function submitApproval(
  opts: { bizType: string; bizId?: number; bizNo?: string; title: string; applicantName?: string; amount?: number },
  userId?: number
): Promise<boolean> {
  const flow = await FlowDefinition.findOne({ where: { bizType: opts.bizType, status: '启用' } });
  if (!flow || !((flow as any).steps || []).length) return false;
  const steps = (flow as any).steps;
  await ApprovalRequest.create({
    bizType: opts.bizType, bizId: opts.bizId || null, bizNo: opts.bizNo || '', title: opts.title,
    applicantId: userId || null, applicantName: opts.applicantName || '', amount: Number(opts.amount || 0),
    status: '待审批', currentStep: 0, currentRole: steps[0].role, comment: '',
  } as any);
  return true;
}
