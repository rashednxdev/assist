import type { Response } from 'express';
import type { z } from 'zod';
import {
  askSalaryQuestionSchema,
  salaryCalcGuideSchema,
  salaryCircularWriteSchema,
  salaryFaqWriteSchema,
  salaryTrNoticeSchema,
  updateSalaryTrNoticeVisibilitySchema,
} from '@ibas/shared-types';
import type { AuthRequest } from '../../middleware/auth.js';
import { badRequest, unauthorized } from '../../shared/errors/AppError.js';
import * as helpService from './salary-help.service.js';

function parseBody<S extends z.ZodTypeAny>(schema: S, body: unknown): z.output<S> {
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw badRequest(parsed.error.issues.map((issue) => issue.message).join('; '));
  return parsed.data;
}

function authUser(req: AuthRequest) {
  if (!req.user) throw unauthorized();
  return req.user;
}

export async function getSalaryHelpHandler(req: AuthRequest, res: Response): Promise<void> {
  res.set('Cache-Control', 'private, no-store');
  res.json({ data: await helpService.getSalaryHelpFeed(authUser(req).id) });
}

export async function askSalaryQuestionHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = parseBody(askSalaryQuestionSchema, req.body);
  const result = await helpService.askSalaryQuestion(authUser(req).id, dto);
  res.status(result.created ? 201 : 200).json({ data: result });
}

export async function adminListSalaryFaqsHandler(req: AuthRequest, res: Response): Promise<void> {
  const status = typeof req.query.status === 'string' ? req.query.status : '';
  res.json({ data: await helpService.listAdminSalaryFaqs(status) });
}

export async function adminCreateSalaryFaqHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = parseBody(salaryFaqWriteSchema, req.body);
  res.status(201).json({ data: await helpService.createAdminSalaryFaq(dto) });
}

export async function adminUpdateSalaryFaqHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = parseBody(salaryFaqWriteSchema, req.body);
  const id = typeof req.params.id === 'string' ? req.params.id : '';
  res.json({ data: await helpService.updateAdminSalaryFaq(id, dto) });
}

export async function adminDeleteSalaryFaqHandler(req: AuthRequest, res: Response): Promise<void> {
  const id = typeof req.params.id === 'string' ? req.params.id : '';
  await helpService.deleteAdminSalaryFaq(id);
  res.json({ data: { ok: true } });
}

export async function adminListSalaryCircularsHandler(_req: AuthRequest, res: Response): Promise<void> {
  res.json({ data: await helpService.listAdminSalaryCirculars() });
}

export async function adminCreateSalaryCircularHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = parseBody(salaryCircularWriteSchema, req.body);
  res.status(201).json({ data: await helpService.createAdminSalaryCircular(authUser(req).id, dto) });
}

export async function adminUpdateSalaryCircularHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = parseBody(salaryCircularWriteSchema, req.body);
  const id = typeof req.params.id === 'string' ? req.params.id : '';
  res.json({ data: await helpService.updateAdminSalaryCircular(id, dto) });
}

export async function getSalaryCalcGuideHandler(_req: AuthRequest, res: Response): Promise<void> {
  res.set('Cache-Control', 'private, no-store');
  res.json({ data: await helpService.getSalaryCalcGuide() });
}

export async function adminUpdateSalaryCalcGuideHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = parseBody(salaryCalcGuideSchema, req.body);
  res.json({ data: await helpService.saveSalaryCalcGuide(authUser(req).id, dto) });
}

export async function getSalaryTrNoticeHandler(_req: AuthRequest, res: Response): Promise<void> {
  res.set('Cache-Control', 'private, no-store');
  res.json({ data: await helpService.getSalaryTrNotice() });
}

export async function adminUpdateSalaryTrNoticeHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = parseBody(salaryTrNoticeSchema, req.body);
  res.json({ data: await helpService.saveSalaryTrNotice(authUser(req).id, dto) });
}

export async function adminSetSalaryTrNoticeShownHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = parseBody(updateSalaryTrNoticeVisibilitySchema, req.body);
  res.json({ data: await helpService.setSalaryTrNoticeShown(authUser(req).id, dto.shown) });
}

export async function adminDeleteSalaryCircularHandler(req: AuthRequest, res: Response): Promise<void> {
  const id = typeof req.params.id === 'string' ? req.params.id : '';
  await helpService.deleteAdminSalaryCircular(id);
  res.json({ data: { ok: true } });
}
