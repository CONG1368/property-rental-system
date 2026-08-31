import net from 'node:net';
import tls from 'node:tls';
import crypto from 'node:crypto';

/**
 * 零依赖 SMTP 发信客户端
 * ------------------------------------------------------------------
 * 仅使用 Node 内置模块（node:net / node:tls / node:crypto）实现，
 * 不引入 nodemailer 等任何第三方依赖。
 *
 * 支持能力：
 *   - 465 端口隐式 TLS（node:tls 直连）
 *   - 587 / 25 端口明文连接 + STARTTLS 升级（服务器声明 STARTTLS 时自动升级）
 *   - EHLO → STARTTLS → AUTH LOGIN → MAIL FROM → RCPT TO → DATA → QUIT 完整会话
 *   - 多行响应码解析（"250-XXX" 续行 / "250 XXX" 结束行）
 *   - 中文主题 RFC 2047 =?UTF-8?B?...?= 编码，正文 text/html + base64
 *   - DATA 段点号填充（行首 "." → ".."），全流程超时保护
 *
 * 环境变量：
 *   SMTP_HOST      SMTP 服务器地址（必填）
 *   SMTP_PORT      端口，默认 465
 *   SMTP_USER      登录用户名（必填）
 *   SMTP_PASS      登录密码/授权码（必填）
 *   SMTP_FROM      发件人，支持 "名称 <addr@x.com>"，缺省取 SMTP_USER
 *   SMTP_SECURE    true/false，缺省按端口推断（465 = 隐式 TLS）
 *   SMTP_TIMEOUT   超时毫秒数，默认 15000
 *   SMTP_TLS_INSECURE  true 时跳过证书校验（仅用于自建/自签名服务器）
 */

/** 发信结果 —— 永不抛异常，失败通过 error 字段返回 */
export interface MailResult {
  success: boolean;
  error?: string;
}

/** SMTP 单次响应（多行响应会合并为一个 text） */
interface SmtpResponse {
  code: number;
  text: string;
}

interface MailerConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
  secure: boolean;
  insecureTls: boolean;
  timeoutMs: number;
}

const DEFAULT_TIMEOUT_MS = 15000;

/** 解析布尔型环境变量 */
function parseBool(raw: string | undefined): boolean | null {
  if (raw === undefined) return null;
  const v = raw.trim().toLowerCase();
  if (v === '') return null;
  if (v === 'true' || v === '1' || v === 'yes' || v === 'on') return true;
  if (v === 'false' || v === '0' || v === 'no' || v === 'off') return false;
  return null;
}

/** 每次调用时读取环境变量，便于运行期热更新配置 */
function readConfig(): MailerConfig {
  const host = (process.env.SMTP_HOST || '').trim();
  const user = (process.env.SMTP_USER || '').trim();
  const pass = process.env.SMTP_PASS || '';
  const from = (process.env.SMTP_FROM || '').trim() || user;

  const portParsed = Number.parseInt((process.env.SMTP_PORT || '').trim(), 10);
  const port = Number.isFinite(portParsed) && portParsed > 0 ? portParsed : 465;

  // SMTP_SECURE 显式指定优先；未指定时 465 视为隐式 TLS，其余端口走明文 + STARTTLS
  const secureFlag = parseBool(process.env.SMTP_SECURE);
  const secure = secureFlag === null ? port === 465 : secureFlag;

  const timeoutParsed = Number.parseInt((process.env.SMTP_TIMEOUT || '').trim(), 10);
  const timeoutMs = Number.isFinite(timeoutParsed) && timeoutParsed > 0 ? timeoutParsed : DEFAULT_TIMEOUT_MS;

  return {
    host,
    port,
    user,
    pass,
    from,
    secure,
    insecureTls: parseBool(process.env.SMTP_TLS_INSECURE) === true,
    timeoutMs,
  };
}

/**
 * 是否已完成 SMTP 配置
 * 缺少 HOST / USER / PASS / FROM 任一关键项即视为未配置
 */
export function isMailerConfigured(): boolean {
  const cfg = readConfig();
  return Boolean(cfg.host && cfg.user && cfg.pass && cfg.from);
}

/* ------------------------------------------------------------------ */
/* MIME 组装                                                           */
/* ------------------------------------------------------------------ */

/** 是否为纯 ASCII 可打印字符（无需 RFC 2047 编码） */
function isPlainAscii(text: string): boolean {
  // eslint-disable-next-line no-control-regex
  return /^[\x20-\x7E]*$/.test(text);
}

