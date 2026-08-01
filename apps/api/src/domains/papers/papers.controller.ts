import type { Response } from 'express';
import {
  createPaperTypeSchema,
  updatePaperTypeSchema,
  createPaperSchema,
  updatePaperSchema,
  listPapersQuerySchema,
  createPaperGroupSchema,
  updatePaperGroupSchema,
  createPaperQuestionSchema,
  updatePaperQuestionSchema,
  batchAddPaperQuestionsSchema,
  createChildQuestionSchema,
  updateChildQuestionSchema,
  publishExamWeekSchema,
} from '@ibas/shared-types';
import type { AuthRequest } from '../../middleware/auth.js';
import * as papersService from './papers.service.js';

function isAdminUser(user: AuthRequest['user']): boolean {
  return !!user && (user.is_super_admin || user.user_type === 'system_admin' || user.user_type === 'admin');
}

export async function listPaperTypesHandler(_req: AuthRequest, res: Response): Promise<void> {
  res.json({ data: await papersService.listPaperTypes() });
}

export async function createPaperTypeHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = createPaperTypeSchema.parse(req.body);
  res.status(201).json({ data: await papersService.createPaperType(dto) });
}

export async function updatePaperTypeHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = updatePaperTypeSchema.parse(req.body);
  res.json({ data: await papersService.updatePaperType(String(req.params.id), dto) });
}

export async function deletePaperTypeHandler(req: AuthRequest, res: Response): Promise<void> {
  res.json({ data: await papersService.deletePaperType(String(req.params.id)) });
}

export async function listPapersHandler(req: AuthRequest, res: Response): Promise<void> {
  const filters = listPapersQuerySchema.parse(req.query);
  const publishedOnly =
    !req.user ||
    !(req.user.is_super_admin || req.user.user_type === 'system_admin' || req.user.user_type === 'admin');
  res.json({ data: await papersService.listPapers(filters, { publishedOnly }) });
}

export async function getPaperHandler(req: AuthRequest, res: Response): Promise<void> {
  res.json({ data: await papersService.getPaperById(String(req.params.id), req.user) });
}

export async function getPaperComposeHandler(req: AuthRequest, res: Response): Promise<void> {
  res.json({ data: await papersService.getPaperCompose(String(req.params.id), req.user) });
}

export async function createPaperHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = createPaperSchema.parse(req.body);
  res.status(201).json({ data: await papersService.createPaper(dto, req.user!.id) });
}

export async function updatePaperHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = updatePaperSchema.parse(req.body);
  res.json({ data: await papersService.updatePaper(String(req.params.id), dto) });
}

export async function deletePaperHandler(req: AuthRequest, res: Response): Promise<void> {
  res.json({ data: await papersService.deletePaper(String(req.params.id)) });
}

export async function publishPaperHandler(req: AuthRequest, res: Response): Promise<void> {
  res.json({ data: await papersService.publishPaper(String(req.params.id)) });
}

export async function unpublishPaperHandler(req: AuthRequest, res: Response): Promise<void> {
  res.json({ data: await papersService.unpublishPaper(String(req.params.id)) });
}

export async function publishPaperExamWeekHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = publishExamWeekSchema.parse(req.body);
  const data = await papersService.publishPaperExamWeek(
    String(req.params.id),
    dto.exam_week_date,
    dto.exam_week_publish_time,
  );
  res.json({ data });
}

export async function unpublishPaperExamWeekHandler(req: AuthRequest, res: Response): Promise<void> {
  res.json({ data: await papersService.unpublishPaperExamWeek(String(req.params.id)) });
}

export async function listExamWeeksHandler(req: AuthRequest, res: Response): Promise<void> {
  res.json({ data: await papersService.listExamWeeks(isAdminUser(req.user)) });
}

export async function getExamWeekPapersHandler(req: AuthRequest, res: Response): Promise<void> {
  const data = await papersService.listExamWeekPapersInWeek(String(req.params.weekStart), isAdminUser(req.user));
  res.json({ data });
}

export async function createPaperGroupHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = createPaperGroupSchema.parse(req.body);
  res.status(201).json({ data: await papersService.createPaperGroup(String(req.params.id), dto) });
}

export async function updatePaperGroupHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = updatePaperGroupSchema.parse(req.body);
  res.json({ data: await papersService.updatePaperGroup(String(req.params.id), dto) });
}

export async function deletePaperGroupHandler(req: AuthRequest, res: Response): Promise<void> {
  res.json({ data: await papersService.deletePaperGroup(String(req.params.id)) });
}

export async function createPaperQuestionHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = createPaperQuestionSchema.parse(req.body);
  res.status(201).json({ data: await papersService.createPaperQuestion(String(req.params.id), dto) });
}

export async function batchAddPaperQuestionsHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = batchAddPaperQuestionsSchema.parse(req.body);
  res.status(201).json({ data: await papersService.batchAddPaperQuestions(String(req.params.id), dto) });
}

export async function updatePaperQuestionHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = updatePaperQuestionSchema.parse(req.body);
  res.json({ data: await papersService.updatePaperQuestion(String(req.params.id), dto) });
}

export async function deletePaperQuestionHandler(req: AuthRequest, res: Response): Promise<void> {
  res.json({ data: await papersService.deletePaperQuestion(String(req.params.id)) });
}

export async function createChildQuestionHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = createChildQuestionSchema.parse(req.body);
  res.status(201).json({ data: await papersService.createChildQuestion(String(req.params.id), dto) });
}

export async function updateChildQuestionHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = updateChildQuestionSchema.parse(req.body);
  res.json({ data: await papersService.updateChildQuestion(String(req.params.id), dto) });
}

export async function deleteChildQuestionHandler(req: AuthRequest, res: Response): Promise<void> {
  res.json({ data: await papersService.deleteChildQuestion(String(req.params.id)) });
}
