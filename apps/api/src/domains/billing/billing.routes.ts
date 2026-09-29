import { Router, type Response } from 'express';
import { authenticate, type AuthRequest } from '../../middleware/auth.js';
import { requireAdmin } from '../../middleware/requireAdmin.js';
import { asyncHandler } from '../../shared/asyncHandler.js';
import * as billing from './billing.service.js';

/** Packages, checkout (demo bKash) and payment history. */
export const billingRouter = Router();

billingRouter.use(authenticate);

billingRouter.get(
  '/catalog',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json({ data: await billing.getCatalog(req.user!) });
  }),
);

billingRouter.get(
  '/my-access',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json({ data: await billing.getMyAccess(req.user!.id) });
  }),
);

billingRouter.get(
  '/orders',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json({ data: await billing.listMyOrders(req.user!.id) });
  }),
);

billingRouter.post(
  '/orders',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.status(201).json({ data: await billing.createOrder(req.user!, req.body) });
  }),
);

billingRouter.get(
  '/orders/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json({ data: await billing.getOrder(String(req.params.id), req.user!) });
  }),
);

billingRouter.post(
  '/orders/:id/pay',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json({ data: await billing.demoPay(String(req.params.id), req.body, req.user!) });
  }),
);

billingRouter.post(
  '/orders/:id/cancel',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json({ data: await billing.cancelOrder(String(req.params.id), req.user!) });
  }),
);

/* --------------------------------- admin --------------------------------- */

billingRouter.get(
  '/admin/packages',
  requireAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json({ data: await billing.listPackagesAdmin(typeof req.query.kind === 'string' ? req.query.kind : undefined) });
  }),
);

billingRouter.post(
  '/admin/packages',
  requireAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.status(201).json({ data: await billing.createPackage(req.body, req.user!.id) });
  }),
);

billingRouter.put(
  '/admin/packages/:id',
  requireAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json({ data: await billing.updatePackage(String(req.params.id), req.body, req.user!.id) });
  }),
);

billingRouter.delete(
  '/admin/packages/:id',
  requireAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json({ data: await billing.deletePackage(String(req.params.id)) });
  }),
);

billingRouter.get(
  '/admin/packages/:id/classes',
  requireAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json({ data: await billing.packageClasses(String(req.params.id)) });
  }),
);

billingRouter.put(
  '/admin/packages/:id/classes',
  requireAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json({ data: await billing.setPackageClasses(String(req.params.id), req.body) });
  }),
);

billingRouter.get(
  '/admin/live-class-options',
  requireAdmin,
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    res.json({ data: await billing.liveClassOptions() });
  }),
);

billingRouter.get(
  '/admin/subject-options',
  requireAdmin,
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    res.json({ data: await billing.subjectOptions() });
  }),
);

billingRouter.get(
  '/admin/settings',
  requireAdmin,
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    res.json({ data: await billing.getBillingSettings() });
  }),
);

billingRouter.put(
  '/admin/settings',
  requireAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json({ data: await billing.updateBillingSettings(req.body, req.user!.id) });
  }),
);

billingRouter.get(
  '/admin/orders',
  requireAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json({ data: await billing.listOrdersAdmin(req.query) });
  }),
);

billingRouter.post(
  '/admin/grants',
  requireAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.status(201).json({ data: await billing.manualGrant(req.body, req.user!) });
  }),
);

billingRouter.post(
  '/admin/orders/:id/revoke',
  requireAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await billing.revokeEntitlementForOrder(String(req.params.id), typeof req.body?.note === 'string' ? req.body.note : undefined);
    res.json({ data: { ok: true } });
  }),
);

billingRouter.get(
  '/admin/users/:id/access',
  requireAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const [access, orders] = await Promise.all([
      billing.getMyAccess(String(req.params.id)),
      billing.listMyOrders(String(req.params.id)),
    ]);
    res.json({ data: { access, orders } });
  }),
);
