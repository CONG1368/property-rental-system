import { apiBaseURL } from '@/api/request';

/**
 * 带鉴权地下载后端文件（CSV/PDF/备份等），并保存为本地文件。
 * 用途：window.open 对新标签页不会携带 Authorization Bearer 头，会被后端 authMiddleware 401 拦截；
 * 这里改用 fetch + 请求头 + blob 下载，并兼容 Electron 生产环境（apiBaseURL 动态解析）。开发/生产均安全。
 *
 * @param urlPath 后端相对路径或完整路径（会基于 apiBaseURL 拼接，传完整 http(s):// 则原样使用）
 * @param params  附加查询参数（如 confirmPassword、筛选条件）
 * @param filename 期望保存的文件名（后端 Content-Disposition 优先，此值作为兜底）
 */
export async function downloadWithAuth(
  urlPath: string,
  params?: Record<string, string>,
  filename = 'download',
): Promise<void> {
  const token = localStorage.getItem('accessToken') || '';
  // 支持传完整路径；相对路径基于 apiBaseURL 拼接
  const base = /^https?:///.test(urlPath) ? urlPath : apiBaseURL;
  const full = new URL(base + urlPath, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') full.searchParams.set(k, v);
    });
  }

  const resp = await fetch(full.toString(), {
    headers: token ? { Authorization: 'Bearer ' + token, Accept: 'application/octet-stream, text/csv, */*' } : { Accept: 'application/octet-stream, text/csv, */*' },
  });

  if (!resp.ok) {
    // 尝试解析后端 { code, message } 错误
    let msg = '下载失败';
    try {
      const j = await resp.json();
      if (j?.message) msg = j.message;
    } catch { /* 非 JSON 响应 */ }
    throw new Error(msg);
  }

  // 尝试从 Content-Disposition 提取文件名
  const cd = resp.headers.get('Content-Disposition') || '';
  const fnMatch = cd.match(/filename*?=(?:UTF-8'')?"?([^";]+)"?/i);
  const name = fnMatch ? decodeURIComponent(fnMatch[1]).replace(/"/g, '') : filename;

  const blob = await resp.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
