import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate } from '../../middleware/auth.js';
import { requireAdmin } from '../../middleware/requireAdmin.js';
import { asyncHandler } from '../../shared/asyncHandler.js';
import {
  calculateAllPhasesHandler,
  getSalaryStatsHandler,
  trackSalaryPdfHandler,
} from './salary.controller.js';

export const salaryRouter = Router();

const publicLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res, _next, options) => {
    res.status(options.statusCode).json({
      error: { code: 'RATE_LIMITED', message: 'Too many requests. Please wait a few minutes and try again.' },
    });
  },
});

salaryRouter.post('/calculate-all-phases', publicLimit, asyncHandler(calculateAllPhasesHandler));
salaryRouter.post('/pdf', publicLimit, asyncHandler(trackSalaryPdfHandler));

salaryRouter.get('/admin/stats', authenticate, requireAdmin, asyncHandler(getSalaryStatsHandler));
