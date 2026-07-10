import type { Request, Response } from 'express';
import { joiningPeriodCalculateSchema, calculateJoiningPeriod } from '@ibas/shared-types';
import { badRequest } from '../../shared/errors/AppError.js';

export async function calculateJoiningPeriodHandler(req: Request, res: Response): Promise<void> {
  const parsed = joiningPeriodCalculateSchema.safeParse(req.body);
  if (!parsed.success) {
    throw badRequest(parsed.error.issues.map((i) => i.message).join('; '));
  }
  const data = calculateJoiningPeriod(parsed.data);
  res.json({ data });
}
