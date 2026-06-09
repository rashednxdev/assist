import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireAdmin } from '../../middleware/requireAdmin.js';
import { asyncHandler } from '../../shared/asyncHandler.js';
import {
  listQuestionTypesHandler,
  createQuestionTypeHandler,
  updateQuestionTypeHandler,
  deleteQuestionTypeHandler,
  listQuestionsHandler,
  similarQuestionsHandler,
  getQuestionHandler,
  createQuestionHandler,
  updateQuestionHandler,
  deleteQuestionHandler,
  publishQuestionHandler,
  unpublishQuestionHandler,
  addQuestionBookLinkHandler,
  deleteQuestionBookLinkHandler,
} from './questions.controller.js';

export const questionsRouter = Router();

questionsRouter.use(authenticate);

questionsRouter.get('/types', asyncHandler(listQuestionTypesHandler));
questionsRouter.post('/types', requireAdmin, asyncHandler(createQuestionTypeHandler));
questionsRouter.patch('/types/:id', requireAdmin, asyncHandler(updateQuestionTypeHandler));
questionsRouter.delete('/types/:id', requireAdmin, asyncHandler(deleteQuestionTypeHandler));
questionsRouter.get('/', asyncHandler(listQuestionsHandler));
questionsRouter.get('/similar', asyncHandler(similarQuestionsHandler));
questionsRouter.get('/:id', asyncHandler(getQuestionHandler));

questionsRouter.post('/', requireAdmin, asyncHandler(createQuestionHandler));
questionsRouter.patch('/:id', requireAdmin, asyncHandler(updateQuestionHandler));
questionsRouter.delete('/:id', requireAdmin, asyncHandler(deleteQuestionHandler));
questionsRouter.post('/:id/publish', requireAdmin, asyncHandler(publishQuestionHandler));
questionsRouter.post('/:id/unpublish', requireAdmin, asyncHandler(unpublishQuestionHandler));
questionsRouter.post('/:id/book-links', requireAdmin, asyncHandler(addQuestionBookLinkHandler));
questionsRouter.delete('/:id/book-links/:linkId', requireAdmin, asyncHandler(deleteQuestionBookLinkHandler));
