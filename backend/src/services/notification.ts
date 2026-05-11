import Notification from '../models/Notification.js';

interface NotifyOptions {
  recipientId: number;
  recipientType: 'user' | 'tenant';
  channel: string;
  title: string;
  content: string;
}

export async function sendNotification(opts: NotifyOptions): Promise<void> {
  // 站内信
  await Notification.create({
    recipientId: opts.recipientId,
    recipientType: opts.recipientType,
    channel: '站内信',
    title: opts.title,
    content: opts.content,
  });

  // 微信/短信/邮件 通过外部API发送（Phase 4）
  if (opts.channel === '短信') {
    console.log(`[Notify] SMS placeholder: ${opts.title} -> ${opts.recipientId}`);
    // TODO: 接入阿里云/腾讯云SMS
  }
  if (opts.channel === '微信') {
    console.log(`[Notify] WeChat placeholder: ${opts.title} -> ${opts.recipientId}`);
    // TODO: 接入微信公众号模板消息
  }
  if (opts.channel === '邮件') {
    console.log(`[Notify] Email placeholder: ${opts.title} -> ${opts.recipientId}`);
    // TODO: 接入邮件服务
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
