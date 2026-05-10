import { defineStore } from 'pinia';
import { ref } from 'vue';
import { login as apiLogin, logout as apiLogout } from '@/api/auth';

interface UserInfo {
  id: number; username: string; displayName: string;
  role: string; permissions: any;
}

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem('accessToken') || '');
  const user = ref<UserInfo | null>(null);

  function setToken(accessToken: string, refreshToken: string) {
    token.value = accessToken;
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
  }

  async function login(username: string, password: string) {
    const res = await apiLogin(username, password);
    setToken(res.data.accessToken, res.data.refreshToken);
    user.value = res.data.user;
    return res;
  }

  function clearAuth() {
    token.value = '';
    user.value = null;
    localStorage.clear();
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
