/**
 * 微信公众号模板消息 Provider
 * ------------------------------------------------------------------
 * 仅依赖全局 fetch（Node 18+ 内置），不引入任何微信 SDK。
 *
 * 能力：
 *   - access_token 获取与内存缓存（按 expires_in 提前 5 分钟过期）
 *   - 并发请求复用同一个 in-flight Promise，避免触发微信侧限流
 *   - 模板消息发送，errcode 非 0 返回失败并携带 errmsg
 *   - access_token 失效（40001 / 42001 / 40014）自动清缓存并重试一次
 *
 * 环境变量：
 *   WECHAT_APP_ID        公众号 AppID（必填）
 *   WECHAT_APP_SECRET    公众号 AppSecret（必填）
 *   WECHAT_TEMPLATE_ID   模板消息模板 ID（必填）
 *   WECHAT_API_TIMEOUT   接口超时毫秒数，默认 10000
 *   WECHAT_API_BASE      接口根地址，默认 https://api.weixin.qq.com（仅联调/自测时覆盖）
 */

/** 发送结果 —— 永不抛异常 */
export interface WechatResult {
  success: boolean;
  error?: string;
}

/** 模板消息 data 字段项 */
export interface TemplateField {
  value: string;
  color?: string;
}

export type TemplateData = Record<string, TemplateField>;

interface WechatConfig {
  appId: string;
  appSecret: string;
  templateId: string;
  timeoutMs: number;
}

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  errcode?: number;
  errmsg?: string;
}

interface SendResponse {
  errcode?: number;
  errmsg?: string;
  msgid?: number;
}

const DEFAULT_API_BASE = 'https://api.weixin.qq.com';

/** 接口根地址，默认微信官方域名；自测联调可用 WECHAT_API_BASE 覆盖 */
function apiBase(): string {
  const base = (process.env.WECHAT_API_BASE || '').trim();
  return (base || DEFAULT_API_BASE).replace(/\/+$/, '');
}

/** access_token 提前过期的安全余量：5 分钟 */
const TOKEN_SAFETY_MS = 5 * 60 * 1000;
const DEFAULT_TIMEOUT_MS = 10000;

/** 视为 access_token 失效、需要刷新重试的错误码 */
const TOKEN_INVALID_CODES = new Set<number>([40001, 42001, 40014]);

/** 每次调用时读取环境变量，便于运行期热更新配置 */
function readConfig(): WechatConfig {
  const timeoutParsed = Number.parseInt((process.env.WECHAT_API_TIMEOUT || '').trim(), 10);
  return {
    appId: (process.env.WECHAT_APP_ID || '').trim(),
    appSecret: (process.env.WECHAT_APP_SECRET || '').trim(),
    templateId: (process.env.WECHAT_TEMPLATE_ID || '').trim(),
    timeoutMs: Number.isFinite(timeoutParsed) && timeoutParsed > 0 ? timeoutParsed : DEFAULT_TIMEOUT_MS,
  };
}

/** 是否已完成微信公众号配置 */
export function isWechatConfigured(): boolean {
  const cfg = readConfig();
  return Boolean(cfg.appId && cfg.appSecret && cfg.templateId);
}

/* ------------------------------------------------------------------ */
/* access_token 内存缓存                                               */
/* ------------------------------------------------------------------ */

interface TokenCache {
  token: string;
  /** 绝对过期时间戳（已扣除 5 分钟安全余量） */
  expiresAt: number;
  /** 缓存归属的 appId，配置变更时自动失效 */
  appId: string;
}

let tokenCache: TokenCache | null = null;
/** 同一时刻只允许一个取 token 的请求在途，其余复用该 Promise */
let inflightToken: Promise<string> | null = null;

/** 清除 access_token 缓存（token 失效或配置变更时调用） */
export function clearAccessTokenCache(): void {
  tokenCache = null;
  inflightToken = null;
}

