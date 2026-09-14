import type { NextFunction, Request, Response } from 'express';
import { AppError, NotFoundError } from '../lib/AppError.js';
import { isProduction } from '../config/env.js';
import { logger } from '../lib/logger.js';

/** Anything that falls through the router. The 2019 app had no 404 handler. */
export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(new NotFoundError(`Route ${req.method} ${req.originalUrl} not found`));
}

/**
 * The single place an error becomes an HTTP response.
 *
 * In 2019 this logic lived inside `ResponseManager.onError`, was called from
 * both the service and the controller, and fell back to a 500 carrying the raw
 * error message — so an unhandled Mongo E11000 leaked its internal text to the
 * client.
 */
export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (res.headersSent) {
    next(error);
    return;
  }

  if (error instanceof AppError) {
    if (error.statusCode >= 500) {
      logger.error({ err: error }, 'Application error');
    }
    res.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {}),
      },
    });
    return;
  }

  // Malformed JSON from express.json()
  if (error instanceof SyntaxError && 'body' in error) {
    res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Request body is not valid JSON' } });
    return;
  }

  logger.error({ err: error }, 'Unhandled error');

  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      // Never hand an internal message or a stack trace to a client in prod.
      message: 'Internal server error',
      ...(isProduction ? {} : { debug: error instanceof Error ? error.message : String(error) }),
    },
  });
}
