import type { Response } from 'express';
import {
  upsertQuestionEvaluationSchema,
  batchQuestionEvaluationQuerySchema,
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
