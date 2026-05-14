import { Router } from 'express';
import crypto from 'crypto';
import { reconcilePayment } from '../services/payment-reconciler.js';

const router = Router();

// POST /api/callbacks/mock-payment — 模拟支付回调（开发测试用）
router.post('/mock-payment', async (req, res) => {
  try {
    const { billId, amount, channel } = req.body;
    const targetBillId = Number(billId) || 1;
    await reconcilePayment(
      targetBillId,
      Number(amount || 0),
      channel || 'Mock',
      `MOCK-${Date.now()}`,
      0
    );
    res.json({ code: 200, message: '模拟支付回调已处理', data: { billId: targetBillId } });
  } catch (err: any) {
    // 测试模式下账单可能不存在，返回 200 而非 500
    if (err.message === '账单不存在') {
      return res.json({ code: 200, message: 'Mock: 账单不存在，跳过（测试模式）', data: { skipped: true } });
    }
    console.error('[MockPayment] Error:', err);
    res.status(500).json({ code: 500, message: err.message || '模拟回调处理失败' });
  }
});

// 验证微信支付签名
function verifyWechatSign(params: Record<string, string>, key: string): boolean {
  const sign = params.sign || '';
  const sorted = Object.keys(params)
    .filter((k) => k !== 'sign' && params[k] !== '')
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
  const expected = crypto.createHash('md5').update(`${sorted}&key=${key}`).digest('hex').toUpperCase();
  return sign === expected;
}

// 验证支付宝签名（简化版——实际需使用支付宝SDK）
function verifyAlipaySign(params: Record<string, string>): boolean {
  // 支付宝异步通知使用 RSA 签名验证
  // 生产环境需引入 alipay-sdk 并验证
  console.log('[Alipay] signature verification placeholder for:', params.out_trade_no);
  return true;
}

// POST /api/callbacks/wechat-pay — 微信支付回调
router.post('/wechat-pay', async (req, res) => {
  try {
    const params = req.body;
    const mchKey = process.env.WECHAT_MCH_KEY || '';

    if (!verifyWechatSign(params, mchKey)) {
      console.warn('[WechatPay] Invalid signature');
      return res.status(400).send('<xml><return_code>FAIL</return_code><return_msg>签名验证失败</return_msg></xml>');
    }

    const outTradeNo = params.out_trade_no;  // 对应 billNo 或自定义订单号
    const totalFee = Number(params.total_fee || 0) / 100; // 分转元
    const transactionId = params.transaction_id || '';

    // 根据 out_trade_no 匹配账单
    const billIdMatch = outTradeNo.match(/BILL-(\d+)/);
    if (!billIdMatch) {
      console.warn('[WechatPay] Cannot parse bill ID from out_trade_no:', outTradeNo);
      return res.send('<xml><return_code>SUCCESS</return_code><return_msg>OK</return_msg></xml>');
    }

    await reconcilePayment(
      Number(billIdMatch[1]),
      totalFee,
      '微信',
      transactionId,
      0 // system trigger, no userId
    );

    console.log(`[WechatPay] Payment reconciled: bill=${billIdMatch[1]}, amount=${totalFee}`);
    res.send('<xml><return_code>SUCCESS</return_code><return_msg>OK</return_msg></xml>');
  } catch (err: any) {
    console.error('[WechatPay] Callback error:', err);
    res.status(500).send('<xml><return_code>FAIL</return_code><return_msg>处理失败</return_msg></xml>');
  }
});

// POST /api/callbacks/alipay — 支付宝回调
router.post('/alipay', async (req, res) => {
  try {
    const params = req.body;

    if (!verifyAlipaySign(params)) {
      console.warn('[Alipay] Invalid signature');
      return res.status(400).send('fail');
    }

    const outTradeNo = params.out_trade_no || '';
    const totalAmount = Number(params.total_amount || 0);
    const tradeNo = params.trade_no || '';

    const billIdMatch = outTradeNo.match(/BILL-(\d+)/);
    if (!billIdMatch) {
      console.warn('[Alipay] Cannot parse bill ID:', outTradeNo);
      return res.send('success'); // 确认收到避免重复通知
    }

    await reconcilePayment(
      Number(billIdMatch[1]),
      totalAmount,
      '支付宝',
      tradeNo,
      0
    );

    console.log(`[Alipay] Payment reconciled: bill=${billIdMatch[1]}, amount=${totalAmount}`);
    res.send('success');
  } catch (err: any) {
    console.error('[Alipay] Callback error:', err);
    res.status(500).send('fail');
  }
});

export default router;