/**
 * RFC 2047 编码字（=?UTF-8?B?...?=）
 * 单个编码字总长不得超过 75 字符，超长时按码点切分为多段并用 CRLF + 空格折行。
 */
export function encodeMimeWord(text: string): string {
  if (text === '') return '';
  if (isPlainAscii(text)) return text;

  const chunks: string[] = [];
  let current: string[] = [];
  let currentBytes = 0;
  // 每段原始字节上限 45 → base64 后 60 字符，加 "=?UTF-8?B?" + "?=" 共 12 字符，总长 < 75
  const MAX_RAW_BYTES = 45;

  for (const ch of Array.from(text)) {
    const size = Buffer.byteLength(ch, 'utf8');
    if (currentBytes + size > MAX_RAW_BYTES && current.length > 0) {
      chunks.push(current.join(''));
      current = [];
      currentBytes = 0;
    }
    current.push(ch);
    currentBytes += size;
  }
  if (current.length > 0) chunks.push(current.join(''));

  return chunks
    .map((c) => `=?UTF-8?B?${Buffer.from(c, 'utf8').toString('base64')}?=`)
    .join('\r\n ');
}

/** 从 "名称 <addr@x.com>" 中取出纯地址 */
export function extractAddress(input: string): string {
  const match = /<([^>]+)>/.exec(input);
  return (match ? match[1] : input).trim();
}

/** 组装 From 头：显示名做 RFC 2047 编码，地址保持原样 */
function buildFromHeader(from: string): string {
  const match = /^\s*(.*?)\s*<([^>]+)>\s*$/.exec(from);
  if (!match) return from.trim();
  const name = (match[1] || '').replace(/^"|"$/g, '').trim();
  const addr = match[2].trim();
  if (!name) return `<${addr}>`;
  return `${encodeMimeWord(name)} <${addr}>`;
}

/** 按 76 字符折行的 base64 正文 */
function base64Body(html: string): string {
  const raw = Buffer.from(html, 'utf8').toString('base64');
  const lines: string[] = [];
  for (let i = 0; i < raw.length; i += 76) lines.push(raw.slice(i, i + 76));
  return lines.join('\r\n');
}

/**
 * 组装完整 MIME 报文（不含结尾的 "\r\n.\r\n"）
 * 导出以便单元自测校验主题编码与头部格式。
 */
export function buildMimeMessage(from: string, to: string, subject: string, html: string): string {
  const domain = extractAddress(from).split('@')[1] || 'localhost';
  const headers = [
    `From: ${buildFromHeader(from)}`,
    `To: ${to}`,
    `Subject: ${encodeMimeWord(subject)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${crypto.randomUUID()}@${domain}>`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
  ];
  return headers.join('\r\n') + '\r\n\r\n' + base64Body(html);
}

/**
 * DATA 段点号填充：行首单独的 "." 需转义为 ".."，
 * 否则会被服务器当作报文结束符。
 */
export function dotStuff(message: string): string {
  return message
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => (line.startsWith('.') ? '.' + line : line))
    .join('\r\n');
}

/* ------------------------------------------------------------------ */
/* SMTP 连接与会话                                                     */
/* ------------------------------------------------------------------ */

interface Waiter {
  resolve: (res: SmtpResponse) => void;
  reject: (err: Error) => void;
}

/**
 * SMTP 连接封装：负责按行缓冲、多行响应合并、超时与错误传播。
 * STARTTLS 升级后通过 replaceSocket() 切换底层 socket。
 */
class SmtpConnection {
  private socket: net.Socket;
  private readonly timeoutMs: number;
  private buffer = '';
  private pendingLines: string[] = [];
  private queue: SmtpResponse[] = [];
  private waiter: Waiter | null = null;
  private failure: Error | null = null;
  private destroyed = false;

  constructor(socket: net.Socket, timeoutMs: number) {
    this.socket = socket;
    this.timeoutMs = timeoutMs;
    this.bind(socket);
  }

  get rawSocket(): net.Socket {
    return this.socket;
  }

  private handleData = (chunk: string | Buffer): void => {
    this.buffer += typeof chunk === 'string' ? chunk : chunk.toString('utf8');
    let idx = this.buffer.indexOf('\n');
    while (idx !== -1) {
      const line = this.buffer.slice(0, idx).replace(/\r$/, '');
      this.buffer = this.buffer.slice(idx + 1);
      this.consumeLine(line);
      idx = this.buffer.indexOf('\n');
    }
  };

  private handleError = (err: Error): void => {
    this.fail(new Error(`SMTP 连接错误：${err.message}`));
  };

