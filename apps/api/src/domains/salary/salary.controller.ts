import type { Request, Response } from 'express';
import type { z } from 'zod';
import {
  SALARY_ACCESS_STATUSES,
  consumeSalaryBillSchema,
  consumeSalaryStaffBillSchema,
  recordArrearsCalcSchema,
  rejectSalaryBillRequestSchema,
  requestSalaryBillsSchema,
  salaryStaffSchema,
  saveSalaryOfficeSchema,
  updateSalaryBillAccessSchema,
  updateSalaryBulkSizeSchema,
  updateSalaryContactsSchema,
  updateSalaryOfficeSettingsSchema,
} from '@ibas/shared-types';
import type { AuthRequest } from '../../middleware/auth.js';
import { parsePagination } from '../../shared/pagination.js';
import { badRequest, unauthorized } from '../../shared/errors/AppError.js';
import * as salaryService from './salary.service.js';
import * as accessService from './salary-access.service.js';
import * as officeService from './salary-office.service.js';
import * as staffService from './salary-staff.service.js';

function parseBody<S extends z.ZodTypeAny>(schema: S, body: unknown): z.output<S> {
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw badRequest(parsed.error.issues.map((i) => i.message).join('; '));
  return parsed.data;
}

function authUser(req: AuthRequest) {
  if (!req.user) throw unauthorized();
  return req.user;
}

export async function calculateAllPhasesHandler(req: Request, res: Response): Promise<void> {
  const results = await salaryService.calculateAllPhasesWithTracking(req.body);
  res.json({ data: { results } });
}

/** Tracks PDF/print usage — PDF is generated in the browser from the live page. */
export async function trackSalaryPdfHandler(_req: Request, res: Response): Promise<void> {
  try {
    await salaryService.trackPdfDownload();
  } catch {
    /* stats must not block the client */
  }
  res.json({ data: { ok: true } });
}

export async function getSalaryStatsHandler(_req: AuthRequest, res: Response): Promise<void> {
  const data = await salaryService.getSalaryUsageStats();
  res.json({ data });
}

export async function getMyBillAccessHandler(req: AuthRequest, res: Response): Promise<void> {
  res.json({ data: await accessService.getMyBillAccess(authUser(req)) });
}

export async function getMySalaryOfficeHandler(req: AuthRequest, res: Response): Promise<void> {
  res.json({ data: await officeService.getMySalaryOffice(authUser(req).id) });
}

export async function saveMySalaryOfficeHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = parseBody(saveSalaryOfficeSchema, req.body);
  res.json({ data: await officeService.saveMySalaryOffice(authUser(req).id, dto) });
}

export async function getSalaryOfficeSettingsHandler(_req: AuthRequest, res: Response): Promise<void> {
  res.json({ data: await officeService.getSalaryOfficeSettings() });
}

export async function updateSalaryOfficeSettingsHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = parseBody(updateSalaryOfficeSettingsSchema, req.body);
  res.json({ data: await officeService.updateSalaryOfficeSettings(dto, authUser(req).id) });
}

export async function requestBillsHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = parseBody(requestSalaryBillsSchema, req.body);
  res.json({ data: await accessService.requestBills(authUser(req), dto) });
}

export async function consumeBillHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = parseBody(consumeSalaryBillSchema, req.body);
  res.json({ data: await accessService.consumeBill(authUser(req), dto) });
}

export async function listMyStaffHandler(req: AuthRequest, res: Response): Promise<void> {
  res.json({ data: await staffService.listMyStaff(authUser(req).id) });
}

export async function createMyStaffHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = parseBody(salaryStaffSchema, req.body);
  res.status(201).json({ data: await staffService.createMyStaff(authUser(req).id, dto) });
}

export async function updateMyStaffHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = parseBody(salaryStaffSchema, req.body);
  res.json({ data: await staffService.updateMyStaff(authUser(req).id, String(req.params.staffId), dto) });
}

export async function deleteMyStaffHandler(req: AuthRequest, res: Response): Promise<void> {
  await staffService.deleteMyStaff(authUser(req).id, String(req.params.staffId));
  res.json({ data: { ok: true } });
}

export async function consumeStaffBillHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = parseBody(consumeSalaryStaffBillSchema, req.body);
  res.json({ data: await accessService.consumeStaffBill(authUser(req), dto) });
}

export async function recordArrearsCalcHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = parseBody(recordArrearsCalcSchema, req.body);
  res.json({ data: await accessService.recordArrearsCalc(authUser(req), dto) });
}

export async function listBillAccessHandler(req: AuthRequest, res: Response): Promise<void> {
  const { page, limit, skip } = parsePagination(req);
  const statusRaw = typeof req.query.status === 'string' ? req.query.status : undefined;
  const status = (SALARY_ACCESS_STATUSES as readonly string[]).includes(statusRaw ?? '') ? statusRaw : undefined;
  const q = typeof req.query.q === 'string' ? req.query.q : undefined;
  const { items, total } = await accessService.listBillAccess({ status, q, skip, limit });
  res.json({ data: items, meta: { page, limit, total } });
}

export async function updateBillAccessHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = parseBody(updateSalaryBillAccessSchema, req.body);
  const data = await accessService.updateBillAccess(String(req.params.userId), dto, authUser(req).id);
  res.json({ data });
}

export async function rejectBillRequestHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = parseBody(rejectSalaryBillRequestSchema, req.body);
  const data = await accessService.rejectBillRequest(String(req.params.userId), dto, authUser(req).id);
  res.json({ data });
}

export async function listBillUsageHandler(req: AuthRequest, res: Response): Promise<void> {
  res.json({ data: await accessService.listBillUsage(String(req.params.userId)) });
}

export async function getSalaryContactsHandler(_req: AuthRequest, res: Response): Promise<void> {
  res.json({ data: await accessService.getSalaryContacts() });
}

export async function updateSalaryContactsHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = parseBody(updateSalaryContactsSchema, req.body);
  res.json({ data: await accessService.updateSalaryContacts(dto, authUser(req).id) });
}

export async function getSalaryBulkSizeHandler(_req: AuthRequest, res: Response): Promise<void> {
  res.json({ data: await accessService.getSalaryBulkSize() });
}

export async function updateSalaryBulkSizeHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = parseBody(updateSalaryBulkSizeSchema, req.body);
  res.json({ data: await accessService.updateSalaryBulkSize(dto, authUser(req).id) });
}
