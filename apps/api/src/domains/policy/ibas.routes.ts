import { Router, type Response } from 'express';
import { authenticate, type AuthRequest } from '../../middleware/auth.js';
import { requireAdmin } from '../../middleware/requireAdmin.js';
import { loadModuleAccessChecker } from '../../middleware/moduleAccessChecker.js';
import { asyncHandler } from '../../shared/asyncHandler.js';
import * as ibas from './ibas.service.js';
import * as areas from './areas.service.js';

export const ibasRouter = Router();

ibasRouter.use(authenticate);

ibasRouter.get(
  '/area-options',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const checker = await loadModuleAccessChecker(req.user!);
    res.json({ data: await areas.listAreaOptions(checker.isAdmin) });
  }),
);

ibasRouter.get(
  '/admin/areas',
  requireAdmin,
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    res.json({ data: await areas.listAreaRecords() });
  }),
);

ibasRouter.post(
  '/admin/areas',
  requireAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.status(201).json({ data: await areas.createArea(req.body, req.user!.id) });
  }),
);

ibasRouter.put(
  '/admin/areas/:code',
  requireAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json({ data: await areas.updateArea(String(req.params.code), req.body, req.user!.id) });
  }),
);

ibasRouter.get(
  '/areas',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const checker = await loadModuleAccessChecker(req.user!);
    res.json({ data: await ibas.listAreas(checker) });
  }),
);

ibasRouter.get(
  '/areas/:code',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const checker = await loadModuleAccessChecker(req.user!);
    res.json({ data: await ibas.getAreaDetail(String(req.params.code), checker) });
  }),
);

ibasRouter.get(
  '/admin/links',
  requireAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json({ data: await ibas.listAreaLinks(String(req.query.area ?? '')) });
  }),
);

ibasRouter.post(
  '/admin/links',
  requireAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.status(201).json({ data: await ibas.createAreaLink(req.body, req.user!.id) });
  }),
);

ibasRouter.patch(
  '/admin/links/:id',
  requireAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const body = req.body as { note?: unknown; move?: unknown };
    res.json({
      data: await ibas.updateAreaLink(String(req.params.id), {
        note: typeof body.note === 'string' ? body.note : undefined,
        move: body.move === 'up' || body.move === 'down' ? body.move : undefined,
      }),
    });
  }),
);

ibasRouter.delete(
  '/admin/links/:id',
  requireAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json({ data: await ibas.deleteAreaLink(String(req.params.id)) });
  }),
);

ibasRouter.get(
  '/admin/topic-search',
  requireAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json({ data: await ibas.searchTopicsForLinking(String(req.query.q ?? '')) });
  }),
);
