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

// 错误消息去重 — 相同消息 3 秒内不重复弹出
let lastErrorMsg = '';
let lastErrorTime = 0;
function showErrorOnce(msg: string) {
  if (msg !== lastErrorMsg || Date.now() - lastErrorTime > 3000) {
    lastErrorMsg = msg;
    lastErrorTime = Date.now();
    ElMessage.error(msg);
  }
}

request.interceptors.response.use(
  (response: AxiosResponse) => {
    if (response.data.code !== 200 && response.data.code !== undefined) {
      if (!(response.config as any).silent) {
        showErrorOnce(response.data.message || '请求失败');
      }
      return Promise.reject(new Error(response.data.message));
    }
    return response.data;
  },
  async (error) => {
    if (error.response?.status === 401) {
      const isAuthRequest = error.config?.url?.includes('/auth/login') || error.config?.url?.includes('/auth/refresh');
      if (isAuthRequest) {
        return Promise.reject(error);
      }
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
    if (!(error.config as any)?.silent) {
      showErrorOnce(error.response?.data?.message || '网络错误');
    }
    return Promise.reject(error);
  }
);

export default request;
