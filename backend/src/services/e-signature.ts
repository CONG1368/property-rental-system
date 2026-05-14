import crypto from 'crypto';
import Contract from '../models/Contract.js';

/**
 * 电子签章服务
 * 对接 e签宝（Fadada/契约锁）电子合同签署API
 *
 * e签宝 API 示例流程：
 *   1. 创建签署任务（/api/esign/createFlow）
 *   2. 上传合同文件
 *   3. 发起签署（/api/esign/startFlow）
 *   4. 查询签署状态（/api/esign/queryFlow）
 *
 * 当前为占位实现，替换为实际 SDK 调用即可激活。
 */

interface ESignConfig {
  provider: 'esign' | 'fadada' | 'mock';
  appId?: string;
  appSecret?: string;
  serverUrl?: string;
}

const config: ESignConfig = {
  provider: (process.env.ESIGN_PROVIDER as any) || 'mock',
  appId: process.env.ESIGN_APP_ID,
  appSecret: process.env.ESIGN_APP_SECRET,
  serverUrl: process.env.ESIGN_SERVER_URL,
};

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

  if (config.provider === 'mock') {
    const flowId = `FLOW-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const signUrl = `https://mock-esign.example.com/sign/${flowId}`;
    console.log(`[ESign Mock] Created flow ${flowId} for contract ${contract.contractNo}`);
    return { flowId, signUrl };
  }

  try {
    // TODO: 对接 e签宝 SDK
    // 1. 获取 AccessToken
    // const token = await getEsignToken(config.appId, config.appSecret);

    // 2. 创建签署流程
    // const flow = await esignClient.createFlow({
    //   title: `合同签署-${contract.contractNo}`,
    //   files: [{ fileId: contract.documentFileId }],
    //   signers: [{
    //     name: signerName,
    //     mobile: signerMobile,
    //     signMode: 'HANDWRITTEN',
    //   }],
    // });

    // 3. 返回签署链接
    // return { flowId: flow.id, signUrl: flow.signUrl };

    console.log('[ESign] SDK not installed — using mock');
    const flowId = `FLOW-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    return { flowId, signUrl: `https://mock-esign.example.com/sign/${flowId}` };
  } catch (err) {
    console.error('[ESign] Create flow failed:', err);
    throw err;
  }
}

/**
 * 查询签署状态
 */
export async function querySignStatus(flowId: string): Promise<{
  status: 'pending' | 'signed' | 'rejected' | 'expired';
  signedAt?: string;
}> {
  if (config.provider === 'mock') {
    return { status: 'signed', signedAt: new Date().toISOString() };
  }

  try {
    // TODO: 查询真实签署状态
    // const res = await esignClient.queryFlow(flowId);
    // return { status: res.status, signedAt: res.signedAt };

    console.log('[ESign] SDK not installed — returning mock status');
    return { status: 'signed', signedAt: new Date().toISOString() };
  } catch (err) {
    console.error('[ESign] Query failed:', err);
    throw err;
  }
}

/**
 * 获取 AccessToken（e签宝 v3 API）
 */
async function getEsignToken(appId?: string, appSecret?: string): Promise<string> {
  if (!appId || !appSecret) throw new Error('ESIGN_APP_ID and ESIGN_APP_SECRET required');

  // TODO: 对接 e签宝 获取 Token
  // const res = await fetch(`${config.serverUrl}/v3/auth/token`, {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({ appId, secret: appSecret, grantType: 'client_credentials' }),
  // });
  // return res.json().data.accessToken;

  console.log('[ESign] getToken mock');
  return `mock-token-${crypto.randomBytes(8).toString('hex')}`;
}
