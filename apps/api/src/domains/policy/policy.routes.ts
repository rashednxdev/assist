import { Router, type Response } from 'express';
import { authenticate, type AuthRequest } from '../../middleware/auth.js';
import { requireAdmin } from '../../middleware/requireAdmin.js';
import { requireModuleAccessAny } from '../../middleware/requireModuleAccess.js';
import { asyncHandler } from '../../shared/asyncHandler.js';
import { isAdminUser } from '../../shared/authorize.js';
import type { UserType } from '@ibas/shared-constants';
import * as policy from './policy.service.js';

export const policyRouter = Router();

policyRouter.use(authenticate);

policyRouter.get(
  '/collections',
  requireModuleAccessAny('BOOKS', 'CIRCULARS'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const admin = req.user!.is_super_admin || isAdminUser(req.user!.user_type as UserType);
    res.json({ data: await policy.listPolicyCollections(admin) });
  }),
);

policyRouter.get(
  '/admin/books',
  requireAdmin,
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    res.json({ data: await policy.listAllBooksForAdmin() });
  }),
);

policyRouter.patch(
  '/books/:id',
  requireAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json({ data: await policy.setBookCollections(String(req.params.id), req.body) });
  }),
);
