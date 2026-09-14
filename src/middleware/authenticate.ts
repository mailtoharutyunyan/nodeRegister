import type { NextFunction, Request, Response } from 'express';
import { ForbiddenError, UnauthorizedError } from '../lib/AppError.js';
import { extractBearerToken, verifyAccessToken, type UserRole } from '../lib/tokens.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: { id: string; role: UserRole };
    }
  }
}

/**
 * Bearer tokens from the Authorization header only.
 *
 * The 2019 middleware also accepted `req.query.token`, which writes the
 * credential into access logs, proxy logs and `Referer` headers on every
 * request. And it hit the database on every single call to re-read the user;
 * the signed claims are trustworthy, so route handlers that need the full
 * record can load it themselves.
 */
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const token = extractBearerToken(req.headers.authorization);

  if (!token) {
    next(new UnauthorizedError('Missing bearer token'));
    return;
  }

  const payload = verifyAccessToken(token);
  req.user = { id: payload.sub, role: payload.role };
  next();
}

/**
 * Role check. In 2019 this existed as `ValidateToken(role)` doing
 * `role.includes(user.role)`, but no route ever passed a role and the schema
 * had no role field, so it was dead code guarding nothing.
 */
export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new UnauthorizedError('Not authenticated'));
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(new ForbiddenError('Insufficient permissions'));
      return;
    }
    next();
  };
}
