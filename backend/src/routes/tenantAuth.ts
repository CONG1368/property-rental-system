import { Router } from 'express';
import jwt from 'jsonwebtoken';
import Tenant from '../models/Tenant.js';
import { config } from '../config/index.js';

const router = Router();

// POST /api/tenant-auth/login — 租户手机号+口令登录
router.post('/login', async (req, res) => {
  try {
    const { phone, pin } = req.body;
    if (!phone || !pin) return res.status(400).json({ code: 400, message: '手机号与口令必填' });
    const tenant = await Tenant.findOne({ where: { phone } });
    if (!tenant || String((tenant as any).loginPin || '') !== String(pin)) {
      return res.status(401).json({ code: 401, message: '手机号或口令错误' });
    }
    const token = jwt.sign({ tenantId: (tenant as any).id, tenantType: 'tenant', name: (tenant as any).name }, config.jwt.secret, { expiresIn: '4h' });
    res.json({ code: 200, data: { token, tenant: { id: (tenant as any).id, name: (tenant as any).name, phone: (tenant as any).phone, creditGrade: (tenant as any).creditGrade } }, message: '登录成功' });
  } catch (err: any) { res.status(500).json({ code: 500, message: err.message }); }
});

export default router;
