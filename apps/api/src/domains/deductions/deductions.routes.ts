import { Router, type Response } from 'express';
import { deductionListQuerySchema } from '@ibas/shared-types';
import { authenticate, type AuthRequest } from '../../middleware/auth.js';
import { requireAdmin } from '../../middleware/requireAdmin.js';
import { asyncHandler } from '../../shared/asyncHandler.js';
import * as deductions from './deductions.service.js';

export const deductionsRouter = Router();

deductionsRouter.use(authenticate);

const isAdmin = (req: AuthRequest) =>
  !!req.user && (req.user.is_super_admin || req.user.user_type === 'system_admin' || req.user.user_type === 'admin');

deductionsRouter.get(
  '/setup',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const kind = typeof req.query.kind === 'string' ? req.query.kind : undefined;
    res.json({ data: await deductions.listSetup(kind, isAdmin(req) && req.query.all === 'true') });
  }),
);

deductionsRouter.post(
  '/setup',
  requireAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.status(201).json({ data: await deductions.createSetup(req.body) });
  }),
);

deductionsRouter.patch(
  '/setup/:id',
  requireAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json({ data: await deductions.updateSetup(String(req.params.id), req.body) });
  }),
);

deductionsRouter.delete(
  '/setup/:id',
  requireAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await deductions.deactivateSetup(String(req.params.id));
    res.json({ data: { ok: true } });
  }),
);

deductionsRouter.get(
  '/circulars/:circularId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json({ data: await deductions.getLinkedCircular(String(req.params.circularId), isAdmin(req)) });
  }),
);

deductionsRouter.get(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json({ data: await deductions.listEntries(deductionListQuerySchema.parse(req.query), isAdmin(req)) });
  }),
);

deductionsRouter.get(
  '/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json({ data: await deductions.getEntry(String(req.params.id), isAdmin(req)) });
  }),
);

deductionsRouter.post(
  '/',
  requireAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.status(201).json({ data: await deductions.createEntry(req.body, req.user!.id) });
  }),
);

deductionsRouter.put(
  '/:id',
  requireAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json({ data: await deductions.updateEntry(String(req.params.id), req.body, req.user!.id) });
  }),
);

deductionsRouter.delete(
  '/:id',
  requireAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await deductions.deleteEntry(String(req.params.id));
    res.json({ data: { ok: true } });
  }),
);
