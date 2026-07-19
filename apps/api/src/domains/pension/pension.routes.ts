import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireAdmin } from '../../middleware/requireAdmin.js';
import { requireModuleAccess } from '../../middleware/requireModuleAccess.js';
import { asyncHandler } from '../../shared/asyncHandler.js';
import {
  calculatePensionHandler,
  createLeaveTypeHandler,
  deleteLeaveTypeHandler,
  listLeaveTypesHandler,
  updateLeaveTypeHandler,
} from './pension.controller.js';

export const pensionRouter = Router();

pensionRouter.use(authenticate);

pensionRouter.get('/leave-types', requireModuleAccess('PENSION'), asyncHandler(listLeaveTypesHandler));
pensionRouter.post('/calculate', requireModuleAccess('PENSION'), asyncHandler(calculatePensionHandler));

pensionRouter.post('/leave-types', requireAdmin, asyncHandler(createLeaveTypeHandler));
pensionRouter.patch('/leave-types/:id', requireAdmin, asyncHandler(updateLeaveTypeHandler));
pensionRouter.delete('/leave-types/:id', requireAdmin, asyncHandler(deleteLeaveTypeHandler));
