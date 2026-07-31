import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireAdmin } from '../../middleware/requireAdmin.js';
import { requireModuleAccess } from '../../middleware/requireModuleAccess.js';
import { asyncHandler } from '../../shared/asyncHandler.js';
import {
  listSubjectsHandler,
  listDatesForSubjectHandler,
  getEntryDetailHandler,
  listSyllabusQuestionsHandler,
  listAdminEntriesHandler,
  createEntryHandler,
  updateEntryHandler,
  deleteEntryHandler,
  getSettingsHandler,
  updateSettingsHandler,
} from './qotd.controller.js';

export const qotdRouter = Router();

qotdRouter.use(authenticate);

const readAccess = requireModuleAccess('QOTD');

qotdRouter.get('/subjects', readAccess, asyncHandler(listSubjectsHandler));
qotdRouter.get('/subjects/:subjectId/dates', readAccess, asyncHandler(listDatesForSubjectHandler));
qotdRouter.get('/entries/:id', readAccess, asyncHandler(getEntryDetailHandler));
qotdRouter.get('/settings', readAccess, asyncHandler(getSettingsHandler));

qotdRouter.get('/subjects/:subjectId/questions', requireAdmin, asyncHandler(listSyllabusQuestionsHandler));
qotdRouter.get('/admin/entries', requireAdmin, asyncHandler(listAdminEntriesHandler));
qotdRouter.post('/entries', requireAdmin, asyncHandler(createEntryHandler));
qotdRouter.patch('/entries/:id', requireAdmin, asyncHandler(updateEntryHandler));
qotdRouter.delete('/entries/:id', requireAdmin, asyncHandler(deleteEntryHandler));
qotdRouter.put('/settings', requireAdmin, asyncHandler(updateSettingsHandler));
