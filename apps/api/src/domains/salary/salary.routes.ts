import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate } from '../../middleware/auth.js';
import { requireAdmin } from '../../middleware/requireAdmin.js';
import { asyncHandler } from '../../shared/asyncHandler.js';
import {
  adminResetSalaryOfficeHandler,
  adminUpdateOtherOfficeHandler,
  calculateAllPhasesHandler,
  consumeBillHandler,
  listSalaryUserOfficesHandler,
  consumeStaffBillHandler,
  createMyStaffHandler,
  createMyStaffOfficeHandler,
  deleteMyStaffHandler,
  deleteMyStaffOfficeHandler,
  listMyStaffOfficesHandler,
  updateMyStaffOfficeHandler,
  getMyBillAccessHandler,
  listMyStaffHandler,
  updateMyStaffHandler,
  getMySalaryOfficeHandler,
  getSalaryBulkSizeHandler,
  getSalaryContactsHandler,
  getSalaryFreeTrFormHandler,
  getSalaryOfficeSettingsHandler,
  getSalaryStatsHandler,
  listBillAccessHandler,
  listBillUsageHandler,
  recordArrearsCalcHandler,
  rejectBillRequestHandler,
  requestBillsHandler,
  saveMySalaryOfficeHandler,
  searchOtherOfficesHandler,
  trackSalaryPdfHandler,
  updateBillAccessHandler,
  updateSalaryBulkSizeHandler,
  updateSalaryContactsHandler,
  updateSalaryFreeTrFormHandler,
  updateSalaryOfficeSettingsHandler,
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
salaryRouter.get('/office/settings', authenticate, asyncHandler(getSalaryOfficeSettingsHandler));
salaryRouter.get('/office/others', authenticate, asyncHandler(searchOtherOfficesHandler));
salaryRouter.put('/office', authenticate, publicLimit, asyncHandler(saveMySalaryOfficeHandler));
salaryRouter.get('/access', authenticate, asyncHandler(getMyBillAccessHandler));
salaryRouter.post('/access/request', authenticate, publicLimit, asyncHandler(requestBillsHandler));
salaryRouter.post('/bills', authenticate, publicLimit, asyncHandler(consumeBillHandler));
salaryRouter.post('/arrears-calc', authenticate, publicLimit, asyncHandler(recordArrearsCalcHandler));
salaryRouter.get('/staff', authenticate, asyncHandler(listMyStaffHandler));
salaryRouter.post('/staff', authenticate, publicLimit, asyncHandler(createMyStaffHandler));
salaryRouter.post('/staff/bill', authenticate, publicLimit, asyncHandler(consumeStaffBillHandler));
salaryRouter.get('/staff/offices', authenticate, asyncHandler(listMyStaffOfficesHandler));
salaryRouter.post('/staff/offices', authenticate, publicLimit, asyncHandler(createMyStaffOfficeHandler));
salaryRouter.put('/staff/offices/:officeId', authenticate, publicLimit, asyncHandler(updateMyStaffOfficeHandler));
salaryRouter.delete('/staff/offices/:officeId', authenticate, publicLimit, asyncHandler(deleteMyStaffOfficeHandler));
salaryRouter.put('/staff/:staffId', authenticate, publicLimit, asyncHandler(updateMyStaffHandler));
salaryRouter.delete('/staff/:staffId', authenticate, publicLimit, asyncHandler(deleteMyStaffHandler));

salaryRouter.get('/admin/access', authenticate, requireAdmin, asyncHandler(listBillAccessHandler));
salaryRouter.put('/admin/access/:userId', authenticate, requireAdmin, asyncHandler(updateBillAccessHandler));
salaryRouter.post('/admin/access/:userId/reject', authenticate, requireAdmin, asyncHandler(rejectBillRequestHandler));
salaryRouter.get('/admin/access/:userId/usage', authenticate, requireAdmin, asyncHandler(listBillUsageHandler));
salaryRouter.get('/admin/contacts', authenticate, requireAdmin, asyncHandler(getSalaryContactsHandler));
salaryRouter.put('/admin/contacts', authenticate, requireAdmin, asyncHandler(updateSalaryContactsHandler));
salaryRouter.get('/admin/bulk-size', authenticate, requireAdmin, asyncHandler(getSalaryBulkSizeHandler));
salaryRouter.put('/admin/bulk-size', authenticate, requireAdmin, asyncHandler(updateSalaryBulkSizeHandler));
salaryRouter.put('/admin/office-settings', authenticate, requireAdmin, asyncHandler(updateSalaryOfficeSettingsHandler));
salaryRouter.get('/admin/free-tr-form', authenticate, requireAdmin, asyncHandler(getSalaryFreeTrFormHandler));
salaryRouter.put('/admin/free-tr-form', authenticate, requireAdmin, asyncHandler(updateSalaryFreeTrFormHandler));
salaryRouter.get('/admin/offices', authenticate, requireAdmin, asyncHandler(listSalaryUserOfficesHandler));
salaryRouter.put('/admin/offices/:userId', authenticate, requireAdmin, asyncHandler(adminUpdateOtherOfficeHandler));
salaryRouter.delete('/admin/offices/:userId', authenticate, requireAdmin, asyncHandler(adminResetSalaryOfficeHandler));
