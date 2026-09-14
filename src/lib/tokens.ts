import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { UnauthorizedError } from './AppError.js';

export type UserRole = 'user' | 'admin';

export interface AccessTokenPayload {
  sub: string;
  role: UserRole;
}

const ALGORITHM = 'HS256' as const;

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    algorithm: ALGORITHM,
    expiresIn: env.ACCESS_TOKEN_TTL as jwt.SignOptions['expiresIn'],
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    // Pinning `algorithms` is what stops an attacker handing us a token signed
    // with a different algorithm. The 2019 code passed `null` options here.
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, {
      algorithms: [ALGORITHM],
    });

    if (typeof decoded === 'string' || !decoded.sub || typeof decoded.sub !== 'string') {
      throw new UnauthorizedError('Invalid access token');
    }

    return { sub: decoded.sub, role: (decoded as jwt.JwtPayload).role as UserRole };
  } catch (error) {
    if (error instanceof UnauthorizedError) throw error;
    throw new UnauthorizedError('Invalid or expired access token');
  }
}

/**
 * Refresh tokens are opaque random strings, not JWTs. Only their SHA-256 hash
 * is stored, so a database leak does not hand out live sessions.
 *
 * This is what makes logout actually work. In the 2019 version logout flipped a
 * `status` column and the 24-hour JWT stayed valid the whole time.
 */
export function generateRefreshToken(): string {
  return crypto.randomBytes(48).toString('base64url');
}

export function hashRefreshToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function refreshTokenExpiry(): Date {
  return new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
}

/** Pull a bearer token out of the Authorization header. Header only — see auth middleware. */
export function extractBearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const [scheme, value] = header.split(' ');
  if (!value || scheme?.toLowerCase() !== 'bearer') return null;
  return value.trim() || null;
}
