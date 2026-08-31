import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

/**
 * 短信通知服务
 * 支持 mock / aliyun / tencent 三种模式，**零第三方依赖**：
 *   - 阿里云：RPC 风格 API + V1 签名（HMAC-SHA1），直接用全局 fetch 调用
 *   - 腾讯云：TC3-HMAC-SHA256 签名 + JSON POST，直接用全局 fetch 调用
 *
 * 启用方式（缺少密钥时自动降级为 mock，不影响业务流程）：
 *   阿里云：SMS_PROVIDER=aliyun  SMS_ACCESS_KEY_ID=xx  SMS_ACCESS_KEY_SECRET=xx  SMS_SIGN_NAME=签名
 *   腾讯云：SMS_PROVIDER=tencent SMS_ACCESS_KEY_ID=xx  SMS_ACCESS_KEY_SECRET=xx  SMS_APP_ID=1400xxxxx
 *          可选 SMS_REGION（默认 ap-guangzhou）
 *
 * 所有发送结果（含失败原因）均落盘到 logs/sms.jsonl，便于排查。
 */

interface SmsConfig {
  provider: 'aliyun' | 'tencent' | 'mock';
  accessKeyId?: string;
  accessKeySecret?: string;
  signName: string;
  appId?: string;
  region: string;
}

interface SmsLogEntry {
  timestamp: string;
  provider: string;
  phoneNumber: string;
  templateCode: string;
  templateParams: Record<string, string>;
  success: boolean;
  error?: string;
  /** 服务商返回的请求 ID / 回执 ID，便于对账 */
  requestId?: string;
}

const LOG_DIR = path.join(process.cwd(), 'logs');
const SMS_LOG = path.join(LOG_DIR, 'sms.jsonl');

const config: SmsConfig = {
  provider: (process.env.SMS_PROVIDER as any) || 'mock',
  accessKeyId: process.env.SMS_ACCESS_KEY_ID,
  accessKeySecret: process.env.SMS_ACCESS_KEY_SECRET,
  signName: process.env.SMS_SIGN_NAME || '物业租赁管理系统',
  appId: process.env.SMS_APP_ID,
  region: process.env.SMS_REGION || 'ap-guangzhou',
};

/** 请求超时（毫秒），防止短信网关无响应拖垮催缴任务 */
const REQUEST_TIMEOUT = Number(process.env.SMS_TIMEOUT_MS || 10000);

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
}

function writeLog(entry: SmsLogEntry) {
  ensureLogDir();
  fs.appendFileSync(SMS_LOG, JSON.stringify(entry) + '\n');
}

