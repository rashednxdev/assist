import type { Response } from 'express';
import {
  createPensionLeaveTypeSchema,
  pensionCalculateSchema,
  pensionPrlCalculateSchema,
  updatePensionLeaveTypeSchema,
} from '@ibas/shared-types';
import type { AuthRequest } from '../../middleware/auth.js';
import * as pensionService from './pension.service.js';

export async function listLeaveTypesHandler(req: AuthRequest, res: Response): Promise<void> {
  const activeOnly = req.query.all !== 'true';
  const data = await pensionService.listLeaveTypes(activeOnly);
  res.json({ data });
}

export async function createLeaveTypeHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = createPensionLeaveTypeSchema.parse(req.body);
  const data = await pensionService.createLeaveType(dto);
  res.status(201).json({ data });
}

export async function updateLeaveTypeHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = updatePensionLeaveTypeSchema.parse(req.body);
  const data = await pensionService.updateLeaveType(String(req.params.id), dto);
  res.json({ data });
}

export async function deleteLeaveTypeHandler(req: AuthRequest, res: Response): Promise<void> {
  const data = await pensionService.deleteLeaveType(String(req.params.id));
  res.json({ data });
}

export async function calculatePensionHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = pensionCalculateSchema.parse(req.body);
  const data = await pensionService.calculatePensionAccount(dto);
  res.json({ data });
}

export async function calculatePrlHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = pensionPrlCalculateSchema.parse(req.body);
  const data = pensionService.calculatePrlAccount(dto);
  res.json({ data });
}
