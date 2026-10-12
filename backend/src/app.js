import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import router from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(helmet());
  const origins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.use(cors({ origin: origins, exposedHeaders: ['Content-Disposition'] }));
  app.use(express.json({ limit: '1mb' }));
  if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'));
  if (process.env.NODE_ENV !== 'test') {
    app.use(
      '/api',
      rateLimit({
        windowMs: 60 * 1000,
        limit: 300,
        message: { message: 'Too many requests. Please wait a moment.', code: 'RATE_LIMIT' },
      })
    );
  }
  app.get('/api/health', (req, res) => res.json({ ok: true, service: 'clbsm-api' }));
  app.use('/api', router);
  app.use((req, res) => res.status(404).json({ message: 'Not found', code: 'NOT_FOUND' }));
  app.use(errorHandler);
  return app;
}
