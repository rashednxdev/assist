import type { Response } from 'express';
import {
  upsertQuestionEvaluationSchema,
  batchQuestionEvaluationQuerySchema,
  submitPaperAttemptSchema,
} from '@ibas/shared-types';
import type { AuthRequest } from '../../middleware/auth.js';
import * as evaluationService from './evaluation.service.js';

export async function getQuestionEvaluationHandler(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user!.id;
  res.json({
    data: await evaluationService.getQuestionEvaluation(userId, String(req.params.questionId)),
  });
}

export async function getQuestionPracticeStemHandler(req: AuthRequest, res: Response): Promise<void> {
  res.json({
    data: await evaluationService.getQuestionPracticeStem(String(req.params.questionId)),
  });
}

export async function batchQuestionEvaluationsHandler(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user!.id;
  const { ids } = batchQuestionEvaluationQuerySchema.parse(req.query);
  const questionIds = ids.split(',').map((s) => s.trim()).filter(Boolean);
  res.json({ data: await evaluationService.getQuestionEvaluationsBatch(userId, questionIds) });
}

export async function recordQuestionReadHandler(req: AuthRequest, res: Response): Promise<void> {
  const data = await evaluationService.recordQuestionRead(req.user!.id, String(req.params.questionId));
  res.json({ data });
}

export async function listReadingHistoryHandler(req: AuthRequest, res: Response): Promise<void> {
  const limitRaw = Number(req.query.limit);
  const offsetRaw = Number(req.query.offset);
  const limit = Number.isFinite(limitRaw) ? Math.min(100, Math.max(1, Math.floor(limitRaw))) : 40;
  const offset = Number.isFinite(offsetRaw) ? Math.max(0, Math.floor(offsetRaw)) : 0;
  const { items, total } = await evaluationService.listReadingHistory(req.user!.id, offset, limit);
  res.json({ data: items, meta: { total, limit, offset, has_more: offset + items.length < total } });
}

export async function upsertQuestionEvaluationHandler(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user!.id;
  const dto = upsertQuestionEvaluationSchema.parse(req.body);
  res.json({
    data: await evaluationService.upsertQuestionEvaluation(
      userId,
      String(req.params.questionId),
      dto,
    ),
  });
}

export async function getBookEvaluationHandler(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user!.id;
  res.json({ data: await evaluationService.getBookEvaluation(userId, String(req.params.bookId)) });
}

export async function getPaperEvaluationHandler(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user!.id;
  res.json({ data: await evaluationService.getPaperEvaluation(userId, String(req.params.paperId)) });
}

export async function getProgressDashboardHandler(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user!.id;
  res.json({ data: await evaluationService.getProgressDashboard(userId) });
}

export async function submitPaperAttemptHandler(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user!.id;
  const dto = submitPaperAttemptSchema.parse(req.body);
  res.status(201).json({
    data: await evaluationService.submitPaperAttempt(userId, String(req.params.paperId), dto),
  });
}

export async function listPaperAttemptsHandler(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user!.id;
  res.json({ data: await evaluationService.listPaperAttempts(userId, String(req.params.paperId)) });
}
