import express, { type Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { pinoHttp } from 'pino-http';
import mongoose from 'mongoose';
import { env, isTest } from './config/env.js';
import { logger } from './lib/logger.js';
import { globalLimiter } from './middleware/rateLimit.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { authRouter } from './modules/auth/auth.routes.js';

/**
 * Builds the app without listening, so tests can drive it through supertest
 * with no open port. The 2019 `index.js` called `app.listen` at import time,
 * which is a large part of why it was untestable.
 */
export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1); // rate limiter needs the real client IP behind a proxy

  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));

  // Body size cap. 2019 registered express.json() AND body-parser.json(), plus
  // both urlencoded variants — four parsers where two will do. body-parser has
  // been built into Express since 4.16.
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: false, limit: '100kb' }));

  if (!isTest) {
    app.use(pinoHttp({ logger }));
  }

  app.use(globalLimiter);

  app.get('/health', (_req, res) => {
    const dbUp = mongoose.connection.readyState === 1;
    res.status(dbUp ? 200 : 503).json({
      status: dbUp ? 'ok' : 'degraded',
      db: dbUp ? 'connected' : 'disconnected',
      uptime: process.uptime(),
    });
  });

  app.use('/auth', authRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
