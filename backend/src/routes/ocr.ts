import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { AuthRequest } from '../middleware/auth.js';
import { getOcrProvider, ocrLog, OcrDocType } from '../services/ocr-service.js';

const router = Router();
const uploadDir = 'uploads/ocr';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({
  dest: uploadDir,
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.jpg', '.jpeg', '.png', '.webp', '.bmp'].includes(ext)) cb(null, true);
    else cb(new Error('仅支持图片格式'));
  },
});

// POST /api/ocr/recognize — 上传图片识别文档字段
router.post('/recognize', upload.single('image'), async (req: AuthRequest, res) => {
  try {
    const docType = String(req.body.docType || 'id-card') as OcrDocType;
    if (!req.file) return res.status(400).json({ code: 400, message: '请上传图片' });
    const imagePath = path.join(uploadDir, req.file.filename);
    const provider = getOcrProvider();
    const result = await provider.recognize(imagePath, docType);
    ocrLog(imagePath, docType, result);
    res.json({ code: 200, data: { docType, ...result }, message: '识别完成' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

export default router;
