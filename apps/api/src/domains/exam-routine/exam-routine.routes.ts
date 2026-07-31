import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireAdmin } from '../../middleware/requireAdmin.js';
import { requireModuleAccess } from '../../middleware/requireModuleAccess.js';
import { asyncHandler } from '../../shared/asyncHandler.js';
import {
  listMobileRoutinesHandler,
  getRoutineByExamNameHandler,
  listAdminRoutinesHandler,
  getAdminRoutineHandler,
  createRoutineHandler,
  updateRoutineHandler,
  addRoutineEntryHandler,
  updateRoutineEntryHandler,
  deleteRoutineEntryHandler,
} from './exam-routine.controller.js';

export const examRoutineRouter = Router();

examRoutineRouter.use(authenticate);

const readAccess = requireModuleAccess('EXAM_ROUTINE');

examRoutineRouter.get('/list', readAccess, asyncHandler(listMobileRoutinesHandler));
examRoutineRouter.get('/names/:examNameId', readAccess, asyncHandler(getRoutineByExamNameHandler));

examRoutineRouter.get('/admin', requireAdmin, asyncHandler(listAdminRoutinesHandler));
examRoutineRouter.get('/admin/:id', requireAdmin, asyncHandler(getAdminRoutineHandler));
examRoutineRouter.post('/', requireAdmin, asyncHandler(createRoutineHandler));
examRoutineRouter.patch('/:id', requireAdmin, asyncHandler(updateRoutineHandler));
examRoutineRouter.post('/:id/entries', requireAdmin, asyncHandler(addRoutineEntryHandler));
examRoutineRouter.patch('/entries/:id', requireAdmin, asyncHandler(updateRoutineEntryHandler));
examRoutineRouter.delete('/entries/:id', requireAdmin, asyncHandler(deleteRoutineEntryHandler));
