import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { rateLimitMiddleware } from './middleware/rate-limiter';
import { errorHandler } from './middleware/error-handler';
import routes from './routes';

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: ['http://localhost:5173', 'file://'], credentials: true }));
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/api', routes);
app.use(errorHandler);

export default app;
