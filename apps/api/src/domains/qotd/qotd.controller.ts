import type { Response } from 'express';
import { createQotdEntrySchema, updateQotdEntrySchema, qotdSettingsSchema, qotdQuestionsQuerySchema } from '@ibas/shared-types';
import type { AuthRequest } from '../../middleware/auth.js';
import * as qotdService from './qotd.service.js';

function isAdminUser(user: AuthRequest['user']): boolean {
  return !!user && (user.is_super_admin || user.user_type === 'system_admin' || user.user_type === 'admin');
}

export async function listDatesHandler(req: AuthRequest, res: Response): Promise<void> {
  const data = await qotdService.listQotdDates(isAdminUser(req.user));
  res.json({ data });
}

export async function getDateDetailHandler(req: AuthRequest, res: Response): Promise<void> {
  const data = await qotdService.getEntriesForDate(String(req.params.date), isAdminUser(req.user));
  res.json({ data });
}

export async function listAdminDatesHandler(_req: AuthRequest, res: Response): Promise<void> {
  const data = await qotdService.listQotdDates(true);
  res.json({ data });
}

export async function getAdminDateDetailHandler(req: AuthRequest, res: Response): Promise<void> {
  const data = await qotdService.getEntriesForDate(String(req.params.date), true);
  res.json({ data });
}

export async function listSyllabusQuestionsHandler(req: AuthRequest, res: Response): Promise<void> {
  const query = qotdQuestionsQuerySchema.parse(req.query);
  const result = await qotdService.listSyllabusQuestions(String(req.params.subjectId), query);
  res.json({ data: result.items, meta: { total: result.total, has_more: result.has_more } });
}

export async function createEntryHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = createQotdEntrySchema.parse(req.body);
  const data = await qotdService.createQotdEntry(dto, req.user!.id);
  res.status(201).json({ data });
}

export async function updateEntryHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = updateQotdEntrySchema.parse(req.body);
  const data = await qotdService.updateQotdEntry(String(req.params.id), dto);
  res.json({ data });
}

export async function deleteEntryHandler(req: AuthRequest, res: Response): Promise<void> {
  const data = await qotdService.deleteQotdEntry(String(req.params.id));
  res.json({ data });
}

export async function getSettingsHandler(_req: AuthRequest, res: Response): Promise<void> {
  const data = await qotdService.getQotdSettings();
  res.json({ data });
}

export async function updateSettingsHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = qotdSettingsSchema.parse(req.body);
  const data = await qotdService.updateQotdSettings(dto.show_past_days, req.user!.id);
  res.json({ data });
}
