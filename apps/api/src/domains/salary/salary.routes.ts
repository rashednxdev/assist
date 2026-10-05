import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate } from '../../middleware/auth.js';
import { requireAdmin } from '../../middleware/requireAdmin.js';
import { asyncHandler } from '../../shared/asyncHandler.js';
import {
  calculateAllPhasesHandler,
  consumeBillHandler,
  getMyBillAccessHandler,
  getMySalaryOfficeHandler,
  getSalaryBulkSizeHandler,
  getSalaryContactsHandler,
  getSalaryStatsHandler,
  listBillAccessHandler,
  listBillUsageHandler,
  rejectBillRequestHandler,
  requestBillsHandler,
  saveMySalaryOfficeHandler,
  trackSalaryPdfHandler,
  updateBillAccessHandler,
  updateSalaryBulkSizeHandler,
  updateSalaryContactsHandler,
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

salaryRouter.get('/office', authenticate, asyncHandler(getMySalaryOfficeHandler));
salaryRouter.put('/office', authenticate, publicLimit, asyncHandler(saveMySalaryOfficeHandler));
salaryRouter.get('/access', authenticate, asyncHandler(getMyBillAccessHandler));
salaryRouter.post('/access/request', authenticate, publicLimit, asyncHandler(requestBillsHandler));
salaryRouter.post('/bills', authenticate, publicLimit, asyncHandler(consumeBillHandler));

salaryRouter.get('/admin/access', authenticate, requireAdmin, asyncHandler(listBillAccessHandler));
salaryRouter.put('/admin/access/:userId', authenticate, requireAdmin, asyncHandler(updateBillAccessHandler));
salaryRouter.post('/admin/access/:userId/reject', authenticate, requireAdmin, asyncHandler(rejectBillRequestHandler));
salaryRouter.get('/admin/access/:userId/usage', authenticate, requireAdmin, asyncHandler(listBillUsageHandler));
salaryRouter.get('/admin/contacts', authenticate, requireAdmin, asyncHandler(getSalaryContactsHandler));
salaryRouter.put('/admin/contacts', authenticate, requireAdmin, asyncHandler(updateSalaryContactsHandler));
salaryRouter.get('/admin/bulk-size', authenticate, requireAdmin, asyncHandler(getSalaryBulkSizeHandler));
salaryRouter.put('/admin/bulk-size', authenticate, requireAdmin, asyncHandler(updateSalaryBulkSizeHandler));
