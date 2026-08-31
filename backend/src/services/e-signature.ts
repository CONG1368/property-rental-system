import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import Contract from '../models/Contract.js';

/**
 * 电子签章服务 —— e签宝开放平台 v3（**零第三方依赖**，直接用全局 fetch）
 *
 * 启用方式（缺少配置时自动降级 mock，不影响合同流程）：
 *   ESIGN_PROVIDER=esign
 *   ESIGN_APP_ID=xxx  ESIGN_APP_SECRET=xxx
 *   ESIGN_SERVER_URL=https://openapi.esign.cn（沙箱：https://smlopenapi.esign.cn）
 *   可选 ESIGN_FILE_ID=合同模板文件ID（未传时用 contract.billingConfig.esignFileId）
 *
 * 真实调用链：
 *   1) POST /v3/oauth2/token          获取 accessToken（内存缓存，提前 5 分钟过期）
 *   2) POST /v3/sign-flow/create-by-file   基于已上传文件发起签署流程
 *   3) POST /v3/sign-flow/{id}/sign-url    获取签署人签署链接
 *   4) GET  /v3/sign-flow/{id}/detail      查询流程状态
 *
 * 所有调用结果写入 logs/e-signature.jsonl，便于对账与排障。
 */

interface ESignConfig {
  provider: 'esign' | 'fadada' | 'mock';
  appId?: string;
  appSecret?: string;
  serverUrl: string;
}

const config: ESignConfig = {
  provider: (process.env.ESIGN_PROVIDER as any) || 'mock',
  appId: process.env.ESIGN_APP_ID,
  appSecret: process.env.ESIGN_APP_SECRET,
  serverUrl: (process.env.ESIGN_SERVER_URL || 'https://openapi.esign.cn').replace(/\/$/, ''),
};

const REQUEST_TIMEOUT = Number(process.env.ESIGN_TIMEOUT_MS || 15000);
const LOG_DIR = path.join(process.cwd(), 'logs');
const ESIGN_LOG = path.join(LOG_DIR, 'e-signature.jsonl');

function writeLog(entry: Record<string, unknown>) {
  try {
    if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
    fs.appendFileSync(ESIGN_LOG, JSON.stringify({ ...entry, timestamp: new Date().toISOString() }) + '\n');
  } catch {
    /* 日志失败不影响主流程 */
  }
}

/** 是否已配置真实电子签通道 */
export function isESignConfigured(): boolean {
  return config.provider !== 'mock' && !!config.appId && !!config.appSecret;
}