/** 带超时的 fetch（Node 18+ 内置 fetch + AbortSignal） */
async function fetchWithTimeout(url: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ============================================================
// 阿里云 SMS —— RPC 风格 + V1 签名（HMAC-SHA1）
// 文档：https://help.aliyun.com/document_detail/101343.html
// ============================================================

/**
 * 阿里云要求的百分号编码（RFC 3986）：
 * encodeURIComponent 之后还需把 + → %20、* → %2A、%7E → ~
 */
export function percentEncode(value: string): string {
  return encodeURIComponent(value)
    .replace(/\+/g, '%20')
    .replace(/\*/g, '%2A')
    .replace(/%7E/g, '~');
}

/** 构造阿里云 V1 签名（导出以便自检脚本验证算法） */
export function buildAliyunSignature(
  params: Record<string, string>,
  accessKeySecret: string,
  httpMethod = 'GET'
): string {
  // 1) 参数按名称字典序排序后拼成规范化查询串
  const canonicalizedQuery = Object.keys(params)
    .sort()
    .map((k) => `${percentEncode(k)}=${percentEncode(params[k])}`)
    .join('&');
  // 2) StringToSign = METHOD & percentEncode("/") & percentEncode(canonicalizedQuery)
  const stringToSign = `${httpMethod}&${percentEncode('/')}&${percentEncode(canonicalizedQuery)}`;
  // 3) 密钥须追加 "&"
  return crypto.createHmac('sha1', accessKeySecret + '&').update(stringToSign, 'utf8').digest('base64');
}

async function sendViaAliyun(
  phoneNumber: string,
  templateCode: string,
  templateParams: Record<string, string>
): Promise<{ success: boolean; error?: string; requestId?: string }> {
  if (!config.accessKeyId || !config.accessKeySecret) {
    return { success: false, error: '缺少 SMS_ACCESS_KEY_ID / SMS_ACCESS_KEY_SECRET' };
  }
  const params: Record<string, string> = {
    // 公共参数
    AccessKeyId: config.accessKeyId,
    Action: 'SendSms',
    Format: 'JSON',
    RegionId: 'cn-hangzhou',
    SignatureMethod: 'HMAC-SHA1',
    SignatureNonce: crypto.randomUUID(),
    SignatureVersion: '1.0',
    Timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    Version: '2017-05-25',
    // 业务参数
    PhoneNumbers: phoneNumber,
    SignName: config.signName,
    TemplateCode: templateCode,
    TemplateParam: JSON.stringify(templateParams),
  };
  const signature = buildAliyunSignature(params, config.accessKeySecret, 'GET');
  const query = Object.keys(params)
    .map((k) => `${percentEncode(k)}=${percentEncode(params[k])}`)
    .join('&');
  const url = `https://dysmsapi.aliyuncs.com/?Signature=${percentEncode(signature)}&${query}`;

  const resp = await fetchWithTimeout(url, { method: 'GET' });
  const data: any = await resp.json().catch(() => ({}));
  if (data?.Code === 'OK') return { success: true, requestId: data.RequestId };
  return { success: false, error: `${data?.Code || resp.status}: ${data?.Message || '未知错误'}`, requestId: data?.RequestId };
}

// ============================================================
// 腾讯云 SMS —— TC3-HMAC-SHA256 签名
// 文档：https://cloud.tencent.com/document/api/382/55981
// ============================================================

function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
}
function hmac(key: Buffer | string, data: string): Buffer {
  return crypto.createHmac('sha256', key).update(data, 'utf8').digest();
}

/** 构造腾讯云 TC3 Authorization 头（导出以便自检脚本验证算法） */
export function buildTencentAuthorization(opts: {
  secretId: string;
  secretKey: string;
  service: string;
  host: string;
  action: string;
  payload: string;
  timestamp: number;
}): string {
  const { secretId, secretKey, service, host, payload, timestamp } = opts;
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10); // UTC yyyy-mm-dd

  // 1) 规范请求串
  const canonicalHeaders = `content-type:application/json; charset=utf-8\nhost:${host}\n`;
  const signedHeaders = 'content-type;host';
  const canonicalRequest = ['POST', '/', '', canonicalHeaders, signedHeaders, sha256Hex(payload)].join('\n');

  // 2) 待签名字符串
  const credentialScope = `${date}/${service}/tc3_request`;
  const stringToSign = ['TC3-HMAC-SHA256', String(timestamp), credentialScope, sha256Hex(canonicalRequest)].join('\n');

  // 3) 逐级派生签名密钥
  const secretDate = hmac('TC3' + secretKey, date);
  const secretService = hmac(secretDate, service);
  const secretSigning = hmac(secretService, 'tc3_request');
  const signature = crypto.createHmac('sha256', secretSigning).update(stringToSign, 'utf8').digest('hex');

  return `TC3-HMAC-SHA256 Credential=${secretId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
}

async function sendViaTencent(
  phoneNumber: string,
  templateCode: string,
  templateParams: Record<string, string>
): Promise<{ success: boolean; error?: string; requestId?: string }> {
  if (!config.accessKeyId || !config.accessKeySecret) {
    return { success: false, error: '缺少 SMS_ACCESS_KEY_ID / SMS_ACCESS_KEY_SECRET' };
  }
  if (!config.appId) return { success: false, error: '缺少 SMS_APP_ID（短信应用 SdkAppId）' };

  const host = 'sms.tencentcloudapi.com';
  const timestamp = Math.floor(Date.now() / 1000);
  const body = {
    PhoneNumberSet: [phoneNumber.startsWith('+') ? phoneNumber : `+86${phoneNumber}`],
    SmsSdkAppId: config.appId,
    TemplateId: templateCode,
    SignName: config.signName,
    // 腾讯云模板参数是有序数组，按对象键名排序保证与模板占位符顺序一致
    TemplateParamSet: Object.keys(templateParams).sort().map((k) => String(templateParams[k])),
  };
  const payload = JSON.stringify(body);
  const authorization = buildTencentAuthorization({
    secretId: config.accessKeyId,
    secretKey: config.accessKeySecret,
    service: 'sms',
    host,
    action: 'SendSms',
    payload,
    timestamp,
  });

  const resp = await fetchWithTimeout(`https://${host}`, {
    method: 'POST',
    headers: {
      Authorization: authorization,
      'Content-Type': 'application/json; charset=utf-8',
      Host: host,
      'X-TC-Action': 'SendSms',
      'X-TC-Timestamp': String(timestamp),
      'X-TC-Version': '2021-01-11',
      'X-TC-Region': config.region,
    },
    body: payload,
  });
  const data: any = await resp.json().catch(() => ({}));
  const res = data?.Response;
  if (res?.Error) return { success: false, error: `${res.Error.Code}: ${res.Error.Message}`, requestId: res.RequestId };
  const status = res?.SendStatusSet?.[0];
  if (status?.Code === 'Ok') return { success: true, requestId: res.RequestId };
  return { success: false, error: `${status?.Code || '未知'}: ${status?.Message || '发送失败'}`, requestId: res?.RequestId };
}

