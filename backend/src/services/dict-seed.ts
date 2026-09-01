import DictType from '../models/DictType.js';
import DictItem from '../models/DictItem.js';
import FlowDefinition from '../models/FlowDefinition.js';

// 统一的业务枚举字典：把散落在各模块的业务枚举集中到数据字典进行统一管理
const DICTS: { code: string; name: string; items: { code: string; name: string }[] }[] = [
  { code: 'room_status', name: '房源状态', items: [
    { code: '空置', name: '空置' }, { code: '已锁定', name: '已锁定' }, { code: '已预订', name: '已预订' },
    { code: '已出租', name: '已出租' }, { code: '退租中', name: '退租中' }, { code: '待保洁', name: '待保洁' },
    { code: '待验收', name: '待验收' }, { code: '维修中', name: '维修中' }, { code: '已冻结', name: '已冻结' } ] },
  { code: 'work_order_type', name: '工单类型', items: [
    { code: '报修', name: '报修' }, { code: '维修', name: '维修' }, { code: '安装', name: '安装' }, { code: '保养', name: '保养' }, { code: '其他', name: '其他' } ] },
  { code: 'work_order_status', name: '工单状态', items: [
    { code: '待派单', name: '待派单' }, { code: '已派单', name: '已派单' }, { code: '处理中', name: '处理中' },
    { code: '待验收', name: '待验收' }, { code: '已完工', name: '已完工' }, { code: '已取消', name: '已取消' } ] },
  { code: 'complaint_type', name: '投诉类型', items: [
    { code: '投诉', name: '投诉' }, { code: '建议', name: '建议' }, { code: '咨询', name: '咨询' }, { code: '表扬', name: '表扬' } ] },
  { code: 'bill_status', name: '账单状态', items: [
    { code: '未缴', name: '未缴' }, { code: '部分缴', name: '部分缴' }, { code: '已缴', name: '已缴' }, { code: '逾期', name: '逾期' } ] },
  { code: 'payment_channel', name: '收费渠道', items: [
    { code: '现金', name: '现金' }, { code: '微信', name: '微信' }, { code: '支付宝', name: '支付宝' },
    { code: '银行转账', name: '银行转账' }, { code: '刷卡', name: '刷卡' } ] },
  { code: 'biz_type', name: '审批业务类型', items: [
    { code: '合同', name: '合同' }, { code: '预算', name: '预算' }, { code: '费用', name: '费用' },
    { code: '退租', name: '退租' }, { code: '装修', name: '装修' }, { code: '采购', name: '采购' } ] },
  { code: 'property_task_status', name: '物业任务状态', items: [
    { code: '待执行', name: '待执行' }, { code: '进行中', name: '进行中' }, { code: '已完成', name: '已完成' }, { code: '已逾期', name: '已逾期' } ] },
  { code: 'facility_category', name: '设备类别', items: [
    { code: '电梯', name: '电梯' }, { code: '水泵', name: '水泵' }, { code: '配电', name: '配电' }, { code: '空调', name: '空调' },
    { code: '消防', name: '消防' }, { code: '安防', name: '安防' }, { code: '给排水', name: '给排水' }, { code: '其他', name: '其他' } ] },
  { code: 'contract_status', name: '合同状态', items: [
    { code: '起草中', name: '起草中' }, { code: '审批中', name: '审批中' }, { code: '已驳回', name: '已驳回' }, { code: '已签订', name: '已签订' },
    { code: '执行中', name: '执行中' }, { code: '到期提醒', name: '到期提醒' }, { code: '已到期', name: '已到期' }, { code: '已终止', name: '已终止' } ] },
];

// 缺省审批流：为合同/预算预置两级审批流程（幂等）
const DEFAULT_FLOWS: { bizType: string; name: string; steps: { order: number; role: string; label: string }[] }[] = [
  { bizType: '合同', name: '合同默认审批流', steps: [{ order: 0, role: '合同主管', label: '初审' }, { order: 1, role: '总经理', label: '终审' }] },
  { bizType: '预算', name: '预算默认审批流', steps: [{ order: 0, role: '财务主管', label: '初审' }, { order: 1, role: '总经理', label: '终审' }] },
  { bizType: '费用', name: '大额费用审批流', steps: [{ order: 0, role: '财务主管', label: '财务初审' }, { order: 1, role: '总经理', label: '终审' }] },
];
export async function seedDefaultFlows(): Promise<number> {
  let n = 0;
  for (const f of DEFAULT_FLOWS) {
    const exist = await FlowDefinition.findOne({ where: { bizType: f.bizType, status: '启用' } });
    if (!exist) { await FlowDefinition.create({ name: f.name, bizType: f.bizType, steps: f.steps, status: '启用' } as any); n++; }
  }
  return n;
}

// 幂等种子：字典类型已存在则跳过
export async function seedBusinessDicts(): Promise<number> {
  let created = 0;
  for (const d of DICTS) {
    let type = await DictType.findOne({ where: { code: d.code } });
    if (!type) { type = await DictType.create({ code: d.code, name: d.name } as any); created++; }
    for (const it of d.items) {
      const exist = await DictItem.findOne({ where: { typeCode: d.code, code: it.code } });
      if (!exist) { await DictItem.create({ typeCode: d.code, code: it.code, name: it.name, sortOrder: 0 } as any); created++; }
    }
  }
  return created;
}
