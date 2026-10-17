import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate } from '../../middleware/auth.js';
import { requireAdmin } from '../../middleware/requireAdmin.js';
import { asyncHandler } from '../../shared/asyncHandler.js';
import {
  adminRenameStaffOfficeHandler,
  adminResetSalaryOfficeHandler,
  adminSetOfficeNameEditableHandler,
  adminSetAccountingOfficeHandler,
  adminSetOfficeAdminHandler,
  adminPrintReportHandler,
  myPrintReportHandler,
  searchBillPassingOfficesHandler,
  setMyAccountingOfficeHandler,
  getSalaryFreeCalcsHandler,
  updateSalaryFreeCalcsHandler,
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
  salaryJoinedOfficesHandler,
  rejectBillRequestHandler,
  requestBillsHandler,
  saveMySalaryOfficeHandler,
  searchOtherOfficesHandler,
  trackSalaryPdfHandler,
  recordSalaryPaymentHandler,
  updateBillAccessHandler,
  updateBillAccessNoteHandler,
  getBillAccessStatsHandler,
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
salaryRouter.get('/public/joined-offices', publicLimit, asyncHandler(salaryJoinedOfficesHandler));

salaryRouter.get('/admin/stats', authenticate, requireAdmin, asyncHandler(getSalaryStatsHandler));

salaryRouter.get('/office', authenticate, asyncHandler(getMySalaryOfficeHandler));
salaryRouter.get('/office/settings', authenticate, asyncHandler(getSalaryOfficeSettingsHandler));
salaryRouter.get('/office/others', authenticate, asyncHandler(searchOtherOfficesHandler));
salaryRouter.put('/office', authenticate, publicLimit, asyncHandler(saveMySalaryOfficeHandler));
salaryRouter.get('/office/bill-passing', authenticate, asyncHandler(searchBillPassingOfficesHandler));
salaryRouter.put('/office/accounting', authenticate, publicLimit, asyncHandler(setMyAccountingOfficeHandler));
salaryRouter.get('/access', authenticate, asyncHandler(getMyBillAccessHandler));
salaryRouter.get('/my-downloads', authenticate, asyncHandler(myPrintReportHandler));
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
salaryRouter.get('/admin/access-stats', authenticate, requireAdmin, asyncHandler(getBillAccessStatsHandler));
salaryRouter.get('/admin/print-report', authenticate, requireAdmin, asyncHandler(adminPrintReportHandler));
salaryRouter.put('/admin/access/:userId', authenticate, requireAdmin, asyncHandler(updateBillAccessHandler));
salaryRouter.put('/admin/access/:userId/note', authenticate, requireAdmin, asyncHandler(updateBillAccessNoteHandler));
salaryRouter.post('/admin/access/:userId/payment', authenticate, requireAdmin, asyncHandler(recordSalaryPaymentHandler));
salaryRouter.post('/admin/access/:userId/reject', authenticate, requireAdmin, asyncHandler(rejectBillRequestHandler));
salaryRouter.get('/admin/access/:userId/usage', authenticate, requireAdmin, asyncHandler(listBillUsageHandler));
salaryRouter.get('/admin/contacts', authenticate, requireAdmin, asyncHandler(getSalaryContactsHandler));
salaryRouter.put('/admin/contacts', authenticate, requireAdmin, asyncHandler(updateSalaryContactsHandler));
salaryRouter.get('/admin/bulk-size', authenticate, requireAdmin, asyncHandler(getSalaryBulkSizeHandler));
salaryRouter.put('/admin/bulk-size', authenticate, requireAdmin, asyncHandler(updateSalaryBulkSizeHandler));
salaryRouter.put('/admin/office-settings', authenticate, requireAdmin, asyncHandler(updateSalaryOfficeSettingsHandler));
salaryRouter.get('/admin/free-tr-form', authenticate, requireAdmin, asyncHandler(getSalaryFreeTrFormHandler));
salaryRouter.put('/admin/free-tr-form', authenticate, requireAdmin, asyncHandler(updateSalaryFreeTrFormHandler));
salaryRouter.get('/admin/free-calcs', authenticate, requireAdmin, asyncHandler(getSalaryFreeCalcsHandler));
salaryRouter.put('/admin/free-calcs', authenticate, requireAdmin, asyncHandler(updateSalaryFreeCalcsHandler));
salaryRouter.put('/admin/staff-offices/:officeId', authenticate, requireAdmin, asyncHandler(adminRenameStaffOfficeHandler));
salaryRouter.get('/admin/offices', authenticate, requireAdmin, asyncHandler(listSalaryUserOfficesHandler));
salaryRouter.put('/admin/offices/:userId', authenticate, requireAdmin, asyncHandler(adminUpdateOtherOfficeHandler));
salaryRouter.put(
  '/admin/offices/:userId/office-name-editable',
  authenticate,
  requireAdmin,
  asyncHandler(adminSetOfficeNameEditableHandler),
);
salaryRouter.put('/admin/offices/:userId/office-admin', authenticate, requireAdmin, asyncHandler(adminSetOfficeAdminHandler));
salaryRouter.put(
  '/admin/offices/:userId/accounting-office',
  authenticate,
  requireAdmin,
  asyncHandler(adminSetAccountingOfficeHandler),
);
salaryRouter.delete('/admin/offices/:userId', authenticate, requireAdmin, asyncHandler(adminResetSalaryOfficeHandler));
