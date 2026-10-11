import request from './request';
export function getDunningTasks(params: any) { return request.get('/dunning/tasks', { params }); }
export function dispatchDunning(data: any) { return request.post('/dunning/dispatch', data); }
export function getDunningStrategy() { return request.get('/dunning/strategy'); }
export function updateDunningStrategy(data: any) { return request.put('/dunning/strategy', data); }
export function getArrearsAging() { return request.get('/dunning/aging'); }
