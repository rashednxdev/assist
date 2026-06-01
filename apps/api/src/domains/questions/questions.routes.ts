import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireAdmin } from '../../middleware/requireAdmin.js';
import { asyncHandler } from '../../shared/asyncHandler.js';
import {
  listQuestionTypesHandler,
  createQuestionTypeHandler,
  listQuestionsHandler,
  getQuestionHandler,
  createQuestionHandler,
  updateQuestionHandler,
  deleteQuestionHandler,
  publishQuestionHandler,
  unpublishQuestionHandler,
} from './questions.controller.js';

export const questionsRouter = Router();

questionsRouter.use(authenticate);

questionsRouter.get('/types', asyncHandler(listQuestionTypesHandler));
questionsRouter.post('/types', requireAdmin, asyncHandler(createQuestionTypeHandler));
questionsRouter.get('/', asyncHandler(listQuestionsHandler));
questionsRouter.get('/:id', asyncHandler(getQuestionHandler));

questionsRouter.post('/', requireAdmin, asyncHandler(createQuestionHandler));
questionsRouter.patch('/:id', requireAdmin, asyncHandler(updateQuestionHandler));
questionsRouter.delete('/:id', requireAdmin, asyncHandler(deleteQuestionHandler));
questionsRouter.post('/:id/publish', requireAdmin, asyncHandler(publishQuestionHandler));
questionsRouter.post('/:id/unpublish', requireAdmin, asyncHandler(unpublishQuestionHandler));
