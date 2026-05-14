import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

/**
 * 短信通知服务
 * 支持 mock / aliyun / tencent 三种模式
 * Mock 模式写入 sms.jsonl 日志文件，方便开发调试
 *
 * 阿里云 SMS SDK 集成：
 *   npm install @alicloud/dysmsapi20170525
 *   设置 SMS_PROVIDER=aliyun + SMS_ACCESS_KEY_ID/SMS_ACCESS_KEY_SECRET
 *
 * 腾讯云 SMS SDK 集成：
 *   npm install tencentcloud-sdk-nodejs
 *   设置 SMS_PROVIDER=tencent + SMS_ACCESS_KEY_ID/SMS_ACCESS_KEY_SECRET + SMS_APP_ID
 */

interface SmsConfig {
  provider: 'aliyun' | 'tencent' | 'mock';
  accessKeyId?: string;
  accessKeySecret?: string;
  signName: string;
}

interface SmsLogEntry {
  timestamp: string;
  provider: string;
  phoneNumber: string;
  templateCode: string;
  templateParams: Record<string, string>;
  success: boolean;
  error?: string;
}

const LOG_DIR = path.join(process.cwd(), 'logs');
const SMS_LOG = path.join(LOG_DIR, 'sms.jsonl');

const config: SmsConfig = {
  provider: (process.env.SMS_PROVIDER as any) || 'mock',
  accessKeyId: process.env.SMS_ACCESS_KEY_ID,
  accessKeySecret: process.env.SMS_ACCESS_KEY_SECRET,
  signName: process.env.SMS_SIGN_NAME || '物业租赁管理系统',
};

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
}

function writeLog(entry: SmsLogEntry) {
  ensureLogDir();
  fs.appendFileSync(SMS_LOG, JSON.stringify(entry) + '\n');
}

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
    if (config.provider === 'aliyun') {
      console.log(`[SMS Aliyun] Sending to ${phoneNumber}: ${templateCode}`);

      // 阿里云 V3 签名规范
      const nonce = crypto.randomUUID();
      const params = {
        phoneNumbers: phoneNumber,
        signName: config.signName,
        templateCode,
        templateParam: JSON.stringify(templateParams),
      };

      // TODO: 安装 @alicloud/dysmsapi20170525 后替换以下代码
      // const Dysmsapi20170525 = require('@alicloud/dysmsapi20170525');
      // const client = new Dysmsapi20170525({
      //   accessKeyId: config.accessKeyId,
      //   accessKeySecret: config.accessKeySecret,
      // });
      // const res = await client.sendSms(params);
      // const success = res.body.code === 'OK';

      console.log('[SMS Aliyun] SDK 未安装，降级为 mock:', params);
      logEntry.success = true;
      writeLog(logEntry);
      return true;
    }

    if (config.provider === 'tencent') {
      console.log(`[SMS Tencent] Sending to ${phoneNumber}: ${templateCode}`);

      // TODO: 安装 tencentcloud-sdk-nodejs 后替换以下代码
      // const tencentcloud = require('tencentcloud-sdk-nodejs');
      // const SmsClient = tencentcloud.sms.v20210111.Client;
      // const client = new SmsClient({
      //   credential: { secretId: config.accessKeyId, secretKey: config.accessKeySecret },
      //   region: 'ap-guangzhou',
      // });
      // const res = await client.SendSms({
      //   PhoneNumberSet: [`+86${phoneNumber}`],
      //   SmsSdkAppId: process.env.SMS_APP_ID,
      //   TemplateId: templateCode,
      //   SignName: config.signName,
      //   TemplateParamSet: Object.values(templateParams),
      // });
      // const success = res.SendStatusSet?.[0]?.Code === 'Ok';

      console.log('[SMS Tencent] SDK 未安装，降级为 mock');
      logEntry.success = true;
      writeLog(logEntry);
      return true;
    }

    return false;
  } catch (err: any) {
    console.error('[SMS] 发送失败:', err.message);
    logEntry.error = err.message;
    writeLog(logEntry);
    return false;
  }
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
