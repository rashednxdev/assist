import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireAdmin } from '../../middleware/requireAdmin.js';
import { asyncHandler } from '../../shared/asyncHandler.js';
import {
  getSyllabusTreeHandler,
  createSyllabusGroupHandler,
  updateSyllabusGroupHandler,
  deleteSyllabusGroupHandler,
  createSyllabusTopicHandler,
  updateSyllabusTopicHandler,
  deleteSyllabusTopicHandler,
  createSyllabusSubTopicHandler,
  updateSyllabusSubTopicHandler,
  deleteSyllabusSubTopicHandler,
  createSyllabusReferenceHandler,
  updateSyllabusReferenceHandler,
  deleteSyllabusReferenceHandler,
  getSyllabusReferenceHandler,
} from './syllabus.controller.js';

export const syllabusRouter = Router();

syllabusRouter.use(authenticate);

syllabusRouter.get('/subjects/:subjectId/tree', asyncHandler(getSyllabusTreeHandler));

syllabusRouter.post('/groups', requireAdmin, asyncHandler(createSyllabusGroupHandler));
syllabusRouter.patch('/groups/:id', requireAdmin, asyncHandler(updateSyllabusGroupHandler));
syllabusRouter.delete('/groups/:id', requireAdmin, asyncHandler(deleteSyllabusGroupHandler));
syllabusRouter.post('/topics', requireAdmin, asyncHandler(createSyllabusTopicHandler));
syllabusRouter.patch('/topics/:id', requireAdmin, asyncHandler(updateSyllabusTopicHandler));
syllabusRouter.delete('/topics/:id', requireAdmin, asyncHandler(deleteSyllabusTopicHandler));
syllabusRouter.post('/sub-topics', requireAdmin, asyncHandler(createSyllabusSubTopicHandler));
syllabusRouter.patch('/sub-topics/:id', requireAdmin, asyncHandler(updateSyllabusSubTopicHandler));
syllabusRouter.delete('/sub-topics/:id', requireAdmin, asyncHandler(deleteSyllabusSubTopicHandler));
syllabusRouter.get('/references/:id', asyncHandler(getSyllabusReferenceHandler));
syllabusRouter.post('/references', requireAdmin, asyncHandler(createSyllabusReferenceHandler));
syllabusRouter.patch('/references/:id', requireAdmin, asyncHandler(updateSyllabusReferenceHandler));
syllabusRouter.delete('/references/:id', requireAdmin, asyncHandler(deleteSyllabusReferenceHandler));
