import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { ZodError } from 'zod';
import { AppError } from './AppError.js';
import { logger } from '../logger.js';

function isMongoDuplicateKeyError(err: unknown): err is { code: number; keyPattern?: Record<string, number> } {
  return typeof err === 'object' && err !== null && 'code' in err && (err as { code: number }).code === 11000;
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof multer.MulterError) {
    const message =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'PDF file is too large'
        : err.code === 'LIMIT_UNEXPECTED_FILE'
          ? 'Upload the PDF using the field name "pdf"'
          : err.message;
    res.status(400).json({ error: { code: 'UPLOAD_ERROR', message } });
    return;
  }

  if (err instanceof Error && err.message === 'Only PDF files are allowed') {
    res.status(400).json({ error: { code: 'INVALID_FILE', message: err.message } });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
      },
    });
    return;
  }

  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({
      error: {
        code: 'INVALID_JSON',
        message: 'Request body must be valid JSON',
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

  if (isMongoDuplicateKeyError(err)) {
    const keys = err.keyPattern ? Object.keys(err.keyPattern) : [];
    let message = 'A record with these values already exists';
    if (keys.includes('question_number') && keys.includes('paper_id')) {
      message = 'Question number already used on this paper';
    } else if (keys.includes('part_label') && keys.includes('paper_question_id')) {
      message = 'This part label is already used on this question — choose another label (e.g. (b)) or edit the existing sub-part';
    }
    res.status(400).json({
      error: {
        code: 'DUPLICATE_KEY',
        message,
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
