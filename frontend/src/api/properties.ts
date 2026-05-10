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
