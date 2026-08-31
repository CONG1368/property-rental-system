/**
 * 外部服务 Provider 自检（不需要任何真实账号）
 * 运行：cd backend && npx tsx ../scripts/verify-external-providers.ts
 *
 * 校验范围：
 *   1. 阿里云 SMS V1 签名的百分号编码规则（RFC 3986）与签名确定性
 *   2. 腾讯云 SMS TC3-HMAC-SHA256 的 Authorization 结构、密钥派生链与确定性
 *   3. 未配置密钥时的降级行为（不抛异常、mock 可用、isXxxConfigured 为 false）
 * 说明：这里校验的是**算法结构与自洽性**（相同输入必得相同签名、编码符合规范、
 *      派生链随日期/服务变化），不是与服务商官方向量逐字节比对——后者需真实密钥。
 */
import { percentEncode, buildAliyunSignature, buildTencentAuthorization, sendSms, isSmsConfigured } from '../backend/src/services/sms-service.js';
import { isESignConfigured } from '../backend/src/services/e-signature.js';

let pass = 0, fail = 0;
function ok(name: string, cond: boolean, extra = '') {
  if (cond) { pass++; console.log('PASS: ' + name + (extra ? '  => ' + extra : '')); }
  else { fail++; console.log('FAIL: ' + name + (extra ? '  => ' + extra : '')); }
}

// ---------- 1. 阿里云百分号编码 ----------
ok('percentEncode 空格 → %20', percentEncode('a b') === 'a%20b', percentEncode('a b'));
ok('percentEncode 星号 → %2A', percentEncode('a*b') === 'a%2Ab', percentEncode('a*b'));
ok('percentEncode 波浪线保留为 ~', percentEncode('a~b') === 'a~b', percentEncode('a~b'));
ok('percentEncode 斜杠 → %2F', percentEncode('/') === '%2F', percentEncode('/'));
ok('percentEncode 中文 UTF-8 转义', percentEncode('租') === '%E7%A7%9F', percentEncode('租'));

// ---------- 2. 阿里云签名 ----------
const aliParams = {
  AccessKeyId: 'testid', Action: 'SendSms', Format: 'JSON', RegionId: 'cn-hangzhou',
  SignatureMethod: 'HMAC-SHA1', SignatureNonce: 'fixed-nonce', SignatureVersion: '1.0',
  Timestamp: '2026-01-01T00:00:00Z', Version: '2017-05-25',
  PhoneNumbers: '13800138000', SignName: '物业租赁', TemplateCode: 'SMS_1',
  TemplateParam: JSON.stringify({ bill_no: 'BL-1', amount: '100.00' }),
};
const sigA = buildAliyunSignature(aliParams, 'testsecret', 'GET');
const sigB = buildAliyunSignature(aliParams, 'testsecret', 'GET');
ok('阿里云签名确定性（同输入同签名）', sigA === sigB, sigA);
ok('阿里云签名为 Base64(HMAC-SHA1)（28 字符、以 = 结尾）', /^[A-Za-z0-9+/]{27}=$/.test(sigA), 'len=' + sigA.length);
ok('阿里云签名随密钥变化', buildAliyunSignature(aliParams, 'othersecret', 'GET') !== sigA);
ok('阿里云签名随参数变化', buildAliyunSignature({ ...aliParams, PhoneNumbers: '13900139000' }, 'testsecret', 'GET') !== sigA);
ok('阿里云签名与参数书写顺序无关（内部按字典序排序）',
  buildAliyunSignature(Object.fromEntries(Object.entries(aliParams).reverse()) as any, 'testsecret', 'GET') === sigA);

// ---------- 3. 腾讯云 TC3 ----------
const tcOpts = {
  secretId: 'AKIDEXAMPLE', secretKey: 'SECRETEXAMPLE', service: 'sms',
  host: 'sms.tencentcloudapi.com', action: 'SendSms',
  payload: JSON.stringify({ PhoneNumberSet: ['+8613800138000'], SmsSdkAppId: '1400000000' }),
  timestamp: 1767225600, // 2026-01-01T00:00:00Z
};
const auth = buildTencentAuthorization(tcOpts);
ok('TC3 Authorization 前缀正确', auth.startsWith('TC3-HMAC-SHA256 Credential='), auth.slice(0, 40));
ok('TC3 Credential 作用域为 日期/服务/tc3_request', auth.includes('AKIDEXAMPLE/2026-01-01/sms/tc3_request'));
ok('TC3 SignedHeaders 为 content-type;host', auth.includes('SignedHeaders=content-type;host'));
const tcSig = (auth.split('Signature=')[1] || '').trim();
ok('TC3 Signature 为 64 位十六进制（SHA256）', /^[0-9a-f]{64}$/.test(tcSig), tcSig.slice(0, 16) + '...');
ok('TC3 签名确定性', buildTencentAuthorization(tcOpts) === auth);
ok('TC3 签名随 payload 变化', buildTencentAuthorization({ ...tcOpts, payload: '{}' }) !== auth);
ok('TC3 签名随日期变化（派生密钥含日期）',
  buildTencentAuthorization({ ...tcOpts, timestamp: tcOpts.timestamp + 86400 }) !== auth);
ok('TC3 签名随 service 变化（派生密钥含服务名）',
  buildTencentAuthorization({ ...tcOpts, service: 'cvm' }) !== auth);

// ---------- 4. 未配置时的降级行为 ----------
ok('未配置密钥时 isSmsConfigured() 为 false', isSmsConfigured() === false);
ok('未配置时 isESignConfigured() 为 false', isESignConfigured() === false);

// scripts/ 目录按 CJS 解析，顶层 await 不可用，故包一层异步入口
async function main() {
  const mockSent = await sendSms('13800138000', 'SMS_TEST', { bill_no: 'BL-1' });
  ok('mock 模式 sendSms 返回 true 且不抛异常', mockSent === true);

  console.log('');
  console.log('SUMMARY: ' + pass + '/' + (pass + fail) + ' passed');
  process.exit(fail === 0 ? 0 : 1);
}
main();
