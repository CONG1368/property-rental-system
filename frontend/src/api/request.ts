import axios from 'axios';
import type { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { ElMessage } from 'element-plus';

// 开发模式走 Vite proxy，生产模式（Electron 打包）直连后端
export const apiBaseURL = import.meta.env.PROD ? 'http://localhost:3001/api' : '/api';

const request: AxiosInstance = axios.create({
  baseURL: apiBaseURL,
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
      // 登录/刷新接口的 401 直接透传，避免死循环（刷新接口失败不应再次刷新）
      const isAuthRequest = error.config?.url?.includes('/auth/login') || error.config?.url?.includes('/auth/refresh');
      if (isAuthRequest) {
        return Promise.reject(error);
      }
      // 非登录接口 401：尝试刷新 token，失败则清空登录态回到登录页
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        try {
          const res = await axios.post(`${apiBaseURL}/auth/refresh`, { refreshToken });
          localStorage.setItem('accessToken', res.data.data.accessToken);
          error.config.headers['Authorization'] = 'Bearer ' + res.data.data.accessToken;
          return request(error.config);
        } catch {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('userRole');
          window.location.hash = '#/login';
          return Promise.reject(error);
        }
      }
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('userRole');
      window.location.hash = '#/login';
      return Promise.reject(error);
    }
    ElMessage.error(error.response?.data?.message || '网络错误');
    return Promise.reject(error);
  }
);

export default request;
