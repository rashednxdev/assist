import type { Request, Response } from 'express';
import { updateTermsSchema } from '@ibas/shared-types';
import type { AuthRequest } from '../../middleware/auth.js';
import * as termsService from './terms.service.js';

export async function getTermsHandler(_req: Request, res: Response): Promise<void> {
  const data = await termsService.getTerms();
  res.json({ data });
}

export async function updateTermsHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = updateTermsSchema.parse(req.body);
  const data = await termsService.updateTerms(dto, req.user!.id);
  res.json({ data });
}
