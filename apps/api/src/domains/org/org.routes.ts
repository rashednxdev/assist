import { Router, type Response } from 'express';
import { authenticate, type AuthRequest } from '../../middleware/auth.js';
import { requireAdmin } from '../../middleware/requireAdmin.js';
import { asyncHandler } from '../../shared/asyncHandler.js';
import { isAdminUser } from '../community/community.service.js';
import * as org from './org.service.js';
import { getServiceInfo, setServiceInfo } from './service-info.service.js';
import { onSubstantivePosting } from '../contacts/charges.service.js';
import { logger } from '../../shared/logger.js';

/** Offices, office types and designations. Reads for every signed-in user; writes for admins. */
export const orgRouter = Router();

orgRouter.use(authenticate);

orgRouter.get(
  '/office-types',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json({ data: await org.listOfficeTypes(req.query.all === 'true' && isAdminUser(req.user!)) });
  }),
);

orgRouter.get(
  '/designations',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json({ data: await org.listDesignations(req.query.all === 'true' && isAdminUser(req.user!)) });
  }),
);

orgRouter.get(
  '/offices/options',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json({ data: await org.officeOptions(req.query) });
  }),
);

orgRouter.get(
  '/me',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json({ data: await org.getWorkIdentity(req.user!.id) });
  }),
);

orgRouter.put(
  '/me',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id;
    const before = await org.getWorkIdentity(userId);
    const after = await org.setWorkIdentity(userId, req.body);
    if (after.office_id && after.designation_id && (after.office_id !== before.office_id || after.designation_id !== before.designation_id)) {
      await onSubstantivePosting(userId, after.office_id, after.designation_id).catch((err) =>
        logger.warn({ err }, 'Additional charge handover check failed'),
      );
    }
    res.json({ data: after });
  }),
);

orgRouter.get(
  '/me/service',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json({ data: await getServiceInfo(req.user!.id) });
  }),
);

orgRouter.put(
  '/me/service',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json({ data: await setServiceInfo(req.user!.id, req.body) });
  }),
);

/* ---------------------------------- admin ---------------------------------- */

orgRouter.get(
  '/admin/offices',
  requireAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json({ data: await org.listOfficesAdmin(req.query) });
  }),
);

orgRouter.get(
  '/admin/offices/:id',
  requireAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json({ data: await org.getOffice(String(req.params.id)) });
  }),
);

orgRouter.post(
  '/admin/offices',
  requireAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.status(201).json({ data: await org.createOffice(req.body, req.user!.id) });
  }),
);

orgRouter.put(
  '/admin/offices/:id',
  requireAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json({ data: await org.updateOffice(String(req.params.id), req.body, req.user!.id) });
  }),
);

orgRouter.delete(
  '/admin/offices/:id',
  requireAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await org.deleteOffice(String(req.params.id));
    res.json({ data: { ok: true } });
  }),
);

orgRouter.post(
  '/admin/office-types',
  requireAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.status(201).json({ data: await org.createOfficeType(req.body, req.user!.id) });
  }),
);

orgRouter.put(
  '/admin/office-types/:id',
  requireAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json({ data: await org.updateOfficeType(String(req.params.id), req.body, req.user!.id) });
  }),
);

orgRouter.delete(
  '/admin/office-types/:id',
  requireAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await org.deleteOfficeType(String(req.params.id));
    res.json({ data: { ok: true } });
  }),
);

orgRouter.post(
  '/admin/designations',
  requireAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.status(201).json({ data: await org.createDesignation(req.body, req.user!.id) });
  }),
);

orgRouter.put(
  '/admin/designations/:id',
  requireAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json({ data: await org.updateDesignation(String(req.params.id), req.body, req.user!.id) });
  }),
);

orgRouter.delete(
  '/admin/designations/:id',
  requireAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await org.deleteDesignation(String(req.params.id));
    res.json({ data: { ok: true } });
  }),
);
