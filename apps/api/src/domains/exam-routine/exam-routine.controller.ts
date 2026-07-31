import type { Response } from 'express';
import {
  createExamRoutineSchema,
  updateExamRoutineSchema,
  createExamRoutineEntrySchema,
  updateExamRoutineEntrySchema,
} from '@ibas/shared-types';
import type { AuthRequest } from '../../middleware/auth.js';
import { parsePagination } from '../../shared/pagination.js';
import * as examRoutineService from './exam-routine.service.js';

export async function listMobileRoutinesHandler(_req: AuthRequest, res: Response): Promise<void> {
  const data = await examRoutineService.listRoutinesForMobile();
  res.json({ data });
}

export async function getRoutineByExamNameHandler(req: AuthRequest, res: Response): Promise<void> {
  const data = await examRoutineService.getRoutineByExamName(String(req.params.examNameId));
  res.json({ data });
}

export async function listAdminRoutinesHandler(req: AuthRequest, res: Response): Promise<void> {
  const { page, limit, skip } = parsePagination(req);
  const { items, total } = await examRoutineService.listAdminRoutines(limit, skip);
  res.json({ data: items, meta: { page, limit, total } });
}

export async function getAdminRoutineHandler(req: AuthRequest, res: Response): Promise<void> {
  const data = await examRoutineService.getRoutineDetailById(String(req.params.id));
  res.json({ data });
}

export async function createRoutineHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = createExamRoutineSchema.parse(req.body);
  const data = await examRoutineService.createExamRoutine(dto, req.user!.id);
  res.status(201).json({ data });
}

export async function updateRoutineHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = updateExamRoutineSchema.parse(req.body);
  const data = await examRoutineService.updateExamRoutine(String(req.params.id), dto);
  res.json({ data });
}

export async function addRoutineEntryHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = createExamRoutineEntrySchema.parse(req.body);
  const data = await examRoutineService.addExamRoutineEntry(String(req.params.id), dto);
  res.status(201).json({ data });
}

export async function updateRoutineEntryHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = updateExamRoutineEntrySchema.parse(req.body);
  const data = await examRoutineService.updateExamRoutineEntry(String(req.params.id), dto);
  res.json({ data });
}

export async function deleteRoutineEntryHandler(req: AuthRequest, res: Response): Promise<void> {
  const data = await examRoutineService.deleteExamRoutineEntry(String(req.params.id));
  res.json({ data });
}
