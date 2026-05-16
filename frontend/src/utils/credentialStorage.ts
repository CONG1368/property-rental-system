/**
 * 凭证存储 — XOR 混淆 + base64 编码
 * 适用于本地 Electron 桌面应用的安全级别
 * 用于"记住密码"功能：存储用户名和密码供下次启动预填表单
 */

const CREDENTIAL_KEY = 'saved_credentials';
const OBFUSCATE_KEY = 'prms-2026-lease';

function obfuscate(text: string): string {
  const bytes = new TextEncoder().encode(text);
  const keyBytes = new TextEncoder().encode(OBFUSCATE_KEY);
  const result = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    result[i] = bytes[i] ^ keyBytes[i % keyBytes.length];
  }
  return btoa(String.fromCharCode(...result));
}

function deobfuscate(encoded: string): string {
  const bytes = new Uint8Array(
    atob(encoded).split('').map(c => c.charCodeAt(0))
  );
  const keyBytes = new TextEncoder().encode(OBFUSCATE_KEY);
  const result = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    result[i] = bytes[i] ^ keyBytes[i % keyBytes.length];
  }
  return new TextDecoder().decode(result);
}

export function saveCredentials(username: string, password: string): void {
  const data = obfuscate(JSON.stringify({ username, password }));
  localStorage.setItem(CREDENTIAL_KEY, data);
}

export function loadCredentials(): { username: string; password: string } | null {
  try {
    const data = localStorage.getItem(CREDENTIAL_KEY);
    if (!data) return null;
    return JSON.parse(deobfuscate(data));
  } catch {
    clearCredentials();
    return null;
  }
}

export function clearCredentials(): void {
  localStorage.removeItem(CREDENTIAL_KEY);
}
