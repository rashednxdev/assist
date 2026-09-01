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
});

salaryRouter.post('/calculate-all-phases', publicLimit, asyncHandler(calculateAllPhasesHandler));
salaryRouter.post('/pdf', publicLimit, asyncHandler(trackSalaryPdfHandler));

salaryRouter.get('/admin/stats', authenticate, requireAdmin, asyncHandler(getSalaryStatsHandler));
