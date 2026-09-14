import rateLimit from 'express-rate-limit';
import { env, isTest } from '../config/env.js';

/**
 * The 2019 service had nothing here — `/auth/login` could be hit without limit,
 * which is what makes credential stuffing cheap.
 */
export const globalLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: env.RATE_LIMIT_MAX,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => isTest,
});

/** Tighter budget for the endpoints worth brute-forcing. */
export const authLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many attempts, try again later' } },
  skip: () => isTest,
});
