import { defineStore } from 'pinia';
import { ref } from 'vue';
import { login as apiLogin, logout as apiLogout } from '@/api/auth';

interface UserInfo {
  id: number; username: string; displayName: string;
  role: string; permissions: any;
}

/** 从 JWT Token 解码用户信息（无需 API 调用，Token 中已包含） */
// base64url → UTF-8 字符串（处理中文等非 ASCII 字符）
function base64urlDecode(str: string): string {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder('utf-8').decode(bytes);
}

function parseUserFromToken(token: string): UserInfo | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(base64urlDecode(parts[1]));
    if (import.meta.env.DEV) console.log('[AuthStore] parseUserFromToken payload:', JSON.stringify(payload));
    if (payload.userId && payload.role) {
      return {
        id: payload.userId,
        username: payload.username || '',
        displayName: payload.displayName || payload.username || '',
        role: payload.role,
        permissions: payload.permissions || {},
      };
    }
    if (import.meta.env.DEV) console.warn('[AuthStore] parseUserFromToken: missing userId or role in payload', payload);
  } catch (e) { console.error('[AuthStore] parseUserFromToken error:', import.meta.env.DEV ? e : (e instanceof Error ? e.message : 'unknown')); }
  return null;
}

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem('accessToken') || '');
  const user = ref<UserInfo | null>(null);

  // 启动时从 localStorage 恢复用户信息
  // parseUserFromToken 可能因 JWT 格式不匹配而失败，回退到直接解析 role
  if (token.value) {
    const restored = parseUserFromToken(token.value);
    if (restored) {
      user.value = restored;
      localStorage.setItem('userRole', restored.role);
    } else {
      // fallback: 直接从 JWT 提取 role，构造最小用户对象
      try {
        const parts = token.value.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(base64urlDecode(parts[1]));
          if (payload.role) {
            user.value = {
              id: payload.userId || 0,
              username: payload.username || '',
              displayName: payload.displayName || payload.username || '',
              role: payload.role,
              permissions: payload.permissions || {},
            };
            localStorage.setItem('userRole', payload.role);
          }
        }
      } catch { /* ignore */ }
    }
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
