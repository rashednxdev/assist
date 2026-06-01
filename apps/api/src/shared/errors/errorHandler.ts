import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError } from './AppError.js';
import { logger } from '../logger.js';

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
      },
    });
    return;
  }

  if (err instanceof ZodError) {
    const first = err.issues[0];
    const field = first?.path.length ? first.path.join('.') : undefined;
    const detail = first?.message ?? 'Validation failed';
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: field ? `${field}: ${detail}` : detail,
        details: err.flatten(),
      },
    });
    return;
  }

  logger.error({ err }, 'Unhandled error');
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
    },
  });
}