/** 带超时的 JSON 请求；body 为 undefined 时走 GET */
async function requestJson<T>(url: string, timeoutMs: number, body?: unknown): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(
      url,
      body === undefined
        ? { method: 'GET', signal: controller.signal }
        : {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            // 微信要求 UTF-8 JSON，且中文不能被转义为 \u 以外的形式
            body: JSON.stringify(body),
            signal: controller.signal,
          }
    );
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}：${text.slice(0, 200)}`);
    }
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new Error(`微信接口返回非 JSON 内容：${text.slice(0, 200)}`);
    }
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`微信接口请求超时（${timeoutMs}ms）`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/** 向微信服务器申请新的 access_token */
async function fetchAccessToken(cfg: WechatConfig): Promise<string> {
  const url =
    `${apiBase()}/cgi-bin/token?grant_type=client_credential` +
    `&appid=${encodeURIComponent(cfg.appId)}` +
    `&secret=${encodeURIComponent(cfg.appSecret)}`;
  const data = await requestJson<TokenResponse>(url, cfg.timeoutMs);

  if (data.errcode !== undefined && data.errcode !== 0) {
    throw new Error(`获取 access_token 失败（${data.errcode}）：${data.errmsg || '未知错误'}`);
  }
  if (!data.access_token) {
    throw new Error('获取 access_token 失败：响应中缺少 access_token 字段');
  }

  // 微信默认 7200 秒；提前 5 分钟过期，避免边界时刻使用到失效 token
  const expiresIn = typeof data.expires_in === 'number' && data.expires_in > 0 ? data.expires_in : 7200;
  const ttl = Math.max(expiresIn * 1000 - TOKEN_SAFETY_MS, 60 * 1000);
  tokenCache = { token: data.access_token, expiresAt: Date.now() + ttl, appId: cfg.appId };
  return data.access_token;
}

/**
 * 获取 access_token（优先命中缓存）
 * @param forceRefresh 强制忽略缓存重新获取
 */
export async function getAccessToken(forceRefresh = false): Promise<string> {
  const cfg = readConfig();
  if (!cfg.appId || !cfg.appSecret) {
    throw new Error('微信公众号未配置');
  }
  if (forceRefresh) clearAccessTokenCache();

  // 命中有效缓存（且 appId 未变更）
  if (tokenCache && tokenCache.appId === cfg.appId && tokenCache.expiresAt > Date.now()) {
    return tokenCache.token;
  }
  // 复用在途请求，避免并发重复申请触发限流
  if (inflightToken) return inflightToken;

  const pending = fetchAccessToken(cfg).finally(() => {
    if (inflightToken === pending) inflightToken = null;
  });
  inflightToken = pending;
  return pending;
}

/* ------------------------------------------------------------------ */
/* 模板消息发送                                                        */
/* ------------------------------------------------------------------ */

/** 单次投递（不含重试） */
async function postTemplate(
  cfg: WechatConfig,
  token: string,
  openid: string,
  data: TemplateData,
  url?: string
): Promise<SendResponse> {
  const payload: Record<string, unknown> = {
    touser: openid,
    template_id: cfg.templateId,
    data,
  };
  if (url) payload.url = url;
  return requestJson<SendResponse>(
    `${apiBase()}/cgi-bin/message/template/send?access_token=${encodeURIComponent(token)}`,
    cfg.timeoutMs,
    payload
  );
}

/**
 * 发送模板消息（自定义 data 字段），失败返回结果对象不抛异常。
 * 供业务侧需要自定义模板字段时使用。
 */
export async function sendTemplateRaw(openid: string, data: TemplateData, url?: string): Promise<WechatResult> {
  if (!isWechatConfigured()) {
    return { success: false, error: '微信公众号未配置' };
  }
  const receiver = (openid || '').trim();
  if (!receiver) {
    return { success: false, error: '缺少接收人 openid' };
  }

  const cfg = readConfig();
  try {
    let token = await getAccessToken();
    let result = await postTemplate(cfg, token, receiver, data, url);

    // access_token 失效：清缓存后强制刷新并重试一次
    if (result.errcode !== undefined && TOKEN_INVALID_CODES.has(result.errcode)) {
      clearAccessTokenCache();
      token = await getAccessToken(true);
      result = await postTemplate(cfg, token, receiver, data, url);
    }

    if (result.errcode !== undefined && result.errcode !== 0) {
      return { success: false, error: `微信模板消息失败（${result.errcode}）：${result.errmsg || '未知错误'}` };
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * 发送模板消息（标准三段式：标题 / 正文 / 备注）
 * 模板需包含 first、keyword1、remark 三个占位字段。
 */
export async function sendTemplateMessage(
  openid: string,
  title: string,
  content: string,
  url?: string
): Promise<WechatResult> {
  const data: TemplateData = {
    first: { value: title || '系统通知', color: '#173177' },
    keyword1: { value: content || '' },
    remark: { value: '请登录物业租赁综合管理系统查看详情。' },
  };
  return sendTemplateRaw(openid, data, url);
}
