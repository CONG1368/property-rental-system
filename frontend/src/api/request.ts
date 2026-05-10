import axios from 'axios';
import type { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { ElMessage } from 'element-plus';

const request: AxiosInstance = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

request.interceptors.request.use((config: any) => {
  const token = localStorage.getItem('accessToken');
  if (token && config.headers) {
    config.headers['Authorization'] = 'Bearer ' + token;
  }
  return config;
});

request.interceptors.response.use(
  (response: AxiosResponse) => {
    if (response.data.code !== 200 && response.data.code !== undefined) {
      ElMessage.error(response.data.message || '请求失败');
      return Promise.reject(new Error(response.data.message));
    }
    return response.data;
  },
  async (error) => {
    if (error.response?.status === 401) {
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        try {
          const res = await axios.post('/api/auth/refresh', { refreshToken });
          localStorage.setItem('accessToken', res.data.data.accessToken);
          error.config.headers['Authorization'] = 'Bearer ' + res.data.data.accessToken;
          return request(error.config);
        } catch {
          localStorage.clear();
          window.location.hash = '#/login';
        }
      } else {
        localStorage.clear();
        window.location.hash = '#/login';
      }
    }
    ElMessage.error(error.response?.data?.message || '网络错误');
    return Promise.reject(error);
  }
);

export default request;
