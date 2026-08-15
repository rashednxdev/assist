import type { Response } from 'express';
import {
  createQuestionSchema,
  updateQuestionSchema,
  listQuestionsQuerySchema,
  similarQuestionsQuerySchema,
  linkQuestionSearchQuerySchema,
  marathonReviewQuerySchema,
  questionsSyncQuerySchema,
  createQuestionTypeSchema,
  questionBookLinkInputSchema,
  updateQuestionTypeSchema,
  batchMcqImportSchema,
  batchDescriptiveImportSchema,
  batchDifferencesImportSchema,
  batchQuestionIdsSchema,
  batchQuestionSubjectLinksSchema,
  batchQuestionBookFirstChapterLinksSchema,
  questionSubjectLinkInputSchema,
  questionBookFirstChapterLinkInputSchema,
  setMotherQuestionSchema,
  answerPdfRequestSchema,
  answerPdfPageSizeSchema,
} from '@ibas/shared-types';
import type { AuthRequest } from '../../middleware/auth.js';
import { hasModulePermission } from '../users/module-access.service.js';
import * as questionsService from './questions.service.js';
import * as answerPdfService from './answer-pdf.service.js';
import { getExamSubjectScopeForAuthUser } from '../users/subject-access.service.js';

export async function createQuestionTypeHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = createQuestionTypeSchema.parse(req.body);
  const data = await questionsService.createQuestionType(dto);
  res.status(201).json({ data });
}

export async function listQuestionTypesHandler(_req: AuthRequest, res: Response): Promise<void> {
  const data = await questionsService.listQuestionTypes();
  res.json({ data });
}

export async function updateQuestionTypeHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = updateQuestionTypeSchema.parse(req.body);
  const data = await questionsService.updateQuestionType(String(req.params.id), dto);
  res.json({ data });
}

export async function deleteQuestionTypeHandler(req: AuthRequest, res: Response): Promise<void> {
  const data = await questionsService.deleteQuestionType(String(req.params.id));
  res.json({ data });
}

export async function listQuestionsHandler(req: AuthRequest, res: Response): Promise<void> {
  const filters = listQuestionsQuerySchema.parse(req.query);
  const user = req.user;
  const isAdmin =
    Boolean(user?.is_super_admin) ||
    user?.user_type === 'system_admin' ||
    user?.user_type === 'admin';
  const canSeeAllStatuses =
    isAdmin || (!!user && (await hasModulePermission(user.id, 'QUESTION_EDIT', 'can_read')));

  // Regular mobile Question Bank users only ever receive published questions; admins and
  // the mobile Question Update module (draft/quality_check/published review workflow) see all.
  const listFilters = canSeeAllStatuses ? filters : { ...filters, is_published: true as const };
  const subjectScope = await getExamSubjectScopeForAuthUser(user);

  const { items, total, limit, offset } = await questionsService.listQuestions(listFilters, {
    subjectScope,
  });
  res.json({
    data: items,
    meta: {
      total,
      limit,
      offset,
      has_more: offset + items.length < total,
    },
  });
}

export async function listTrashedQuestionsHandler(req: AuthRequest, res: Response): Promise<void> {
  const q = typeof req.query.q === 'string' ? req.query.q : undefined;
  const book_chapter_id = typeof req.query.book_chapter_id === 'string' ? req.query.book_chapter_id : undefined;
  const book_info_id = typeof req.query.book_info_id === 'string' ? req.query.book_info_id : undefined;
  const untagged = req.query.untagged === 'true';
  const sort = typeof req.query.sort === 'string' ? req.query.sort : undefined;
  const limitRaw = typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined;
  const limit =
    limitRaw && Number.isFinite(limitRaw) ? Math.min(100, Math.max(1, Math.floor(limitRaw))) : 100;
  const data = await questionsService.listTrashedQuestions({
    q,
    book_chapter_id,
    book_info_id,
    untagged,
    sort,
    limit,
  });
  res.json({ data });
}

export async function listMarathonReviewHandler(req: AuthRequest, res: Response): Promise<void> {
  const filters = marathonReviewQuerySchema.parse(req.query);
  const { items, total, limit, offset } = await questionsService.listMarathonReview(filters);
  res.json({
    data: items,
    meta: {
      total,
      limit,
      offset,
      has_more: offset + items.length < total,
    },
  });
}

