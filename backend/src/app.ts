import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import type { Container } from './container';
import { buildRoutes } from './routes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { rateLimit } from './middleware/rateLimit';

export function createApp(c: Container) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(
    cors({
      origin: c.env.CORS_ORIGIN.split(',').map((o) => o.trim()),
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  app.use('/api', rateLimit({ keyPrefix: 'api', windowMs: 60_000, max: c.env.NODE_ENV === 'test' ? 100_000 : 300 }));
  app.use('/api', buildRoutes(c));
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
