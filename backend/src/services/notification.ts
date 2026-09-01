import fs from 'fs';
import path from 'path';
import Notification from '../models/Notification.js';
import { sendSms } from './sms-service.js';
import { isMailerConfigured, sendMail } from './mailer.js';
import { isWechatConfigured, sendTemplateMessage } from './wechat-provider.js';

interface NotifyOptions {
  recipientId: number;
  recipientType: 'user' | 'tenant';
  channel: string;
  title: string;
  content: string;
  phone?: string;
  email?: string;
  /** 微信 openid —— 由调用方传入，不改动数据库模型 */
  openid?: string;
  linkType?: string | null;
  linkId?: number | null;
}

const LOG_DIR = path.join(process.cwd(), 'logs');
const NOTIFY_LOG = path.join(LOG_DIR, 'notifications.jsonl');

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
}

function writeNotifyLog(entry: Record<string, unknown>) {
  ensureLogDir();
  fs.appendFileSync(NOTIFY_LOG, JSON.stringify({ ...entry, timestamp: new Date().toISOString() }) + '\n');
}

/**
 * 发送多渠道通知
 * - 站内信：始终写入数据库
 * - 短信：调用 sms-service 发送（mock 模式写入 sms 日志）
 * - 微信：配置 WECHAT_APP_ID/SECRET/TEMPLATE_ID 且传入 openid 时发送公众号模板消息，否则写日志 mock
 * - 邮件：配置 SMTP_* 时通过内置 SMTP 客户端真实发信，否则写日志 mock
 */
