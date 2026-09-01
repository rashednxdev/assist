import type { Request, Response } from 'express';
import type { AuthRequest } from '../../middleware/auth.js';
import * as salaryService from './salary.service.js';

export async function calculateAllPhasesHandler(req: Request, res: Response): Promise<void> {
  const results = await salaryService.calculateAllPhasesWithTracking(req.body);
  res.json({ data: { results } });
}

/** Tracks PDF/print usage — PDF is generated in the browser from the live page. */
export async function trackSalaryPdfHandler(_req: Request, res: Response): Promise<void> {
  try {
    await salaryService.trackPdfDownload();
  } catch {
    /* stats must not block the client */
  }
  res.json({ data: { ok: true } });
}

export async function getSalaryStatsHandler(_req: AuthRequest, res: Response): Promise<void> {
  const data = await salaryService.getSalaryUsageStats();
  res.json({ data });
}
