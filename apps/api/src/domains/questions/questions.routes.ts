import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireAdmin } from '../../middleware/requireAdmin.js';
import { requireModuleAccess } from '../../middleware/requireModuleAccess.js';
import { requireModulePermission } from '../../middleware/requireModulePermission.js';
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
  batchUnpublishQuestionsHandler,
  batchSubmitForQualityCheckQuestionsHandler,
  submitQuestionForQualityCheckHandler,
  returnQuestionToDraftHandler,
  publishQuestionHandler,
  unpublishQuestionHandler,
  addQuestionBookLinkHandler,
  deleteQuestionBookLinkHandler,
  setMotherQuestionHandler,
  removeMotherQuestionHandler,
} from './questions.controller.js';

export const questionsRouter = Router();

questionsRouter.use(authenticate);

const canBrowseQuestions = requireModulePermission([
  { moduleCode: 'QUESTIONS', permission: 'can_read' },
  { moduleCode: 'QUESTION_EDIT', permission: 'can_read' },
]);
const canEditQuestions = requireModulePermission([{ moduleCode: 'QUESTION_EDIT', permission: 'can_update' }]);
const canTrashQuestions = requireModulePermission([{ moduleCode: 'QUESTION_EDIT', permission: 'can_delete' }]);

questionsRouter.get('/types', canBrowseQuestions, asyncHandler(listQuestionTypesHandler));
questionsRouter.post('/types', requireAdmin, asyncHandler(createQuestionTypeHandler));
questionsRouter.patch('/types/:id', requireAdmin, asyncHandler(updateQuestionTypeHandler));
questionsRouter.delete('/types/:id', requireAdmin, asyncHandler(deleteQuestionTypeHandler));

questionsRouter.get('/', canBrowseQuestions, asyncHandler(listQuestionsHandler));
questionsRouter.get('/trashed', requireAdmin, asyncHandler(listTrashedQuestionsHandler));
questionsRouter.get('/marathon-review', requireModuleAccess('QUESTIONS'), asyncHandler(listMarathonReviewHandler));
questionsRouter.get('/sync', requireModuleAccess('QUESTIONS'), asyncHandler(questionsSyncHandler));
questionsRouter.get('/similar', requireModuleAccess('QUESTIONS'), asyncHandler(similarQuestionsHandler));
questionsRouter.get('/:id', canBrowseQuestions, asyncHandler(getQuestionHandler));

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
questionsRouter.post('/batch-unpublish', requireAdmin, asyncHandler(batchUnpublishQuestionsHandler));
questionsRouter.post(
  '/batch-submit-for-quality-check',
  requireAdmin,
  asyncHandler(batchSubmitForQualityCheckQuestionsHandler),
);
questionsRouter.post('/', requireAdmin, asyncHandler(createQuestionHandler));
questionsRouter.patch('/:id', canEditQuestions, asyncHandler(updateQuestionHandler));
questionsRouter.post('/:id/restore', requireAdmin, asyncHandler(restoreQuestionHandler));
questionsRouter.delete('/:id/permanent', requireAdmin, asyncHandler(permanentlyDeleteQuestionHandler));
questionsRouter.delete('/:id', canTrashQuestions, asyncHandler(deleteQuestionHandler));
questionsRouter.post(
  '/:id/submit-for-quality-check',
  canEditQuestions,
  asyncHandler(submitQuestionForQualityCheckHandler),
);
questionsRouter.post(
  '/:id/return-to-draft',
  canEditQuestions,
  asyncHandler(returnQuestionToDraftHandler),
);
questionsRouter.post('/:id/publish', canEditQuestions, asyncHandler(publishQuestionHandler));
questionsRouter.post('/:id/unpublish', canEditQuestions, asyncHandler(unpublishQuestionHandler));
questionsRouter.post('/:id/book-links', requireAdmin, asyncHandler(addQuestionBookLinkHandler));
questionsRouter.delete('/:id/book-links/:linkId', requireAdmin, asyncHandler(deleteQuestionBookLinkHandler));
questionsRouter.post('/:id/mother-question', canEditQuestions, asyncHandler(setMotherQuestionHandler));
questionsRouter.delete('/:id/mother-question', canEditQuestions, asyncHandler(removeMotherQuestionHandler));