async function fetchWithTimeout(url: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ------------------------------------------------------------
// AccessToken（带内存缓存 + 并发去重）
// ------------------------------------------------------------
let tokenCache: { token: string; expireAt: number } | null = null;
let tokenInflight: Promise<string> | null = null;

async function requestToken(): Promise<string> {
  if (!config.appId || !config.appSecret) throw new Error('缺少 ESIGN_APP_ID / ESIGN_APP_SECRET');
  const resp = await fetchWithTimeout(`${config.serverUrl}/v3/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ appId: config.appId, secret: config.appSecret, grantType: 'client_credentials' }),
  });
  const data: any = await resp.json().catch(() => ({}));
  if (data?.code !== 0 || !data?.data?.token) {
    throw new Error(`获取 token 失败：${data?.code ?? resp.status} ${data?.message || ''}`);
  }
  // expiresIn 单位为秒，提前 5 分钟过期，避免边界失效
  const ttl = Number(data.data.expiresIn || 3600);
  tokenCache = { token: data.data.token, expireAt: Date.now() + Math.max(60, ttl - 300) * 1000 };
  return tokenCache.token;
}

/** 获取 AccessToken（e签宝 v3 API），命中缓存直接返回 */
async function getEsignToken(): Promise<string> {
  if (tokenCache && tokenCache.expireAt > Date.now()) return tokenCache.token;
  if (tokenInflight) return tokenInflight; // 并发去重
  tokenInflight = requestToken().finally(() => { tokenInflight = null; });
  return tokenInflight;
}

/** 统一的已鉴权请求 */
async function esignRequest(method: 'GET' | 'POST', apiPath: string, body?: unknown): Promise<any> {
  const token = await getEsignToken();
  const resp = await fetchWithTimeout(`${config.serverUrl}${apiPath}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Tsign-Open-App-Id': config.appId as string,
      Authorization: `Bearer ${token}`,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data: any = await resp.json().catch(() => ({}));
  if (data?.code !== 0) {
    // token 失效（e签宝返回 41001/41003 等）时清缓存，交由上层重试
    if ([41001, 41003, 401].includes(Number(data?.code))) tokenCache = null;
    throw new Error(`${apiPath} 调用失败：${data?.code ?? resp.status} ${data?.message || ''}`);
  }
  return data.data;
}

// ------------------------------------------------------------
// 业务接口
// ------------------------------------------------------------

/**
 * 创建签署流程
 * @param contractId 合同ID
 * @param signerMobile 签署人手机号
 * @param signerName 签署人姓名
 */
export async function createSignFlow(
  contractId: number,
  signerMobile: string,
  signerName: string
): Promise<{ flowId: string; signUrl: string }> {
  const contract = await Contract.findByPk(contractId);
  if (!contract) throw new Error('合同不存在');

  if (!isESignConfigured()) {
    const flowId = `FLOW-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const signUrl = `https://mock-esign.example.com/sign/${flowId}`;
    console.log(`[ESign Mock] Created flow ${flowId} for contract ${(contract as any).contractNo}`);
    writeLog({ action: 'createSignFlow', mode: 'mock', contractId, flowId });
    return { flowId, signUrl };
  }

  try {
    // 待签署文件：优先取合同 billingConfig.esignFileId，其次取环境变量默认模板
    const billingConfig: any = (contract as any).billingConfig || {};
    const fileId = billingConfig.esignFileId || process.env.ESIGN_FILE_ID;
    if (!fileId) throw new Error('缺少待签署文件 ID（billingConfig.esignFileId 或 ESIGN_FILE_ID）');

    // 1) 基于文件发起签署流程
    const flow = await esignRequest('POST', '/v3/sign-flow/create-by-file', {
      docs: [{ fileId }],
      signFlowConfig: {
        signFlowTitle: `合同签署-${(contract as any).contractNo}`,
        autoStart: true,
        notifyUrl: process.env.ESIGN_NOTIFY_URL || undefined,
      },
      signers: [
        {
          signerType: 0, // 0=个人
          psnSignerInfo: { psnAccount: signerMobile, psnInfo: { psnName: signerName } },
          signConfig: { signOrder: 1 },
          signFields: [{ fileId, normalSignFieldConfig: { freeMode: true } }],
        },
      ],
    });
    const flowId = flow?.signFlowId;
    if (!flowId) throw new Error('返回结果缺少 signFlowId');

    // 2) 获取签署链接（urlType=2 表示 H5 链接）
    const urlData = await esignRequest('POST', `/v3/sign-flow/${flowId}/sign-url`, {
      needLogin: false,
      urlType: 2,
      operator: { psnAccount: signerMobile },
    });
    const signUrl = urlData?.shortUrl || urlData?.url || '';

    writeLog({ action: 'createSignFlow', mode: 'esign', contractId, flowId, signUrl, success: true });
    return { flowId, signUrl };
  } catch (err: any) {
    console.error('[ESign] Create flow failed:', err?.message || err);
    writeLog({ action: 'createSignFlow', mode: 'esign', contractId, success: false, error: err?.message });
    throw err;
  }
}

/** e签宝流程状态码 → 本系统状态 */
function mapFlowStatus(code: number): 'pending' | 'signed' | 'rejected' | 'expired' {
  switch (Number(code)) {
    case 2: return 'signed';    // 完成
    case 3: return 'rejected';  // 已撤销
    case 4: return 'rejected';  // 已拒签
    case 5: return 'expired';   // 已过期
    default: return 'pending';  // 0 草稿 / 1 签署中
  }
}

/**
 * 查询签署状态
 */
export async function querySignStatus(flowId: string): Promise<{
  status: 'pending' | 'signed' | 'rejected' | 'expired';
  signedAt?: string;
}> {
  if (!isESignConfigured()) {
    return { status: 'signed', signedAt: new Date().toISOString() };
  }

  try {
    const detail = await esignRequest('GET', `/v3/sign-flow/${flowId}/detail`);
    const status = mapFlowStatus(detail?.signFlowStatus);
    const finishTime = detail?.signFlowFinishTime;
    const result = {
      status,
      signedAt: status === 'signed' && finishTime ? new Date(Number(finishTime)).toISOString() : undefined,
    };
    writeLog({ action: 'querySignStatus', flowId, ...result });
    return result;
  } catch (err: any) {
    console.error('[ESign] Query failed:', err?.message || err);
    writeLog({ action: 'querySignStatus', flowId, success: false, error: err?.message });
    throw err;
  }
}
