import { Router, type Response } from 'express';
import { circularListQuerySchema } from '@ibas/shared-types';
import { getAreaIndex } from './areas.service.js';
import { authenticate, type AuthRequest } from '../../middleware/auth.js';
import { requireAdmin } from '../../middleware/requireAdmin.js';
import { loadModuleAccessChecker, type ModuleAccessChecker } from '../../middleware/moduleAccessChecker.js';
import { asyncHandler } from '../../shared/asyncHandler.js';
import { forbidden } from '../../shared/errors/AppError.js';
import * as circulars from './circulars.service.js';

export const circularsRouter = Router();

circularsRouter.use(authenticate);

const NO_ACCESS = 'You do not have access to circulars. Ask an admin to grant Books & Tools or Circular Archive access.';
const CODES = circulars.CIRCULAR_MODULE_CODES;

function denied(checker: ModuleAccessChecker) {
  const state = checker.stateFor(CODES);
  return forbidden(
    state === 'stopped'
      ? checker.stoppedReason('CIRCULARS') || checker.stoppedReason('BOOKS') || 'This module is temporarily unavailable.'
      : state === 'unpaid'
        ? 'Buy a package to open circulars.'
        : NO_ACCESS,
  );
}

circularsRouter.get(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const query = circularListQuerySchema.parse(req.query);
    const checker = await loadModuleAccessChecker(req.user!);
    if (!checker.canRead(CODES)) {
      const areaOpen = query.area && circulars.canViewCircular(checker, await getAreaIndex(), [query.area]);
      if (!areaOpen) throw denied(checker);
    }
    const { items, total } = await circulars.listCirculars(query, checker.isAdmin);
    res.json({ data: items, meta: { total, limit: query.limit, offset: query.offset, has_more: query.offset + items.length < total } });
  }),
);

circularsRouter.get(
  '/facets',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const checker = await loadModuleAccessChecker(req.user!);
    if (!checker.canRead(CODES)) throw denied(checker);
    res.json({ data: await circulars.circularFacets() });
  }),
);

circularsRouter.get(
  '/tags',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const checker = await loadModuleAccessChecker(req.user!);
    if (!checker.canRead(CODES)) throw denied(checker);
    const limit = Number(req.query.limit) || 200;
    res.json({ data: await circulars.listTags(checker.isAdmin, String(req.query.q ?? ''), limit) });
  }),
);

circularsRouter.post(
  '/tags/rename',
  requireAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json({ data: await circulars.renameTag(req.body) });
  }),
);

circularsRouter.delete(
  '/tags',
  requireAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json({ data: await circulars.deleteTag(String(req.query.tag ?? '')) });
  }),
);

circularsRouter.get(
  '/field-suggestions',
  requireAdmin,
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    res.json({ data: await circulars.fieldSuggestions() });
  }),
);

circularsRouter.get(
  '/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const checker = await loadModuleAccessChecker(req.user!);
    const id = String(req.params.id);
    const areas = await circulars.getCircularAreas(id, checker.isAdmin);
    if (!circulars.canViewCircular(checker, await getAreaIndex(), areas)) throw forbidden(NO_ACCESS);
    res.json({ data: await circulars.getCircular(id, checker.isAdmin) });
  }),
);

circularsRouter.post(
  '/',
  requireAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.status(201).json({ data: await circulars.createCircular(req.body, req.user!.id) });
  }),
);

circularsRouter.patch(
  '/:id',
  requireAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json({ data: await circulars.updateCircular(String(req.params.id), req.body, req.user!.id) });
  }),
);

circularsRouter.delete(
  '/:id',
  requireAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await circulars.deleteCircular(String(req.params.id));
    res.json({ data: { ok: true } });
  }),
);
