import { Router, type Response } from 'express';
import { authenticate, type AuthRequest } from '../../middleware/auth.js';
import { requireAdmin } from '../../middleware/requireAdmin.js';
import { asyncHandler } from '../../shared/asyncHandler.js';
import { getAdminOverview } from './admin-overview.service.js';

export const adminOverviewRouter = Router();

adminOverviewRouter.get(
  '/',
  authenticate,
  requireAdmin,
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    res.json({ data: await getAdminOverview() });
  }),
);