export async function questionsSyncHandler(req: AuthRequest, res: Response): Promise<void> {
  const filters = questionsSyncQuerySchema.parse(req.query);
  const subjectScope = await getExamSubjectScopeForAuthUser(req.user);
  const result = await questionsService.listQuestionsSync(filters, { subjectScope });
  res.json({ data: result });
}

export async function similarQuestionsHandler(req: AuthRequest, res: Response): Promise<void> {
  const filters = similarQuestionsQuerySchema.parse(req.query);
  const data = await questionsService.findSimilarQuestions(filters);
  res.json({ data });
}

export async function linkQuestionSearchHandler(req: AuthRequest, res: Response): Promise<void> {
  const filters = linkQuestionSearchQuerySchema.parse(req.query);
  const data = await questionsService.searchQuestionsForLink(filters);
  res.json({ data });
}

export async function getQuestionHandler(req: AuthRequest, res: Response): Promise<void> {
  const subjectScope = await getExamSubjectScopeForAuthUser(req.user);
  const data = await questionsService.getQuestionById(String(req.params.id), { subjectScope });
  res.json({ data });
}

export async function createQuestionHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = createQuestionSchema.parse(req.body);
  const data = await questionsService.createQuestion(dto, req.user!.id);
  res.status(201).json({ data });
}

export async function batchImportMcqHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = batchMcqImportSchema.parse(req.body);
  const data = await questionsService.batchImportMcqQuestions(dto, req.user!.id);
  res.status(201).json({ data });
}

export async function batchImportDescriptiveHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = batchDescriptiveImportSchema.parse(req.body);
  const data = await questionsService.batchImportDescriptiveQuestions(dto, req.user!.id);
  res.status(201).json({ data });
}

export async function batchImportDifferencesHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = batchDifferencesImportSchema.parse(req.body);
  const data = await questionsService.batchImportDifferencesQuestions(dto, req.user!.id);
  res.status(201).json({ data });
}

export async function updateQuestionHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = updateQuestionSchema.parse(req.body);
  const data = await questionsService.updateQuestion(String(req.params.id), dto);
  res.json({ data });
}

export async function deleteQuestionHandler(req: AuthRequest, res: Response): Promise<void> {
  const data = await questionsService.deleteQuestion(String(req.params.id));
  res.json({ data });
}

export async function setMotherQuestionHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = setMotherQuestionSchema.parse(req.body);
  const data = await questionsService.setMotherQuestion(String(req.params.id), dto.mother_question_id);
  res.json({ data });
}

export async function removeMotherQuestionHandler(req: AuthRequest, res: Response): Promise<void> {
  const data = await questionsService.removeMotherQuestion(String(req.params.id));
  res.json({ data });
}

export async function restoreQuestionHandler(req: AuthRequest, res: Response): Promise<void> {
  const data = await questionsService.restoreQuestion(String(req.params.id));
  res.json({ data });
}

export async function permanentlyDeleteQuestionHandler(req: AuthRequest, res: Response): Promise<void> {
  const data = await questionsService.permanentlyDeleteQuestion(String(req.params.id));
  res.json({ data });
}

export async function batchTrashQuestionsHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = batchQuestionIdsSchema.parse(req.body);
  const data = await questionsService.batchTrashQuestions(dto.ids);
  res.json({ data });
}

export async function batchRestoreQuestionsHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = batchQuestionIdsSchema.parse(req.body);
  const data = await questionsService.batchRestoreQuestions(dto.ids);
  res.json({ data });
}

export async function batchPermanentlyDeleteQuestionsHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = batchQuestionIdsSchema.parse(req.body);
  const data = await questionsService.batchPermanentlyDeleteQuestions(dto.ids);
  res.json({ data });
}

export async function batchUnpublishQuestionsHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = batchQuestionIdsSchema.parse(req.body);
  const data = await questionsService.batchUnpublishQuestions(dto.ids, req.user!.id);
  res.json({ data });
}

export async function batchSubmitForQualityCheckQuestionsHandler(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  const dto = batchQuestionIdsSchema.parse(req.body);
  const data = await questionsService.batchSubmitForQualityCheckQuestions(dto.ids, req.user!.id);
  res.json({ data });
}

