import { defineStore } from 'pinia';
import { ref } from 'vue';
import { login as apiLogin, logout as apiLogout } from '@/api/auth';

interface UserInfo {
  id: number; username: string; displayName: string;
  role: string; permissions: any;
}

/** 从 JWT Token 解码用户信息（无需 API 调用，Token 中已包含） */
function parseUserFromToken(token: string): UserInfo | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (payload.userId && payload.role) {
      return {
        id: payload.userId,
        username: payload.username || '',
        displayName: payload.displayName || payload.username || '',
        role: payload.role,
        permissions: payload.permissions || {},
      };
    }
  } catch { /* token 解析失败 */ }
  return null;
}

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem('accessToken') || '');
  const user = ref<UserInfo | null>(null);

  // 启动时从 localStorage 恢复用户信息
  if (token.value && !user.value) {
    const restored = parseUserFromToken(token.value);
    if (restored) user.value = restored;
  }

  function setToken(accessToken: string, refreshToken: string) {
    token.value = accessToken;
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    const u = parseUserFromToken(accessToken);
    if (u) {
      user.value = u;
      localStorage.setItem('userRole', u.role); // 供路由守卫使用
    }
  }

  async function login(username: string, password: string) {
    const res = await apiLogin(username, password);
    setToken(res.data.accessToken, res.data.refreshToken);
    // 优先使用 API 返回的完整 user 对象，否则从 token 解析
    user.value = res.data.user || parseUserFromToken(res.data.accessToken);
    return res;
  }

  function clearAuth() {
    token.value = '';
    user.value = null;
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('userRole');
  }

  async function logout() {
    try { await apiLogout(); } catch { /* ignore */ }
    clearAuth();
    window.location.hash = '#/login';
  }

  function isLoggedIn() {
    return !!token.value;
  }

  return { token, user, login, logout, clearAuth, isLoggedIn, setToken };
});