// ============================================================
// 对外接口
// ============================================================

export async function sendSms(
  phoneNumber: string,
  templateCode: string,
  templateParams: Record<string, string>
): Promise<boolean> {
  const logEntry: SmsLogEntry = {
    timestamp: new Date().toISOString(),
    provider: config.provider,
    phoneNumber,
    templateCode,
    templateParams,
    success: false,
  };

  if (config.provider === 'mock') {
    console.log(`[SMS Mock] To: ${phoneNumber}, Template: ${templateCode}`);
    logEntry.success = true;
    writeLog(logEntry);
    return true;
  }

  try {
    const result =
      config.provider === 'aliyun'
        ? await sendViaAliyun(phoneNumber, templateCode, templateParams)
        : config.provider === 'tencent'
        ? await sendViaTencent(phoneNumber, templateCode, templateParams)
        : { success: false, error: `不支持的 SMS_PROVIDER: ${config.provider}` };

    logEntry.success = result.success;
    if (result.error) logEntry.error = result.error;
    if (result.requestId) logEntry.requestId = result.requestId;
    writeLog(logEntry);
    if (!result.success) console.error(`[SMS ${config.provider}] 发送失败:`, result.error);
    return result.success;
  } catch (err: any) {
    // 网关超时/网络异常：记录后返回 false，绝不向上抛出中断催缴流程
    const message = err?.name === 'AbortError' ? `请求超时(${REQUEST_TIMEOUT}ms)` : err?.message || String(err);
    console.error('[SMS] 发送失败:', message);
    logEntry.error = message;
    writeLog(logEntry);
    return false;
  }
}

/** 当前是否已配置真实短信通道（未配置时全部走 mock） */
export function isSmsConfigured(): boolean {
  if (config.provider === 'mock') return false;
  if (!config.accessKeyId || !config.accessKeySecret) return false;
  if (config.provider === 'tencent' && !config.appId) return false;
  return true;
}

// 催缴短信
export async function sendDunningSms(
  phoneNumber: string,
  billNo: string,
  amount: number,
  dueDate: string
): Promise<boolean> {
  const templateCode = process.env.SMS_TEMPLATE_DUNNING || 'SMS_DUNNING_TEMPLATE';
  return sendSms(phoneNumber, templateCode, {
    bill_no: billNo,
    amount: amount.toFixed(2),
    due_date: dueDate,
  });
}

// 账单生成通知
export async function sendBillNoticeSms(
  phoneNumber: string,
  billNo: string,
  amount: number
): Promise<boolean> {
  const templateCode = process.env.SMS_TEMPLATE_BILL || 'SMS_BILL_TEMPLATE';
  return sendSms(phoneNumber, templateCode, {
    bill_no: billNo,
    amount: amount.toFixed(2),
  });
}

/**
 * 从 sms 日志文件中读取最近 N 条发送记录
 */
export function getRecentSmsLogs(lines = 50): SmsLogEntry[] {
  try {
    if (!fs.existsSync(SMS_LOG)) return [];
    const content = fs.readFileSync(SMS_LOG, 'utf-8');
    const logLines = content.trim().split('\n').filter(Boolean);
    return logLines.slice(-lines).map((l) => JSON.parse(l));
  } catch {
    return [];
  }
}
