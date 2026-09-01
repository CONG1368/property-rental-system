import { Op } from 'sequelize';
import Property from '../models/Property.js';
import Tenant from '../models/Tenant.js';
import Contract from '../models/Contract.js';
import Bill from '../models/Bill.js';
import Lead from '../models/Lead.js';
import WorkOrder from '../models/WorkOrder.js';
import Complaint from '../models/Complaint.js';
import Resident from '../models/Resident.js';

export interface SearchGroup { group: string; items: { label: string; id: number; route: string }[] }

export async function globalSearch(q: string): Promise<SearchGroup[]> {
  const kw = `%${q}%`;
  const out: SearchGroup[] = [];
  const LIMIT = 5;
  const push = (group: string, rows: { label: string; id: number; route: string }[]) => { if (rows.length) out.push({ group, items: rows }); };

  const props = await Property.findAll({ where: { [Op.or]: [{ name: { [Op.like]: kw } }, { address: { [Op.like]: kw } }] }, limit: LIMIT });
  push('房源', props.map((p: any) => ({ label: p.name, id: p.id, route: '/rent/properties/' + p.id })));

  const tenants = await Tenant.findAll({ where: { [Op.or]: [{ name: { [Op.like]: kw } }, { phone: { [Op.like]: kw } }] }, limit: LIMIT });
  push('租客', tenants.map((t: any) => ({ label: t.name + '（' + (t.phone || '') + '）', id: t.id, route: '/rent/tenants/' + t.id })));

  const contracts = await Contract.findAll({ where: { [Op.or]: [{ contractNo: { [Op.like]: kw } }] }, limit: LIMIT });
  push('合同', contracts.map((c: any) => ({ label: c.contractNo, id: c.id, route: '/contract/detail/' + c.id })));

  const bills = await Bill.findAll({ where: { [Op.or]: [{ billNo: { [Op.like]: kw } }] }, limit: LIMIT });
  push('账单', bills.map((b: any) => ({ label: b.billNo + '（' + b.period + '）', id: b.id, route: '/rent/bills' })));

  const leads = await Lead.findAll({ where: { [Op.or]: [{ name: { [Op.like]: kw } }, { phone: { [Op.like]: kw } }] }, limit: LIMIT });
  push('招租线索', leads.map((l: any) => ({ label: l.name + '（' + (l.phone || '') + '）', id: l.id, route: '/rent/leads' })));

  const wos = await WorkOrder.findAll({ where: { [Op.or]: [{ title: { [Op.like]: kw } }, { ticketNo: { [Op.like]: kw } }] }, limit: LIMIT });
  push('工单', wos.map((w: any) => ({ label: w.ticketNo + ' ' + w.title, id: w.id, route: '/property/work-orders' })));

  const complaints = await Complaint.findAll({ where: { [Op.or]: [{ title: { [Op.like]: kw } }] }, limit: LIMIT });
  push('投诉', complaints.map((c: any) => ({ label: c.title, id: c.id, route: '/property/complaints' })));

  const residents = await Resident.findAll({ where: { [Op.or]: [{ name: { [Op.like]: kw } }] }, limit: LIMIT });
  push('住户', residents.map((r: any) => ({ label: r.name, id: r.id, route: '/property/residents' })));

  return out;
}
