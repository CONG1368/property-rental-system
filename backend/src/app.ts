import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { rateLimitMiddleware } from './middleware/rate-limiter.js';
import { errorHandler } from './middleware/error-handler.js';
import routes from './routes/index.js';

import { config } from './config/index.js';
const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:3001', 'file://', 'null'], credentials: true }));
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
// 静态文件 — 上传的头像、合同附件
app.use('/uploads', express.static(config.upload.dir));
app.use('/api', routes);
app.use(errorHandler);

export default app;
