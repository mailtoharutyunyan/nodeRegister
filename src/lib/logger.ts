import { pino } from 'pino';
import { env, isProduction, isTest } from '../config/env.js';

export const logger = pino({
  level: isTest ? 'silent' : env.LOG_LEVEL,
  transport: isProduction ? undefined : { target: 'pino-pretty', options: { colorize: true } },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.body.password',
      'req.body.refreshToken',
      'res.headers["set-cookie"]',
    ],
    censor: '[redacted]',
  },
});
