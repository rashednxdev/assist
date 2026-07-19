import type { Response } from 'express';
import {
  createQuestionSchema,
  updateQuestionSchema,
  listQuestionsQuerySchema,
  similarQuestionsQuerySchema,
  marathonReviewQuerySchema,
  questionsSyncQuerySchema,
  createQuestionTypeSchema,
  questionBookLinkInputSchema,
  updateQuestionTypeSchema,
  batchMcqImportSchema,
  batchDescriptiveImportSchema,
  batchQuestionIdsSchema,
} from '@ibas/shared-types';
import type { AuthRequest } from '../../middleware/auth.js';
import * as questionsService from './questions.service.js';

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

  // Non-admins (e.g. mobile Question Bank) only ever receive published questions.
  const listFilters = isAdmin ? filters : { ...filters, is_published: true as const };

  const { items, total, limit, offset } = await questionsService.listQuestions(listFilters);
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
  const limitRaw = typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined;
  const limit =
    limitRaw && Number.isFinite(limitRaw) ? Math.min(100, Math.max(1, Math.floor(limitRaw))) : 100;
  const data = await questionsService.listTrashedQuestions({ q, limit });
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
  const result = await questionsService.listQuestionsSync(filters);
  res.json({ data: result });
}

export async function similarQuestionsHandler(req: AuthRequest, res: Response): Promise<void> {
  const filters = similarQuestionsQuerySchema.parse(req.query);
  const data = await questionsService.findSimilarQuestions(filters);
  res.json({ data });
}

export async function getQuestionHandler(req: AuthRequest, res: Response): Promise<void> {
  const data = await questionsService.getQuestionById(String(req.params.id));
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

export async function updateQuestionHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = updateQuestionSchema.parse(req.body);
  const data = await questionsService.updateQuestion(String(req.params.id), dto);
  res.json({ data });
}

export async function deleteQuestionHandler(req: AuthRequest, res: Response): Promise<void> {
  const data = await questionsService.deleteQuestion(String(req.params.id));
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

export async function publishQuestionHandler(req: AuthRequest, res: Response): Promise<void> {
  const data = await questionsService.publishQuestion(String(req.params.id), req.user!.id);
  res.json({ data });
}

export async function unpublishQuestionHandler(req: AuthRequest, res: Response): Promise<void> {
  const data = await questionsService.unpublishQuestion(String(req.params.id));
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
