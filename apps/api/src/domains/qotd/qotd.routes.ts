import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireAdmin } from '../../middleware/requireAdmin.js';
import { asyncHandler } from '../../shared/asyncHandler.js';
import {
  listDatesHandler,
  getDateDetailHandler,
  listAdminDatesHandler,
  getAdminDateDetailHandler,
  listSyllabusQuestionsHandler,
  createEntryHandler,
  updateEntryHandler,
  deleteEntryHandler,
  getSettingsHandler,
  updateSettingsHandler,
} from './qotd.controller.js';

export const qotdRouter = Router();

qotdRouter.use(authenticate);

// QOTD learner reads are open to every authenticated user (still subject-filtered in the service).
qotdRouter.get('/dates', asyncHandler(listDatesHandler));
qotdRouter.get('/dates/:date', asyncHandler(getDateDetailHandler));
qotdRouter.get('/settings', asyncHandler(getSettingsHandler));

qotdRouter.get('/admin/dates', requireAdmin, asyncHandler(listAdminDatesHandler));
qotdRouter.get('/admin/dates/:date', requireAdmin, asyncHandler(getAdminDateDetailHandler));
qotdRouter.get('/subjects/:subjectId/questions', requireAdmin, asyncHandler(listSyllabusQuestionsHandler));
qotdRouter.post('/entries', requireAdmin, asyncHandler(createEntryHandler));
qotdRouter.patch('/entries/:id', requireAdmin, asyncHandler(updateEntryHandler));
qotdRouter.delete('/entries/:id', requireAdmin, asyncHandler(deleteEntryHandler));
qotdRouter.put('/settings', requireAdmin, asyncHandler(updateSettingsHandler));
