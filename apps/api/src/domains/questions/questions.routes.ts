import { Router, type Response, type NextFunction, type RequestHandler } from 'express';
import { authenticate, type AuthRequest } from '../../middleware/auth.js';
import { requireAdmin } from '../../middleware/requireAdmin.js';
import {
  requireModuleAccess,
  assertPaidIfNeeded,
  findAllStoppedModule,
} from '../../middleware/requireModuleAccess.js';
import { requireModulePermission } from '../../middleware/requireModulePermission.js';
import { asyncHandler } from '../../shared/asyncHandler.js';
import { forbidden, unauthorized } from '../../shared/errors/AppError.js';
import { hasModulePermission } from '../users/module-access.service.js';
import { getExamSubjectScopeForAuthUser } from '../users/subject-access.service.js';
import { isQuestionVisibleInQotd } from '../qotd/qotd.service.js';
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
  linkQuestionSearchHandler,
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
  listQuestionSubjectCatalogHandler,
  listQuestionSubjectLinksHandler,
  addQuestionSubjectLinkHandler,
  deleteQuestionSubjectLinkHandler,
  batchAddQuestionSubjectLinksHandler,
  listQuestionBookCatalogHandler,
  addQuestionBookFirstChapterLinkHandler,
  deleteQuestionBookFirstChapterLinkHandler,
  batchAddQuestionBookFirstChapterLinksHandler,
  setMotherQuestionHandler,
  removeMotherQuestionHandler,
  exportAnswerPdfHandler,
  exportSingleAnswerPdfHandler,
} from './questions.controller.js';

export const questionsRouter = Router();

questionsRouter.use(authenticate);

const canBrowseQuestions = requireModulePermission([
  { moduleCode: 'QUESTIONS', permission: 'can_read' },
  { moduleCode: 'QUESTION_EDIT', permission: 'can_read' },
]);
const canEditQuestions = requireModulePermission([{ moduleCode: 'QUESTION_EDIT', permission: 'can_update' }]);
const canTrashQuestions = requireModulePermission([{ moduleCode: 'QUESTION_EDIT', permission: 'can_delete' }]);
const canDownloadAnswerPdf = requireModuleAccess('ANSWER_PDF');

function isAdminUser(user: AuthRequest['user']): boolean {
  return !!user && (user.is_super_admin || user.user_type === 'system_admin' || user.user_type === 'admin');
}

/**
 * Question detail (includes answers). Allowed when:
 * - user has QUESTIONS / QUESTION_EDIT (paid grant), or
 * - the question is on a currently visible free QOTD set (no QUESTIONS grant needed).
 */
const canReadQuestionDetail: RequestHandler = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  if (!req.user) {
    next(unauthorized());
    return;
  }
  if (req.user.status !== 'active') {
    next(forbidden('Account is not active'));
    return;
  }
  if (isAdminUser(req.user)) {
    next();
    return;
  }

  try {
    const qotdStopped = await findAllStoppedModule(['QOTD']);
    let qotdAllowed = !qotdStopped;
    if (qotdStopped) {
      const { UserModuleAccess } = await import('../users/models/UserModuleAccess.model.js');
      const bypassStop = await UserModuleAccess.exists({
        user_id: req.user.id,
        module_code: 'QOTD',
        is_active: true,
        can_read: true,
        bypass_stop: true,
      });
      qotdAllowed = Boolean(bypassStop);
      if (!bypassStop) {
        // QOTD closed for this user — still may have paid QUESTIONS access below.
      }
    }

    if (qotdAllowed) {
      const scope = await getExamSubjectScopeForAuthUser(req.user);
      if (await isQuestionVisibleInQotd(String(req.params.id), false, scope)) {
        next();
        return;
      }
    }

    for (const moduleCode of ['QUESTIONS', 'QUESTION_EDIT'] as const) {
      const stopped = await findAllStoppedModule([moduleCode]);
      if (stopped) continue;
      if (await hasModulePermission(req.user.id, moduleCode, 'can_read')) {
        await assertPaidIfNeeded(req.user.id, [moduleCode]);
        next();
        return;
      }
    }

    if (qotdStopped && !qotdAllowed) {
      next(forbidden(qotdStopped.stopped_reason || 'This module is temporarily unavailable.'));
      return;
    }

    await assertPaidIfNeeded(req.user.id, ['QUESTIONS']);
    next(forbidden('You do not have access to this module. Ask an admin to grant access.'));
  } catch (err) {
    next(err);
  }
};
questionsRouter.get('/types', canBrowseQuestions, asyncHandler(listQuestionTypesHandler));
questionsRouter.post('/types', requireAdmin, asyncHandler(createQuestionTypeHandler));
questionsRouter.patch('/types/:id', requireAdmin, asyncHandler(updateQuestionTypeHandler));
questionsRouter.delete('/types/:id', requireAdmin, asyncHandler(deleteQuestionTypeHandler));

questionsRouter.get('/', canBrowseQuestions, asyncHandler(listQuestionsHandler));
questionsRouter.get('/trashed', requireAdmin, asyncHandler(listTrashedQuestionsHandler));
questionsRouter.get('/subject-catalog', canBrowseQuestions, asyncHandler(listQuestionSubjectCatalogHandler));
questionsRouter.get('/book-catalog', canBrowseQuestions, asyncHandler(listQuestionBookCatalogHandler));
questionsRouter.get('/marathon-review', requireModuleAccess('QUESTIONS'), asyncHandler(listMarathonReviewHandler));
questionsRouter.get('/sync', requireModuleAccess('QUESTIONS'), asyncHandler(questionsSyncHandler));
questionsRouter.get('/similar', requireModuleAccess('QUESTIONS'), asyncHandler(similarQuestionsHandler));
questionsRouter.get('/link-search', canBrowseQuestions, asyncHandler(linkQuestionSearchHandler));
questionsRouter.post('/answer-pdf', canDownloadAnswerPdf, asyncHandler(exportAnswerPdfHandler));
questionsRouter.get('/:id', canReadQuestionDetail, asyncHandler(getQuestionHandler));
questionsRouter.get('/:id/answer-pdf', canDownloadAnswerPdf, asyncHandler(exportSingleAnswerPdfHandler));

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
questionsRouter.post(
  '/batch-subject-links',
  requireAdmin,
  asyncHandler(batchAddQuestionSubjectLinksHandler),
);
questionsRouter.post(
  '/batch-book-first-chapter-links',
  requireAdmin,
  asyncHandler(batchAddQuestionBookFirstChapterLinksHandler),
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
questionsRouter.get('/:id/subject-links', canBrowseQuestions, asyncHandler(listQuestionSubjectLinksHandler));
questionsRouter.post('/:id/subject-links', canEditQuestions, asyncHandler(addQuestionSubjectLinkHandler));
questionsRouter.delete(
  '/:id/subject-links/:examSubjectId',
  canEditQuestions,
  asyncHandler(deleteQuestionSubjectLinkHandler),
);
questionsRouter.post(
  '/:id/book-first-chapter-links',
  canEditQuestions,
  asyncHandler(addQuestionBookFirstChapterLinkHandler),
);
questionsRouter.delete(
  '/:id/book-first-chapter-links/:bookInfoId',
  canEditQuestions,
  asyncHandler(deleteQuestionBookFirstChapterLinkHandler),
);
questionsRouter.post('/:id/mother-question', canEditQuestions, asyncHandler(setMotherQuestionHandler));
questionsRouter.delete('/:id/mother-question', canEditQuestions, asyncHandler(removeMotherQuestionHandler));
