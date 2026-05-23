/**
 * 健康检查 — 使用原生 fetch 绕过 axios 拦截器和认证中间件。
 * 用于登录页判断后端是否已就绪。
 */
export async function checkHealth(): Promise<boolean> {
  const url = import.meta.env.PROD
    ? 'http://localhost:3001/api/health'
    : '/api/health';
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (resp.ok) {
      const data = await resp.json();
      return data?.data?.status === 'ok';
    }
    return false;
  } catch {
    return false;
  }
}