  private handleClose = (): void => {
    this.fail(new Error('SMTP 连接被对端关闭'));
  };

  private bind(socket: net.Socket): void {
    socket.setEncoding('utf8');
    socket.on('data', this.handleData);
    socket.on('error', this.handleError);
    socket.on('close', this.handleClose);
  }

  private unbind(): void {
    this.socket.removeListener('data', this.handleData);
    this.socket.removeListener('error', this.handleError);
    this.socket.removeListener('close', this.handleClose);
  }

  /** STARTTLS 升级后替换底层 socket，并重置行缓冲 */
  replaceSocket(socket: net.Socket): void {
    this.unbind();
    this.socket = socket;
    this.buffer = '';
    this.pendingLines = [];
    this.bind(socket);
  }

  /**
   * 累积响应行：形如 "250-SIZE" 为续行，"250 OK" 为结束行。
   * 结束行到达时合并成一个 SmtpResponse 派发。
   */
  private consumeLine(line: string): void {
    this.pendingLines.push(line);
    // 结束行判定：前三位数字 + 空格（或整行只有三位数字）
    const isFinal = /^\d{3}(?: |$)/.test(line);
    if (!isFinal) {
      // 非法行（既不是续行也不是结束行）直接判为协议错误
      if (!/^\d{3}-/.test(line)) {
        this.fail(new Error(`SMTP 响应格式非法：${line}`));
      }
      return;
    }
    const lines = this.pendingLines;
    this.pendingLines = [];
    const code = Number.parseInt(line.slice(0, 3), 10);
    const response: SmtpResponse = { code, text: lines.join('\n') };
    const waiter = this.waiter;
    if (waiter) {
      this.waiter = null;
      waiter.resolve(response);
    } else {
      this.queue.push(response);
    }
  }

  /** 记录致命错误并唤醒等待者 */
  private fail(err: Error): void {
    if (this.failure) return;
    this.failure = err;
    const waiter = this.waiter;
    this.waiter = null;
    if (waiter) waiter.reject(err);
  }

  /** 读取一条完整响应（含超时保护） */
  read(): Promise<SmtpResponse> {
    const queued = this.queue.shift();
    if (queued) return Promise.resolve(queued);
    if (this.failure) return Promise.reject(this.failure);
    return new Promise<SmtpResponse>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.waiter = null;
        const err = new Error(`SMTP 响应超时（${this.timeoutMs}ms）`);
        this.fail(err);
        this.destroy();
        reject(err);
      }, this.timeoutMs);
      this.waiter = {
        resolve: (res) => {
          clearTimeout(timer);
          resolve(res);
        },
        reject: (err) => {
          clearTimeout(timer);
          reject(err);
        },
      };
    });
  }

  /** 写入一行命令 */
  write(line: string): void {
    if (this.failure) throw this.failure;
    this.socket.write(line + '\r\n');
  }

  /** 写入原始数据（DATA 报文体） */
  writeRaw(data: string): void {
    if (this.failure) throw this.failure;
    this.socket.write(data);
  }

  /** 发送命令并读取响应（不做状态码断言） */
  async command(line: string): Promise<SmtpResponse> {
    this.write(line);
    return this.read();
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    try {
      this.unbind();
      this.socket.destroy();
    } catch {
      /* 忽略销毁期异常 */
    }
  }
}

/** 非 2xx / 3xx 一律视为失败，错误信息带上服务器原始响应文本 */
function assertOk(step: string, res: SmtpResponse): SmtpResponse {
  if (res.code < 200 || res.code >= 400) {
    throw new Error(`${step} 失败（${res.code}）：${res.text}`);
  }
  return res;
}

/** 建立底层连接：secure=true 走 node:tls 隐式 TLS，否则 node:net 明文 */
function createSocket(cfg: MailerConfig): Promise<net.Socket> {
  return new Promise<net.Socket>((resolve, reject) => {
    let settled = false;
    const finish = (err: Error | null, socket?: net.Socket): void => {
      if (settled) return;
      settled = true;
      if (err) {
        try {
          socket?.destroy();
        } catch {
          /* 忽略 */
        }
        reject(err);
        return;
      }
      resolve(socket as net.Socket);
    };

    const onReady = (): void => {
      socket.setTimeout(0);
      socket.removeListener('error', onError);
      socket.removeListener('timeout', onTimeout);
      finish(null, socket);
    };
    const onError = (err: Error): void => {
      finish(new Error(`连接 ${cfg.host}:${cfg.port} 失败：${err.message}`), socket);
    };
    const onTimeout = (): void => {
      finish(new Error(`连接 ${cfg.host}:${cfg.port} 超时（${cfg.timeoutMs}ms）`), socket);
    };

    const socket: net.Socket = cfg.secure
      ? tls.connect(
          {
            host: cfg.host,
            port: cfg.port,
            servername: cfg.host,
            rejectUnauthorized: !cfg.insecureTls,
          },
          onReady
        )
      : net.connect({ host: cfg.host, port: cfg.port }, onReady);

    socket.setTimeout(cfg.timeoutMs);
    socket.once('error', onError);
    socket.once('timeout', onTimeout);
  });
}

