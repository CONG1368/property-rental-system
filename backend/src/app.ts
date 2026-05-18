import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { rateLimitMiddleware } from './middleware/rate-limiter.js';
import { errorHandler } from './middleware/error-handler.js';
import routes from './routes/index.js';

import { config } from './config/index.js';
const app = express();

app.use(helmet({ contentSecurityPolicy: false }));

// 自定义 CORS — 动态回显请求 Origin，兼容 Electron file:// 协议（Origin: null）
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,PATCH,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Requested-With');
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});

// 健康检查 — 供 Electron 主进程和前端轮询后端就绪状态（在路由挂载前，无需认证）
app.get('/api/health', (_req, res) => {
  res.json({ code: 200, data: { status: 'ok', uptime: process.uptime() } });
});

app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
// 静态文件 — 上传的头像、合同附件
app.use('/uploads', express.static(config.upload.dir));
app.use('/api', routes);
app.use(errorHandler);

export default app;
