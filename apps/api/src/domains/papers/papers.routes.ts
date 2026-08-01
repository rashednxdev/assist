import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireAdmin } from '../../middleware/requireAdmin.js';
import { requireModuleAccess, requireModuleAccessAny } from '../../middleware/requireModuleAccess.js';
import { asyncHandler } from '../../shared/asyncHandler.js';
import {
  listPaperTypesHandler,
  createPaperTypeHandler,
  updatePaperTypeHandler,
  deletePaperTypeHandler,
  listPapersHandler,
  getPaperHandler,
  getPaperComposeHandler,
  createPaperHandler,
  updatePaperHandler,
  deletePaperHandler,
  publishPaperHandler,
  unpublishPaperHandler,
  publishPaperExamWeekHandler,
  unpublishPaperExamWeekHandler,
  listExamWeeksHandler,
  getExamWeekPapersHandler,
  createPaperGroupHandler,
  updatePaperGroupHandler,
  deletePaperGroupHandler,
  createPaperQuestionHandler,
  batchAddPaperQuestionsHandler,
  updatePaperQuestionHandler,
  deletePaperQuestionHandler,
  createChildQuestionHandler,
  updateChildQuestionHandler,
  deleteChildQuestionHandler,
} from './papers.controller.js';

export const papersRouter = Router();

papersRouter.use(authenticate);

papersRouter.get('/types', requireModuleAccess('PAPER'), asyncHandler(listPaperTypesHandler));
papersRouter.post('/types', requireAdmin, asyncHandler(createPaperTypeHandler));
papersRouter.patch('/types/:id', requireAdmin, asyncHandler(updatePaperTypeHandler));
papersRouter.delete('/types/:id', requireAdmin, asyncHandler(deletePaperTypeHandler));

papersRouter.get('/exam-week/weeks', requireModuleAccess('EXAM_WEEK'), asyncHandler(listExamWeeksHandler));
papersRouter.get(
  '/exam-week/weeks/:weekStart',
  requireModuleAccess('EXAM_WEEK'),
  asyncHandler(getExamWeekPapersHandler),
);

papersRouter.get('/', requireModuleAccess('PAPER'), asyncHandler(listPapersHandler));
papersRouter.post('/', requireAdmin, asyncHandler(createPaperHandler));
papersRouter.get(
  '/:id/compose',
  requireModuleAccessAny('PAPER', 'EXAM_WEEK'),
  asyncHandler(getPaperComposeHandler),
);
papersRouter.get('/:id', requireModuleAccessAny('PAPER', 'EXAM_WEEK'), asyncHandler(getPaperHandler));
papersRouter.patch('/:id', requireAdmin, asyncHandler(updatePaperHandler));
papersRouter.delete('/:id', requireAdmin, asyncHandler(deletePaperHandler));
papersRouter.post('/:id/publish', requireAdmin, asyncHandler(publishPaperHandler));
papersRouter.post('/:id/unpublish', requireAdmin, asyncHandler(unpublishPaperHandler));
papersRouter.post('/:id/publish-exam-week', requireAdmin, asyncHandler(publishPaperExamWeekHandler));
papersRouter.post('/:id/unpublish-exam-week', requireAdmin, asyncHandler(unpublishPaperExamWeekHandler));

papersRouter.post('/:id/groups', requireAdmin, asyncHandler(createPaperGroupHandler));
papersRouter.patch('/groups/:id', requireAdmin, asyncHandler(updatePaperGroupHandler));
papersRouter.delete('/groups/:id', requireAdmin, asyncHandler(deletePaperGroupHandler));

papersRouter.post('/:id/questions', requireAdmin, asyncHandler(createPaperQuestionHandler));
papersRouter.post('/:id/questions/batch', requireAdmin, asyncHandler(batchAddPaperQuestionsHandler));
papersRouter.patch('/questions/:id', requireAdmin, asyncHandler(updatePaperQuestionHandler));
papersRouter.delete('/questions/:id', requireAdmin, asyncHandler(deletePaperQuestionHandler));

papersRouter.post('/questions/:id/parts', requireAdmin, asyncHandler(createChildQuestionHandler));
papersRouter.patch('/parts/:id', requireAdmin, asyncHandler(updateChildQuestionHandler));
papersRouter.delete('/parts/:id', requireAdmin, asyncHandler(deleteChildQuestionHandler));
