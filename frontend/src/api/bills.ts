import request from './request';
export function getBills(params: any) { return request.get('/bills', { params }); }
export function getBill(id: number) { return request.get('/bills/' + id); }
export function createBill(data: any) { return request.post('/bills', data); }
export function payBill(id: number, data: any) { return request.post('/bills/' + id + '/pay', data); }
export function getBillCalendar(params: any) { return request.get('/bills/calendar', { params }); }
export function generateBills() { return request.post('/bills/generate'); }
