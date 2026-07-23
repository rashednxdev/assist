import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireAdmin } from '../../middleware/requireAdmin.js';
import { requireModuleAccess } from '../../middleware/requireModuleAccess.js';
import { asyncHandler } from '../../shared/asyncHandler.js';
import {
  listQuestionTypesHandler,
  createQuestionTypeHandler,
  updateQuestionTypeHandler,
  deleteQuestionTypeHandler,
  listQuestionsHandler,
  listTrashedQuestionsHandler,
  listMarathonReviewHandler,
  questionsSyncHandler,
  similarQuestionsHandler,
  getQuestionHandler,
  createQuestionHandler,
  batchImportMcqHandler,
  batchImportDescriptiveHandler,
  batchImportDifferencesHandler,
  updateQuestionHandler,
  deleteQuestionHandler,
  restoreQuestionHandler,
  permanentlyDeleteQuestionHandler,
  batchTrashQuestionsHandler,
  batchRestoreQuestionsHandler,
  batchPermanentlyDeleteQuestionsHandler,
  submitQuestionForQualityCheckHandler,
  returnQuestionToDraftHandler,
  publishQuestionHandler,
  unpublishQuestionHandler,
  addQuestionBookLinkHandler,
  deleteQuestionBookLinkHandler,
} from './questions.controller.js';

export const questionsRouter = Router();

questionsRouter.use(authenticate);

questionsRouter.get('/types', requireModuleAccess('QUESTIONS'), asyncHandler(listQuestionTypesHandler));
questionsRouter.post('/types', requireAdmin, asyncHandler(createQuestionTypeHandler));
questionsRouter.patch('/types/:id', requireAdmin, asyncHandler(updateQuestionTypeHandler));
questionsRouter.delete('/types/:id', requireAdmin, asyncHandler(deleteQuestionTypeHandler));
questionsRouter.get('/', requireModuleAccess('QUESTIONS'), asyncHandler(listQuestionsHandler));
questionsRouter.get('/trashed', requireAdmin, asyncHandler(listTrashedQuestionsHandler));
questionsRouter.get('/marathon-review', requireModuleAccess('QUESTIONS'), asyncHandler(listMarathonReviewHandler));
questionsRouter.get('/sync', requireModuleAccess('QUESTIONS'), asyncHandler(questionsSyncHandler));
questionsRouter.get('/similar', requireModuleAccess('QUESTIONS'), asyncHandler(similarQuestionsHandler));
questionsRouter.get('/:id', requireModuleAccess('QUESTIONS'), asyncHandler(getQuestionHandler));

questionsRouter.post('/batch-import', requireAdmin, asyncHandler(batchImportMcqHandler));
questionsRouter.post(
  '/batch-import-descriptive',
  requireAdmin,
  asyncHandler(batchImportDescriptiveHandler),
);
questionsRouter.post(
  '/batch-import-differences',
  requireAdmin,
  asyncHandler(batchImportDifferencesHandler),
);
questionsRouter.post('/batch-trash', requireAdmin, asyncHandler(batchTrashQuestionsHandler));
questionsRouter.post('/batch-restore', requireAdmin, asyncHandler(batchRestoreQuestionsHandler));
questionsRouter.post(
  '/batch-permanent-delete',
  requireAdmin,
  asyncHandler(batchPermanentlyDeleteQuestionsHandler),
);
questionsRouter.post('/', requireAdmin, asyncHandler(createQuestionHandler));
questionsRouter.patch('/:id', requireAdmin, asyncHandler(updateQuestionHandler));
questionsRouter.post('/:id/restore', requireAdmin, asyncHandler(restoreQuestionHandler));
questionsRouter.delete('/:id/permanent', requireAdmin, asyncHandler(permanentlyDeleteQuestionHandler));
questionsRouter.delete('/:id', requireAdmin, asyncHandler(deleteQuestionHandler));
questionsRouter.post(
  '/:id/submit-for-quality-check',
  requireAdmin,
  asyncHandler(submitQuestionForQualityCheckHandler),
);
questionsRouter.post(
  '/:id/return-to-draft',
  requireAdmin,
  asyncHandler(returnQuestionToDraftHandler),
);
questionsRouter.post('/:id/publish', requireAdmin, asyncHandler(publishQuestionHandler));
questionsRouter.post('/:id/unpublish', requireAdmin, asyncHandler(unpublishQuestionHandler));
questionsRouter.post('/:id/book-links', requireAdmin, asyncHandler(addQuestionBookLinkHandler));
questionsRouter.delete('/:id/book-links/:linkId', requireAdmin, asyncHandler(deleteQuestionBookLinkHandler));
