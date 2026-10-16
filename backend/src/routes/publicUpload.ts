import { Router } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import crypto from 'node:crypto';
import multer from 'multer';
import Contract from '../models/Contract.js';
import AttachmentUploadSession from '../models/AttachmentUploadSession.js';
import Tenant from '../models/Tenant.js';
import '../models/index.js';

/**
 * 手机扫码/链接上传（用户 2026-10-16：附件便捷化第 ⑧ 项）。
 * 电脑端在合同附件面板点「手机上传」→ 生成一次性 token 与局域网地址 → 手机浏览器打开即可拍照或选文件，
 * **免装 App、免登录**；上传的文件直接挂到该合同的附件里（与电脑端上传同一份数据）。
 * 本路由为公开路由（不挂 authMiddleware），靠一次性 token + 有效期 + 合同范围约束。
 */
const router = Router();

const uploadDir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
const publicUpload = multer({
  dest: uploadDir,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowed = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png', '.xls', '.xlsx'];
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('仅支持 PDF/DOC/DOCX/图片/Excel 格式'));
  },
});

/**
 * 中文文件名修复：手机浏览器/表单上传时 multer 可能按 Latin-1 解码 Content-Disposition，
 * 导致「照片.jpg」变成乱码（与 contracts.ts 的上传端点同一处理）。
 */
function decodeFilename(name: string): string {
  const buf = Buffer.from(String(name || ''), 'latin1');
  const decoded = buf.toString('utf8');
  return decoded.includes('\uFFFD') ? name : decoded;
}

/** 取本机局域网 IPv4（手机要能访问电脑，不能是 127.0.0.1） */
export function getLanIp(): string {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return '127.0.0.1';
}

function page(title: string, body: string, ok = true): string {
  return '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8" />' +
    '<meta name="viewport" content="width=device-width,initial-scale=1" />' +
    '<title>' + title + '</title><style>' +
    'body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei",sans-serif;margin:0;padding:16px;background:#f5f6f8;color:#303133}' +
    '.card{background:#fff;border-radius:10px;padding:16px;box-shadow:0 1px 3px rgba(0,0,0,.08);max-width:520px;margin:0 auto}' +
    'h1{font-size:17px;margin:0 0 10px}' +
    '.muted{color:#909399;font-size:12px;line-height:1.7;margin:4px 0}' +
    'input[type=file]{width:100%;margin:12px 0;font-size:14px}' +
    'button{width:100%;padding:12px;border:0;border-radius:8px;background:' + (ok ? '#0a5c8a' : '#c45656') + ';color:#fff;font-size:16px}' +
    '.tip{font-size:12px;color:#606266;margin-top:12px;line-height:1.7}' +
    '.ok{color:#2f9e44;font-weight:bold}' +
    '</style></head><body><div class="card">' + body + '</div></body></html>';
}

async function loadSession(token: string) {
  const s = await AttachmentUploadSession.findOne({ where: { token } });
  if (!s) return { session: null, error: '链接无效或已被使用，请在电脑端重新生成' };
  if (new Date((s as any).expiresAt).getTime() < Date.now()) {
    (s as any).status = '已过期';
    await s.save();
    return { session: null, error: '链接已过期，请在电脑端重新生成' };
  }
  return { session: s, error: '' };
}

