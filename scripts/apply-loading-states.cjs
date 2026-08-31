
/**
 * 为列表页批量注入「首屏骨架屏 + 统一空态」（设计准则 Rule 5）
 * 用法：node scripts/apply-loading-states.cjs [--dry]
 * 规则：只处理文件中第一个 <el-table>，且要求其属性含 :data="简单变量"；
 *      含 v-loading="loading" 的表格额外注入 TableSkeleton + v-show。
 */
const fs = require('fs');
const path = require('path');
const DRY = process.argv.includes('--dry');
const ROOT = path.join(__dirname, '..', 'frontend', 'src', 'views');

// 已知页面的定制文案（未列出的用兜底文案）
const COPY = {
  'rent/BillList.vue': ['暂无账单', '可点击右上角「生成账单」按合同批量生成，或手动创建单张账单'],
  'rent/PropertyList.vue': ['暂无房源', '新增房源或使用批量导入，快速建立房源台账'],
  'rent/TenantList.vue': ['暂无租客', '新增租客后即可签订合同、生成账单'],
  'contract/ContractList.vue': ['暂无合同', '从「合同起草」创建新合同，或调整筛选条件重试'],
  'rent/WorkOrderList.vue': ['暂无工单', '住户报修或巡检发现问题后，工单会显示在这里'],
  'finance/VoucherList.vue': ['暂无凭证', '业务单据审核通过后自动生成凭证，也可手工录入'],
  'finance/ExpenseList.vue': ['暂无费用单', '新增费用后将进入审批流程，大额费用需上级审批'],
  'rent/DoorLockList.vue': ['暂无门锁设备', '登记智能门锁或传统门锁后，可在此统一管理密码与钥匙'],
  'rent/DunningCenter.vue': ['暂无催缴任务', '账单逾期后系统会自动生成催缴任务'],
  'fire/FireEquipmentList.vue': ['暂无消防器材', '登记灭火器、应急照明灯等器材后可跟踪有效期与状态'],
  'rent/DepositList.vue': ['暂无押金记录', '合同签订并收取押金后，台账会在此显示'],
  'rent/CheckoutList.vue': ['暂无退租单', '发起退租流程后可在此跟踪交接与押金结算'],
  'rent/MeterReading.vue': ['暂无抄表记录', '录入水电表读数后自动生成用量与费用'],
  'rent/ParkingList.vue': ['暂无车位', '登记车位后可管理租售与进出记录'],
  'rent/ComplaintList.vue': ['暂无投诉建议', '住户提交的投诉与建议会汇总到这里'],
  'rent/FacilityList.vue': ['暂无设施设备', '登记设备后可制定维保计划并跟踪执行'],
  'rent/LeadList.vue': ['暂无招租线索', '录入意向客户后可跟进带看与成交'],
  'rent/ResidentList.vue': ['暂无住户档案', '录入业主/住户信息，便于通知与服务'],
  'rent/AnnouncementList.vue': ['暂无公告', '发布公告后可推送给指定楼栋或全部住户'],
  'rent/VendorList.vue': ['暂无供应商', '登记外包供应商后可关联工单与结算'],
  'rent/InventoryList.vue': ['暂无物料', '登记仓库物料后可跟踪出入库与库存'],
  'rent/CommonRevenueList.vue': ['暂无公共收益', '录入广告位、场地租赁等公共收益记录'],
  'finance/InvoiceList.vue': ['暂无发票', '开票申请通过后发票会显示在这里'],
  'finance/FixedAssetList.vue': ['暂无固定资产', '登记资产后系统按月自动计提折旧'],
  'finance/BudgetList.vue': ['暂无预算', '编制预算并提交审批后可跟踪执行进度'],
  'contract/TemplateList.vue': ['暂无合同模板', '创建模板可在起草合同时一键套用条款'],
  'fire/FireInspectionList.vue': ['暂无检查记录', '开展消防检查后记录会在此汇总'],
  'fire/FireViolationList.vue': ['暂无违规记录', '检查发现隐患后生成整改单并跟踪闭环'],
  'fire/FireDrillList.vue': ['暂无演练记录', '组织消防演练后录入参与人数与评分'],
  'system/AuditLog.vue': ['暂无审计日志', '系统会记录敏感操作的成功、失败与越权尝试'],
  'system/DictList.vue': ['暂无字典项', '新增字典类型与条目，统一维护下拉选项'],
};
const FALLBACK = ['暂无数据', '调整筛选条件或新增记录后，数据会显示在这里'];

function findTagEnd(s, from) {
  let quote = null;
  for (let i = from; i < s.length; i++) {
    const ch = s[i];
    if (quote) { if (ch === quote) quote = null; continue; }
    if (ch === '"' || ch === "'") { quote = ch; continue; }
    if (ch === '>') return i;
  }
  return -1;
}
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.vue')) out.push(p);
  }
  return out;
}

const applied = [], skipped = [];
for (const file of walk(ROOT)) {
  const rel = path.relative(ROOT, file).split(path.sep).join('/');
  let s = fs.readFileSync(file, 'utf8');
  if (s.includes('<EmptyState') || s.includes('<TableSkeleton')) { skipped.push(rel + ' (已处理)'); continue; }

  const start = s.indexOf('<el-table');
  if (start < 0) continue;                                  // 非表格页，静默跳过
  const tagEnd = findTagEnd(s, start);
  const close = s.indexOf('</el-table>', tagEnd);
  if (tagEnd < 0 || close < 0) { skipped.push(rel + ' (标签解析失败)'); continue; }

  const tag = s.slice(start, tagEnd + 1);
  const dataMatch = tag.match(/:data="([A-Za-z_$][\w$.?]*)"/);
  if (!dataMatch) { skipped.push(rel + ' (data 非简单变量)'); continue; }
  const dataVar = dataMatch[1];
  const hasLoading = /v-loading="loading"/.test(tag);
  const [title, desc] = COPY[rel] || FALLBACK;

  const lineStart = s.lastIndexOf('\n', start) + 1;
  const indent = s.slice(lineStart, start).match(/^\s*/)[0];

  if (!DRY) {
    const emptySlot = indent + '  <template #empty>\n'
      + indent + '    <EmptyState title="' + title + '" description="' + desc + '" />\n'
      + indent + '  </template>\n' + indent;
    s = s.slice(0, close) + emptySlot + s.slice(close);
    if (hasLoading) {
      const cond = 'loading && !' + dataVar + '.length';
      s = s.slice(0, start + 9) + ' v-show="!(' + cond + ')"' + s.slice(start + 9);
      s = s.slice(0, start) + '<TableSkeleton v-if="' + cond + '" :rows="8" :columns="7" />\n' + indent + s.slice(start);
    }
    fs.writeFileSync(file, s);
  }
  applied.push(rel + (hasLoading ? ' [骨架+空态]' : ' [空态]'));
}
console.log((DRY ? '[预演] ' : '') + '注入页面 ' + applied.length + ' 个：');
applied.forEach(a => console.log('  - ' + a));
if (skipped.length) { console.log('跳过 ' + skipped.length + ' 个：'); skipped.forEach(a => console.log('  · ' + a)); }
