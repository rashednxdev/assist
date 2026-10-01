import { Router, type Response } from 'express';
import { toolkitListQuerySchema } from '@ibas/shared-types';
import { authenticate, type AuthRequest } from '../../middleware/auth.js';
import { requireAdmin } from '../../middleware/requireAdmin.js';
import { loadModuleAccessChecker } from '../../middleware/moduleAccessChecker.js';
import { asyncHandler } from '../../shared/asyncHandler.js';
import * as toolkit from './toolkit.service.js';
import * as categories from './categories.service.js';

export const toolkitRouter = Router();

toolkitRouter.use(authenticate);

toolkitRouter.get(
  '/categories',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const checker = await loadModuleAccessChecker(req.user!);
    const all = checker.isAdmin && req.query.all === 'true';
    res.json({ data: await categories.listCategories(all, all) });
  }),
);

toolkitRouter.post(
  '/categories',
  requireAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.status(201).json({ data: await categories.createCategory(req.body) });
  }),
);

toolkitRouter.patch(
  '/categories/:id',
  requireAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json({ data: await categories.updateCategory(String(req.params.id), req.body) });
  }),
);

toolkitRouter.delete(
  '/categories/:id',
  requireAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await categories.deactivateCategory(String(req.params.id));
    res.json({ data: { ok: true } });
  }),
);

toolkitRouter.get(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const checker = await loadModuleAccessChecker(req.user!);
    res.json({ data: await toolkit.listToolkit(toolkitListQuerySchema.parse(req.query), checker) });
  }),
);

toolkitRouter.get(
  '/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const checker = await loadModuleAccessChecker(req.user!);
    res.json({ data: await toolkit.getToolkitItem(String(req.params.id), checker) });
  }),
);

toolkitRouter.post(
  '/',
  requireAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const checker = await loadModuleAccessChecker(req.user!);
    res.status(201).json({ data: await toolkit.createToolkitItem(req.body, req.user!.id, checker) });
  }),
);

toolkitRouter.put(
  '/:id',
  requireAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const checker = await loadModuleAccessChecker(req.user!);
    res.json({ data: await toolkit.updateToolkitItem(String(req.params.id), req.body, req.user!.id, checker) });
  }),
);

toolkitRouter.post(
  '/:id/duplicate',
  requireAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const checker = await loadModuleAccessChecker(req.user!);
    res.status(201).json({ data: await toolkit.duplicateToolkitItem(String(req.params.id), req.user!.id, checker) });
  }),
);

toolkitRouter.delete(
  '/:id',
  requireAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await toolkit.deleteToolkitItem(String(req.params.id));
    res.json({ data: { ok: true } });
  }),
);