// GET /api/public/upload/:token — 手机上传页
router.get('/upload/:token', async (req, res) => {
  try {
    const { session, error } = await loadSession(req.params.token);
    if (!session) return res.status(410).send(page('链接不可用', '<h1>链接不可用</h1><p class="muted">' + error + '</p>', false));
    const contract: any = await Contract.findByPk((session as any).contractId, { include: [{ model: Tenant, as: 'tenant' }] });
    const tenant = contract?.tenant;
    const expires = new Date((session as any).expiresAt);
    const pad = (n: number) => String(n).padStart(2, '0');
    const expiresText = expires.getFullYear() + '-' + pad(expires.getMonth() + 1) + '-' + pad(expires.getDate()) + ' ' + pad(expires.getHours()) + ':' + pad(expires.getMinutes());
    res.send(page('上传合同附件', '<h1>上传合同附件</h1>' +
      '<p class="muted">合同：' + (contract?.contractNo || '') + '　承租人：' + (tenant?.name || '') + '</p>' +
      '<p class="muted">链接有效期至 ' + expiresText + '；上传后自动挂到该合同的附件里。</p>' +
      '<form method="post" enctype="multipart/form-data">' +
      '<input type="file" name="files" multiple required accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xls,.xlsx" capture="environment" />' +
      '<button type="submit">上传</button></form>' +
      '<p class="tip">支持 PDF / Word / 图片 / Excel；拍证件或单据照片可直接上传，建议光线充足、四角完整。</p>'));
  } catch (err: any) {
    res.status(500).send(page('出错了', '<h1>出错了</h1><p class="muted">' + String(err?.message || err) + '</p>', false));
  }
});

// POST /api/public/upload/:token — 手机提交文件
router.post('/upload/:token', publicUpload.array('files', 10), async (req, res) => {
  try {
    const { session, error } = await loadSession(req.params.token);
    const files = (req.files as Express.Multer.File[]) || [];
    if (!session) {
      files.forEach((f) => { try { fs.unlinkSync(f.path); } catch { /* 清理上传的临时文件 */ } });
      return res.status(410).send(page('链接不可用', '<h1>链接不可用</h1><p class="muted">' + error + '</p>', false));
    }
    if (files.length === 0) return res.status(400).send(page('没有收到文件', '<h1>没有收到文件</h1><p class="muted">请选择要上传的文件后重试。</p>', false));

    const contract: any = await Contract.findByPk((session as any).contractId);
    if (!contract) return res.status(404).send(page('合同不存在', '<h1>合同不存在</h1>', false));

    const cfg = ((contract as any).billingConfig || {}) as any;
    const mode = String((session as any).mode || 'direct');
    const added = files.map((f) => ({
      name: decodeFilename(f.originalname),   // 中文名需从 Latin-1 还原（否则附件名乱码）
      path: f.path,
      size: f.size,
      uploadedAt: new Date().toISOString(),
      title: '',
      group: '',
      source: mode === 'review' ? '租户上传' : '手机上传',
      ...(mode === 'review' ? { status: '待审核' } : {}),
    }));

    if (mode === 'review') {
      // 租户自助上传（第 ⑬ 项）：先进待审核箱，管理员通过后才成为正式附件
      const inbox = [...((cfg.attachmentInbox as any[]) || []), ...added];
      contract.billingConfig = { ...cfg, attachmentInbox: inbox };
    } else {
      const existing = [...((cfg.attachments as any[]) || [])];
      contract.billingConfig = { ...cfg, attachments: [...existing, ...added] };
    }
    (contract as any).changed('billingConfig', true);
    await contract.save();

    (session as any).status = mode === 'review' ? '待审核' : '已上传';
    (session as any).uploadedCount = ((session as any).uploadedCount || 0) + added.length;
    (session as any).files = [...((((session as any).files as any[]) || [])), ...added.map((a) => ({ name: a.name, path: a.path, size: a.size, uploadedAt: a.uploadedAt }))];
    (session as any).changed('files', true);
    await session.save();

    const review = String((session as any).mode || 'direct') === 'review';
    res.send(page(review ? '已提交' : '上传成功',
      '<h1 class="ok">' + (review ? '已提交，等待审核' : '上传成功') + '</h1>' +
      '<p class="muted">' + (review ? '已提交 ' : '已上传 ') + added.length + ' 个文件到合同 ' + (contract.contractNo || '') + '。</p>' +
      '<p class="tip">' + (review ? '管理员在电脑端「待审核附件」里通过后才会正式成为合同附件。' : '可以关闭本页；回到电脑端合同详情页点「刷新附件」即可看到。') + '</p>'));
    return;
  } catch (err: any) {
    res.status(500).send(page('上传失败', '<h1>上传失败</h1><p class="muted">' + String(err?.message || err) + '</p>', false));
  }
});

export default router;
