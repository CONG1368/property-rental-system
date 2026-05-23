import request from './request';

export function getProperties(params: any) {
  return request.get('/properties', { params });
}

export function getProperty(id: number) {
  return request.get('/properties/' + id);
}

export function createProperty(data: any) {
  return request.post('/properties', data);
}

export function updateProperty(id: number, data: any) {
  return request.put('/properties/' + id, data);
}

export function deleteProperty(id: number) {
  return request.delete('/properties/' + id);
}

export function importProperties(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  return request.post('/properties/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}

// 房态看板
export function getRoomKanban(params?: any) {
  return request.get('/properties/rooms/kanban', { params });
}

export function getRoomStats() {
  return request.get('/properties/rooms/stats');
}

export function getRoomAnalytics() {
  return request.get('/properties/rooms/analytics');
}

// 批量生成房间
export function batchGenerateRooms(data: any) {
  return request.post('/properties/rooms/batch-generate', data);
}

// 批量更新房态
export function batchUpdateRoomStatus(data: any) {
  return request.patch('/properties/rooms/batch-status', data);
}

// 房源状态变更日志
export function getRoomStatusLogs(propertyId: number) {
  return request.get(`/properties/${propertyId}/status-logs`);
}

// 更新房源状态（走状态机）
export function updatePropertyStatus(propertyId: number, status: string, notes?: string) {
  return request.patch(`/properties/${propertyId}/status`, { status, notes });
}

// 导出房态报表（Excel）— 返回 Blob
export function exportRoomReport(params?: any) {
  return request.get('/properties/rooms/export', { params, responseType: 'blob' as any });
}

// 导出房态报表（PDF）— 返回 JSON 数据供前端生成 PDF
export function exportRoomReportPDF(params?: any) {
  return request.get('/properties/rooms/export', { params: { ...params, format: 'pdf' } });
}
