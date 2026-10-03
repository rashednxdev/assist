import { Router, type Response } from 'express';
import { authenticate, type AuthRequest } from '../../middleware/auth.js';
import { requireAdmin } from '../../middleware/requireAdmin.js';
import { requireModuleAccessAny } from '../../middleware/requireModuleAccess.js';
import { asyncHandler } from '../../shared/asyncHandler.js';
import { isAdminUser } from '../../shared/authorize.js';
import type { UserType } from '@ibas/shared-constants';
import { knowQuestionsQuerySchema } from '@ibas/shared-types';
import * as policy from './policy.service.js';
import * as archive from './archive.service.js';

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

const isAdminReq = (req: AuthRequest) => req.user!.is_super_admin || isAdminUser(req.user!.user_type as UserType);

policyRouter.get(
  '/archive',
  requireModuleAccessAny('BOOKS', 'CIRCULARS'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json({ data: await archive.getArchiveOverview(isAdminReq(req)) });
  }),
);

policyRouter.get(
  '/archive/books/:id',
  requireModuleAccessAny('BOOKS', 'CIRCULARS'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json({ data: await archive.getArchiveBook(String(req.params.id), isAdminReq(req)) });
  }),
);

policyRouter.patch(
  '/archive/books/:id',
  requireAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json({ data: await archive.setArchiveBook(String(req.params.id), req.body) });
  }),
);

policyRouter.get(
  '/archive/know',
  requireModuleAccessAny('BOOKS', 'CIRCULARS'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { area } = knowQuestionsQuerySchema.parse(req.query);
    res.json({ data: await archive.listKnowQuestions(area, isAdminReq(req)) });
  }),
);

policyRouter.get(
  '/archive/know/candidates',
  requireAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json({ data: await archive.listKnowCandidates(req.query) });
  }),
);

policyRouter.post(
  '/archive/know',
  requireAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.status(201).json({ data: await archive.addKnowQuestions(req.body, req.user!.id) });
  }),
);

policyRouter.delete(
  '/archive/know/:id',
  requireAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json({ data: await archive.removeKnowQuestion(String(req.params.id)) });
  }),
);
