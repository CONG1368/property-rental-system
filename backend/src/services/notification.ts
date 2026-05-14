import fs from 'fs';
import path from 'path';
import Notification from '../models/Notification.js';
import { sendSms } from './sms-service.js';

interface NotifyOptions {
  recipientId: number;
  recipientType: 'user' | 'tenant';
  channel: string;
  title: string;
  content: string;
  phone?: string;
  email?: string;
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
 * - 微信：写入通知日志（接入微信模板消息时替换实现）
 * - 邮件：写入通知日志（接入邮件服务时替换实现）
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

  // 微信 —— 写入通知日志（接入微信公众号模板消息时替换）
  if (opts.channel === '微信') {
    writeNotifyLog({ channel: '微信', recipientId: opts.recipientId, title: opts.title, status: 'mock_sent' });
  }

  // 邮件 —— 写入通知日志 + 尝试发送
  if (opts.channel === '邮件') {
    if (opts.email) {
      await sendEmail(opts.email, opts.title, opts.content);
    } else {
      writeNotifyLog({ channel: '邮件', recipientId: opts.recipientId, title: opts.title, error: '无邮箱地址' });
    }
  }
}

/**
 * 发送邮件（mock 模式写入日志文件）
 * 接入真实邮件服务时替换此函数体：
 *   import nodemailer from 'nodemailer';
 *   const transporter = nodemailer.createTransport({ host, port, auth: { user, pass } });
 *   await transporter.sendMail({ from, to, subject, text });
 */
export async function sendEmail(to: string, subject: string, body: string): Promise<boolean> {
  ensureLogDir();
  const emailLog = {
    to,
    subject,
    body: body.substring(0, 200),
    timestamp: new Date().toISOString(),
    provider: process.env.EMAIL_PROVIDER || 'mock',
  };
  writeNotifyLog({ channel: '邮件', ...emailLog });
  console.log(`[Email Mock] To: ${to}, Subject: ${subject}`);
  return true;
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