/** 在已连接的明文 socket 上做 STARTTLS 升级 */
function upgradeToTls(socket: net.Socket, cfg: MailerConfig): Promise<tls.TLSSocket> {
  return new Promise<tls.TLSSocket>((resolve, reject) => {
    const onError = (err: Error): void => {
      reject(new Error(`STARTTLS 握手失败：${err.message}`));
    };
    const secured = tls.connect(
      {
        socket,
        servername: cfg.host,
        rejectUnauthorized: !cfg.insecureTls,
      },
      () => {
        secured.removeListener('error', onError);
        resolve(secured);
      }
    );
    secured.once('error', onError);
  });
}

/** 客户端标识：优先取发件域名，避免暴露内网主机名 */
function clientIdentity(cfg: MailerConfig): string {
  const domain = extractAddress(cfg.from).split('@')[1];
  return domain && domain.trim() ? domain.trim() : 'localhost';
}

/** 执行一次完整 SMTP 会话，失败抛异常由 sendMail 捕获 */
async function runSession(cfg: MailerConfig, to: string, subject: string, html: string): Promise<void> {
  const socket = await createSocket(cfg);
  const conn = new SmtpConnection(socket, cfg.timeoutMs);
  try {
    // 1) 服务器问候
    assertOk('服务器问候', await conn.read());

    // 2) EHLO（失败则回退 HELO）
    const identity = clientIdentity(cfg);
    let ehlo = await conn.command(`EHLO ${identity}`);
    if (ehlo.code < 200 || ehlo.code >= 400) {
      ehlo = assertOk('HELO', await conn.command(`HELO ${identity}`));
    }

    // 3) STARTTLS（明文连接且服务器声明支持时升级）
    if (!cfg.secure && /STARTTLS/i.test(ehlo.text)) {
      assertOk('STARTTLS', await conn.command('STARTTLS'));
      const secured = await upgradeToTls(conn.rawSocket, cfg);
      conn.replaceSocket(secured);
      // TLS 通道建立后必须重新 EHLO
      ehlo = assertOk('EHLO(TLS)', await conn.command(`EHLO ${identity}`));
    }

    // 4) AUTH LOGIN（base64 用户名 / 密码）
    assertOk('AUTH LOGIN', await conn.command('AUTH LOGIN'));
    assertOk('AUTH 用户名', await conn.command(Buffer.from(cfg.user, 'utf8').toString('base64')));
    assertOk('AUTH 密码', await conn.command(Buffer.from(cfg.pass, 'utf8').toString('base64')));

    // 5) 信封
    assertOk('MAIL FROM', await conn.command(`MAIL FROM:<${extractAddress(cfg.from)}>`));
    assertOk('RCPT TO', await conn.command(`RCPT TO:<${extractAddress(to)}>`));

    // 6) DATA + 报文（点号填充后以 <CRLF>.<CRLF> 结束）
    assertOk('DATA', await conn.command('DATA'));
    const message = buildMimeMessage(cfg.from, to, subject, html);
    conn.writeRaw(dotStuff(message) + '\r\n.\r\n');
    assertOk('报文投递', await conn.read());

    // 7) QUIT（失败不影响投递结果）
    try {
      await conn.command('QUIT');
    } catch {
      /* 已投递成功，QUIT 异常忽略 */
    }
  } finally {
    conn.destroy();
  }
}

/**
 * 发送邮件（HTML 正文）
 * 未配置或发送失败均返回结果对象，不抛异常。
 */
export async function sendMail(to: string, subject: string, html: string): Promise<MailResult> {
  if (!isMailerConfigured()) {
    return { success: false, error: 'SMTP 未配置' };
  }
  const recipient = (to || '').trim();
  if (!recipient) {
    return { success: false, error: '缺少收件人地址' };
  }
  const cfg = readConfig();
  try {
    await runSession(cfg, recipient, subject || '(无主题)', html || '');
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}
