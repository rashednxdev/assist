import type { Response } from 'express';
import {
  submitUserQuestionSchema,
  rejectUserQuestionSchema,
  acceptUserQuestionSchema,
  listAdminSubmittedQuestionsQuerySchema,
} from '@ibas/shared-types';
import type { AuthRequest } from '../../middleware/auth.js';
import * as userQuestionsService from './user-questions.service.js';

export async function submitHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = submitUserQuestionSchema.parse(req.body);
  const data = await userQuestionsService.submitUserQuestion(req.user!.id, dto);
  res.status(201).json({ data });
}

export async function listMineHandler(req: AuthRequest, res: Response): Promise<void> {
  const data = await userQuestionsService.listMySubmittedQuestions(req.user!.id);
  res.json({ data });
}

export async function listAdminHandler(req: AuthRequest, res: Response): Promise<void> {
  const query = listAdminSubmittedQuestionsQuerySchema.parse(req.query);
  const data = await userQuestionsService.listAdminSubmittedQuestions(query.status);
  res.json({ data });
}

export async function acceptHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = acceptUserQuestionSchema.parse(req.body);
  const data = await userQuestionsService.acceptSubmittedQuestion(
    String(req.params.id),
    dto.linked_question_id,
    req.user!.id,
  );
  res.json({ data });
}

export async function rejectHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = rejectUserQuestionSchema.parse(req.body);
  const data = await userQuestionsService.rejectSubmittedQuestion(
    String(req.params.id),
    dto.admin_note,
    req.user!.id,
  );
  res.json({ data });
}
