import crypto from 'node:crypto';
import zlib from 'node:zlib';

/**
 * bzp.iyunmu.com 预付费平台「请求/响应加密」协议。
 * 逆向自平台前端 app.8a4a667a.js 的 axios 拦截器：
 *  请求：随机 16 位 key，AES-128-ECB(PKCS7) 加密 body 得 x-enc-data；
 *        RSA(PKCS1 v1.5) 加密该 key 得 x-enc-key；请求头同时带两者。
 *  响应：enc_data 用同一个 key AES-128-ECB 解密 → zlib inflate → UTF-8 → JSON。
 * 关键：解密 key 与请求 key 相同——因此服务端能解我们发出的请求的前提是我们生成 key 并保留它。
 */

const METER_RSA_PUB = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAtCRdTBKZMx26n1y6MlSw
N8xTsC0qTbV16QsBF3Q7d/ySg1C45D1RRml3arcNDfKt5aqeVMIkW+qjunuhP8wB
K2cB86oGoxjZwIwfmOe98sw0icQ55KgDw5od9HHi0DKo6y3GNz1ZCFCi5tLmoIfj
H96PaBOJQ9iBBfxlbWjtxg7+0e3NDF/n5lA6BhUgSmKsBwEEw9STWY41nvcFMcm6
WkeLsWv+FUqws3Esd2g/cN71v6EcLvB3q5ItcgiNjAAku++8wq6qASLRUuIiYLdG
bxg9GyfBth9uYRWop549G4cbf0ygYd6SQBSG8J05SrxTfmEnqtnGemApKJNpTCWh
8wIDAQAB
-----END PUBLIC KEY-----`;

// 与平台一致的 key 字符集（去掉易混淆的 0/O/1/I/l）
const KEY_ALPHABET = 'ABCDEFGHJKMNPQRSTWXYZabcdefhijkmnprstwxyz2345678';

export function genMeterAesKey(): string {
  let o = '';
  for (let i = 0; i < 16; i++) o += KEY_ALPHABET.charAt(Math.floor(Math.random() * KEY_ALPHABET.length));
  return o;
}

// AES-128-ECB + PKCS7 加密任意 JSON 对象 → base64 (x-enc-data)
export function encryptMeterBody(data: unknown, key: string): string {
  const c = crypto.createCipheriv('aes-128-ecb', key, null);
  let e = c.update(JSON.stringify(data), 'utf8', 'base64');
  e += c.final('base64');
  return e;
}

// RSA(PKCS1 v1.5) 加密 AES key → base64 (x-enc-key)
export function encryptMeterKey(key: string): string {
  const e = crypto.publicEncrypt({ key: METER_RSA_PUB, padding: crypto.constants.RSA_PKCS1_PADDING }, Buffer.from(key));
  return e.toString('base64');
}

// 解密响应 enc_data → 原始 JSON
export function decryptMeterData(encData: string, key: string): unknown {
  const d = crypto.createDecipheriv('aes-128-ecb', key, null);
  const buf = Buffer.concat([d.update(encData, 'base64'), d.final()]);
  const json = zlib.inflateSync(buf);
  return JSON.parse(json.toString('utf8'));
}
