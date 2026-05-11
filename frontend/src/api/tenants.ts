import request from './request';
export function getTenants(params: any) { return request.get('/tenants', { params }); }
export function getTenant(id: number) { return request.get('/tenants/' + id); }
export function createTenant(data: any) { return request.post('/tenants', data); }
export function updateTenant(id: number, data: any) { return request.put('/tenants/' + id, data); }
export function deleteTenant(id: number) { return request.delete('/tenants/' + id); }
export function checkIn(id: number) { return request.post('/tenants/' + id + '/check-in'); }
export function checkOut(id: number) { return request.post('/tenants/' + id + '/check-out'); }
