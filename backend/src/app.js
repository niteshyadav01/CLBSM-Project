import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import router from './routes/index.js';
import { allowedClientOrigins } from './config/runtimeConfig.js';
import { errorHandler } from './middleware/errorHandler.js';

const frontendDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../frontend/dist');

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
      },
    },
  }));
  const configuredOrigins = (allowedClientOrigins().join(',') || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const origins = configuredOrigins.map((origin) => {
    try {
      return new URL(origin).origin;
    } catch {
      return origin;
    }
  });
  app.use(cors({ origin: origins, exposedHeaders: ['Content-Disposition'] }));
  app.use(express.json({ limit: '1mb' }));
  if (process.env.NODE_ENV === 'production') app.use(morgan('tiny'));
  else if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'));
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
  app.get('/api/health', (req, res) => {
    const ready = mongoose.connection.readyState === 1;
    res.status(ready ? 200 : 503).json({ ok: ready, service: 'clbsm-api' });
  });
  app.use('/api', router);
  if (process.env.NODE_ENV === 'production' && fs.existsSync(path.join(frontendDist, 'index.html'))) {
    app.use(express.static(frontendDist));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      res.sendFile(path.join(frontendDist, 'index.html'), (error) => {
        if (error) next(error);
      });
    });
  }
  app.use((req, res) => res.status(404).json({ message: 'Not found', code: 'NOT_FOUND' }));
  app.use(errorHandler);
  return app;
}