export async function sendNotification(opts: NotifyOptions): Promise<void> {
  // 站内信 —— 写入数据库
  await Notification.create({
    recipientId: opts.recipientId,
    recipientType: opts.recipientType,
    channel: '站内信',
    title: opts.title,
    content: opts.content,
    isRead: false,
    linkType: opts.linkType || null,
    linkId: opts.linkId || null,
  } as any);

  // 短信 —— 调用 sms-service
  if (opts.channel === '短信') {
    let phone = opts.phone;
    if (!phone) {
      // 尝试从 Tenant 表查找手机号
      try {
        const { default: Tenant } = await import('../models/Tenant.js');
        const tenant = await Tenant.findByPk(opts.recipientId);
        phone = (tenant as any)?.phone || '';
      } catch {
        phone = '';
      }
    }
    if (phone) {
      const sent = await sendSms(phone, 'NOTIFY_' + opts.title, { title: opts.title, content: opts.content });
      writeNotifyLog({ channel: '短信', phone, title: opts.title, sent });
    } else {
      writeNotifyLog({ channel: '短信', recipientId: opts.recipientId, title: opts.title, error: '无手机号' });
    }
  }

  // 微信 —— 已配置公众号且有 openid 时发送模板消息，否则退回日志 mock
  if (opts.channel === '微信') {
    try {
      const openid = (opts.openid || '').trim();
      if (isWechatConfigured() && openid) {
        const result = await sendTemplateMessage(openid, opts.title, opts.content);
        writeNotifyLog({
          channel: '微信',
          recipientId: opts.recipientId,
          openid,
          title: opts.title,
          status: result.success ? 'sent' : 'failed',
          error: result.error,
        });
      } else {
        writeNotifyLog({
          channel: '微信',
          recipientId: opts.recipientId,
          title: opts.title,
          status: 'mock_sent',
          reason: isWechatConfigured() ? '无 openid' : '未配置微信公众号',
        });
      }
    } catch (err) {
      // 通知失败绝不影响主业务流程
      writeNotifyLog({
        channel: '微信',
        recipientId: opts.recipientId,
        title: opts.title,
        status: 'failed',
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // 邮件 —— 写入通知日志 + 尝试发送
  if (opts.channel === '邮件') {
    if (opts.email) {
      try {
        await sendEmail(opts.email, opts.title, opts.content);
      } catch (err) {
        writeNotifyLog({
          channel: '邮件',
          recipientId: opts.recipientId,
          title: opts.title,
          status: 'failed',
          error: err instanceof Error ? err.message : String(err),
        });
      }
    } else {
      writeNotifyLog({ channel: '邮件', recipientId: opts.recipientId, title: opts.title, error: '无邮箱地址' });
    }
  }
}

/** HTML 转义，避免纯文本正文中的尖括号破坏邮件结构 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** 正文转 HTML：已是 HTML 则原样使用，纯文本则转义并保留换行 */
function toHtmlBody(title: string, body: string): string {
  const looksLikeHtml = /<\/?[a-zA-Z][\s\S]*>/.test(body);
  const inner = looksLikeHtml ? body : escapeHtml(body).replace(/\r?\n/g, '<br/>');
  return (
    '<div style="font-family:-apple-system,\'Microsoft YaHei\',sans-serif;font-size:14px;line-height:1.8;color:#1f2430;">' +
    `<h3 style="margin:0 0 12px;font-size:16px;color:#2b57c9;">${escapeHtml(title)}</h3>` +
    `<div>${inner}</div>` +
    '<hr style="margin:16px 0;border:none;border-top:1px solid #e3e8f0;"/>' +
    '<p style="margin:0;font-size:12px;color:#5f6675;">本邮件由物业租赁综合管理系统自动发送，请勿直接回复。</p>' +
    '</div>'
  );
}

/**
 * 发送邮件
 * - 已配置 SMTP（SMTP_HOST/SMTP_USER/SMTP_PASS/SMTP_FROM）时调用零依赖 SMTP 客户端真实发信
 * - 未配置时保持原有 mock 行为：写入 notifications.jsonl 日志并返回 true
 * 任何异常都会被捕获，绝不向业务流程抛错。
 */
export async function sendEmail(to: string, subject: string, body: string): Promise<boolean> {
  ensureLogDir();
  const baseLog = {
    to,
    subject,
    body: body.substring(0, 200),
    timestamp: new Date().toISOString(),
  };

  // 未配置 SMTP —— 保持 mock 行为
  if (!isMailerConfigured()) {
    writeNotifyLog({ channel: '邮件', ...baseLog, provider: process.env.EMAIL_PROVIDER || 'mock', status: 'mock_sent' });
    console.log(`[Email Mock] To: ${to}, Subject: ${subject}`);
    return true;
  }

  // 已配置 SMTP —— 真实发信
  try {
    const result = await sendMail(to, subject, toHtmlBody(subject, body));
    writeNotifyLog({
      channel: '邮件',
      ...baseLog,
      provider: 'smtp',
      status: result.success ? 'sent' : 'failed',
      error: result.error,
    });
    if (!result.success) {
      console.warn(`[Email] 发送失败 To: ${to}, 原因: ${result.error}`);
    }
    return result.success;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    writeNotifyLog({ channel: '邮件', ...baseLog, provider: 'smtp', status: 'failed', error: message });
    console.warn(`[Email] 发送异常 To: ${to}, 原因: ${message}`);
    return false;
  }
}

export async function getUnreadCount(userId: number): Promise<number> {
  return Notification.count({ where: { recipientId: userId, isRead: false } });
}

export async function markAsRead(notificationId: number): Promise<void> {
  await Notification.update(
    { isRead: true, readAt: new Date() },
    { where: { id: notificationId } }
  );
}

/**
 * 广播通知 — 对所有用户可见
 * recipientId=0 表示系统广播，前端通知列表会包含这类通知
 */
export async function broadcastNotification(
  title: string,
  content: string,
  linkType?: string | null,
  linkId?: number | null
): Promise<void> {
  return sendNotification({
    recipientId: 0,
    recipientType: 'user',
    channel: '站内信',
    title,
    content,
    linkType,
    linkId,
  });
}

/**
 * 读取最近的通知日志（用于调试/管理界面查看外发通知记录）
 */
export function getRecentLogs(lines = 50): Record<string, unknown>[] {
  try {
    if (!fs.existsSync(NOTIFY_LOG)) return [];
    const content = fs.readFileSync(NOTIFY_LOG, 'utf-8');
    const logLines = content.trim().split('\n').filter(Boolean);
    return logLines.slice(-lines).map((l) => JSON.parse(l));
  } catch {
    return [];
  }
}
