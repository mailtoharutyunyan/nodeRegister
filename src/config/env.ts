import { z } from 'zod';

/**
 * All configuration comes from the environment and is validated once, at boot.
 *
 * The 2019 version hardcoded a live MongoDB password and the JWT secret in
 * `config/keys.js` and `config/auth.js` and committed both. Nothing here is
 * allowed to have a default that would be unsafe in production.
 */
const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3002),

  MONGO_URI: z.string().min(1, 'MONGO_URI is required'),

  // 32 chars minimum so a weak secret cannot be shipped by accident.
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be >= 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be >= 32 characters'),

  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),

  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
});

export type Env = z.infer<typeof EnvSchema>;

function loadEnv(): Env {
  const parsed = EnvSchema.safeParse(process.env);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    // Fail loudly at boot rather than 500-ing on the first request.
    throw new Error(`Invalid environment configuration:\n${details}`);
  }

  if (parsed.data.JWT_ACCESS_SECRET === parsed.data.JWT_REFRESH_SECRET) {
    throw new Error('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different values');
  }

  return parsed.data;
}

export const env = loadEnv();

export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
