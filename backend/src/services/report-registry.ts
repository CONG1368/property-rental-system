// 报表目录 — 统一报表引擎：所有报表的元数据(标题/端点/类型/角色/推荐)集中于此
// 新增报表只需在此追加一条定义，前端报表中心自动加载并渲染。

export interface ReportDef {
  key: string;
  title: string;
  desc: string;
  endpoint?: string;
  type: string;                 // 'balance' | 'income' | 'cashflow' | 'custom' | 'briefing'
  params?: Record<string, string>;
  chart?: string;
  link?: string;
  roles: string[];              // 可见角色
  recommended: string[];        // 推荐角色(首页高亮)
}

const admin = '管理员'; const gm = '总经理';
const fin = ['财务主管', '会计', '出纳'];

export function getReportCatalog(): ReportDef[] {
  return [
    { key: 'balance-sheet', title: '资产负债表', desc: '资产/负债/权益汇总', endpoint: '/reports/balance-sheet', type: 'balance', roles: ['管理员', ...fin, gm], recommended: [] },
    { key: 'income-statement', title: '利润表', desc: '收入/成本/利润明细', endpoint: '/reports/income-statement', type: 'income', roles: ['管理员', ...fin, gm], recommended: [] },
    { key: 'cash-flow', title: '现金流量表', desc: '经营/投资/筹资现金流', endpoint: '/reports/cash-flow', type: 'cashflow', roles: ['管理员', ...fin, gm], recommended: [] },
    { key: 'rent-summary', title: '收租汇总表', desc: '按业态汇总收租', endpoint: '/reports/custom', type: 'custom', params: { type: 'rent-summary' }, roles: ['管理员', '收租主管', '收租员', gm], recommended: ['收租主管'] },
    { key: 'arrears-detail', title: '欠费明细表', desc: '欠费租客明细', endpoint: '/reports/custom', type: 'custom', params: { type: 'arrears-detail' }, roles: ['管理员', '收租主管', '收租员', gm], recommended: ['管理员', '收租员'] },
    { key: 'cost-analysis', title: '成本分析表', desc: '费用结构分析', endpoint: '/reports/custom', type: 'custom', params: { type: 'cost-analysis' }, roles: ['管理员', ...fin, gm], recommended: ['会计'] },
    { key: 'collection-rate', title: '收缴率分析', desc: '应收/实收/收缴率按月（含项目业态钻取）', endpoint: '/reports/custom', type: 'custom', params: { type: 'collection-rate' }, chart: 'collection', roles: ['管理员', '收租主管', '收租员', gm], recommended: ['管理员', '总经理', '收租主管'] },
    { key: 'occupancy', title: '入驻率', desc: '分业态入驻率', endpoint: '/reports/occupancy-report', type: 'custom', roles: ['管理员', '收租主管', gm], recommended: [] },
    { key: 'aging', title: '账龄分析', desc: '欠费账龄分桶', endpoint: '/reports/aging-report', type: 'custom', roles: ['管理员', '收租主管', gm], recommended: [] },
    { key: 'energy', title: '能耗分析', desc: '水电气用量/金额按月', endpoint: '/reports/custom', type: 'custom', params: { type: 'energy-analysis' }, chart: 'energy', roles: ['管理员', '物业经理', '维修工', gm], recommended: ['管理员', '物业经理'] },
    { key: 'revenue', title: '收益预测', desc: '分业态租金收益/年化', endpoint: '/reports/custom', type: 'custom', params: { type: 'revenue-forecast' }, chart: 'revenue', roles: [admin, gm, '物业经理'], recommended: ['管理员', '总经理'] },
    { key: 'work-order-cost', title: '工单成本分析', desc: '工单/维保成本', endpoint: '/reports/custom', type: 'custom', params: { type: 'work-order-cost' }, chart: 'cost', roles: [admin, gm, '物业经理'], recommended: [] },
    { key: 'tenant-retention', title: '租户留存', desc: '合同状态/到期/租期概览', endpoint: '/reports/custom', type: 'custom', params: { type: 'tenant-retention' }, roles: [admin, gm, '收租主管'], recommended: [] },
    { key: 'budget-vs-actual', title: '预算偏差', desc: '预算 vs 实际', endpoint: '/reports/custom', type: 'custom', params: { type: 'budget-vs-actual' }, chart: 'budget', roles: ['管理员', ...fin, gm], recommended: ['管理员', '财务主管'] },
    { key: 'cashflow-forecast', title: '现金流预测', desc: '未来6月现金收支预测', endpoint: '/reports/custom', type: 'custom', params: { type: 'cashflow-forecast' }, chart: 'cashflow', roles: ['管理员', ...fin, gm], recommended: ['管理员', '财务主管'] },
    { key: 'briefing', title: '经营简报', desc: '物业运营月度简报（可导出文字 PDF）', type: 'briefing', link: '/property/business-briefing', roles: [admin, gm, '物业经理', '财务主管'], recommended: [gm] },
  ];
}
