import request from './request';

export function login(username: string, password: string) {
  return request.post('/auth/login', { username, password });
}

export function refreshToken(refreshToken: string) {
  return request.post('/auth/refresh', { refreshToken });
}

export function logout() {
  return request.post('/auth/logout');
}