export async function submitQuestionForQualityCheckHandler(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  const data = await questionsService.submitQuestionForQualityCheck(String(req.params.id), req.user!.id);
  res.json({ data });
}

export async function returnQuestionToDraftHandler(req: AuthRequest, res: Response): Promise<void> {
  const data = await questionsService.returnQuestionToDraft(String(req.params.id), req.user!.id);
  res.json({ data });
}

export async function publishQuestionHandler(req: AuthRequest, res: Response): Promise<void> {
  const data = await questionsService.publishQuestion(String(req.params.id), req.user!.id);
  res.json({ data });
}

export async function unpublishQuestionHandler(req: AuthRequest, res: Response): Promise<void> {
  const data = await questionsService.unpublishQuestion(String(req.params.id), req.user!.id);
  res.json({ data });
}

export async function addQuestionBookLinkHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = questionBookLinkInputSchema.parse(req.body);
  const data = await questionsService.addQuestionBookLink(String(req.params.id), dto);
  res.status(201).json({ data });
}

export async function deleteQuestionBookLinkHandler(req: AuthRequest, res: Response): Promise<void> {
  const data = await questionsService.deleteQuestionBookLink(
    String(req.params.id),
    String(req.params.linkId),
  );
  res.json({ data });
}

export async function listQuestionSubjectCatalogHandler(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  const subjectScope = await getExamSubjectScopeForAuthUser(req.user);
  res.json({ data: await questionsService.listQuestionSubjectCatalog(subjectScope) });
}

export async function listQuestionSubjectLinksHandler(req: AuthRequest, res: Response): Promise<void> {
  res.json({ data: await questionsService.listQuestionSubjectLinks(String(req.params.id)) });
}

export async function addQuestionSubjectLinkHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = questionSubjectLinkInputSchema.parse(req.body);
  const data = await questionsService.addQuestionSubjectLink(String(req.params.id), dto);
  res.status(201).json({ data });
}

export async function deleteQuestionSubjectLinkHandler(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  const data = await questionsService.deleteQuestionSubjectLink(
    String(req.params.id),
    String(req.params.examSubjectId),
  );
  res.json({ data });
}

export async function batchAddQuestionSubjectLinksHandler(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  const dto = batchQuestionSubjectLinksSchema.parse(req.body);
  const data = await questionsService.batchAddQuestionSubjectLinks(dto);
  res.json({ data });
}

export async function listQuestionBookCatalogHandler(
  _req: AuthRequest,
  res: Response,
): Promise<void> {
  res.json({ data: await questionsService.listQuestionBookCatalog() });
}

export async function addQuestionBookFirstChapterLinkHandler(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  const dto = questionBookFirstChapterLinkInputSchema.parse(req.body);
  const data = await questionsService.addQuestionBookFirstChapterLink(String(req.params.id), dto);
  res.status(201).json({ data });
}

export async function deleteQuestionBookFirstChapterLinkHandler(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  const data = await questionsService.deleteQuestionBookFirstChapterLink(
    String(req.params.id),
    String(req.params.bookInfoId),
  );
  res.json({ data });
}

export async function batchAddQuestionBookFirstChapterLinksHandler(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  const dto = batchQuestionBookFirstChapterLinksSchema.parse(req.body);
  const data = await questionsService.batchAddQuestionBookFirstChapterLinks(dto);
  res.json({ data });
}

function sendPdf(
  res: Response,
  result: { buffer: Buffer; filename: string; count: number },
): void {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(result.filename)}"`);
  res.setHeader('X-Answer-Pdf-Count', String(result.count));
  res.send(result.buffer);
}

/** Batch answer PDF — body: { question_ids, page_size: 'a4' | 'half_a4' }. */
export async function exportAnswerPdfHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = answerPdfRequestSchema.parse(req.body);
  const result = await answerPdfService.buildAnswerPdf(dto);
  sendPdf(res, result);
}

/** Single-question answer PDF — query: page_size=a4|half_a4. */
export async function exportSingleAnswerPdfHandler(req: AuthRequest, res: Response): Promise<void> {
  const page_size = answerPdfPageSizeSchema.catch('a4').parse(req.query.page_size ?? 'a4');
  const result = await answerPdfService.buildAnswerPdf({
    question_ids: [String(req.params.id)],
    page_size,
  });
  sendPdf(res, result);
}
