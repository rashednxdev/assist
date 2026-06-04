import type { Response } from 'express';
import {
  createQuestionSchema,
  updateQuestionSchema,
  listQuestionsQuerySchema,
  createQuestionTypeSchema,
  updateQuestionTypeSchema,
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
  const data = await questionsService.listQuestions(filters);
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

export async function updateQuestionHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = updateQuestionSchema.parse(req.body);
  const data = await questionsService.updateQuestion(String(req.params.id), dto);
  res.json({ data });
}

export async function deleteQuestionHandler(req: AuthRequest, res: Response): Promise<void> {
  const data = await questionsService.deleteQuestion(String(req.params.id));
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
