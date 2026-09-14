import type { NextFunction, Request, Response } from 'express';
import type { ZodType } from 'zod';
import { ValidationError } from '../lib/AppError.js';

/**
 * Replaces `req.body` with the parsed result, so downstream code sees only
 * whitelisted, correctly typed fields — unknown keys are dropped rather than
 * forwarded into `new User(req.body)`.
 */
export function validate(schema: ZodType) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of result.error.issues) {
        const key = issue.path.join('.') || '_';
        (fieldErrors[key] ??= []).push(issue.message);
      }
      // 422, not the 403 the 2019 code used for validation failures.
      next(new ValidationError('Validation failed', fieldErrors));
      return;
    }

    req.body = result.data;
    next();
  };
}
