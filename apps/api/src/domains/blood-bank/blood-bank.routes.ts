import { Router, type Response } from 'express';
import { authenticate, type AuthRequest } from '../../middleware/auth.js';
import { asyncHandler } from '../../shared/asyncHandler.js';
import * as blood from './blood-bank.service.js';

/** Community blood bank: open to members who have set their blood group. */
export const bloodBankRouter = Router();

bloodBankRouter.use(authenticate);

bloodBankRouter.get(
  '/me',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json({ data: await blood.getMe(req.user!) });
  }),
);

bloodBankRouter.put(
  '/me',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json({ data: await blood.saveMe(req.user!, req.body) });
  }),
);

bloodBankRouter.get(
  '/places/districts',
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    res.json({ data: await blood.listDistricts() });
  }),
);

bloodBankRouter.get(
  '/places/districts/:id/thanas',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json({ data: await blood.listThanas(String(req.params.id)) });
  }),
);

bloodBankRouter.get(
  '/stats',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json({ data: await blood.getStats(req.user!, req.query) });
  }),
);

bloodBankRouter.get(
  '/donors',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { items, ...meta } = await blood.listDonors(req.user!, req.query);
    res.json({ data: items, meta });
  }),
);

bloodBankRouter.get(
  '/donations',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json({ data: await blood.listDonations(req.user!) });
  }),
);

bloodBankRouter.post(
  '/donations',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.status(201).json({ data: await blood.addDonation(req.user!, req.body) });
  }),
);

bloodBankRouter.delete(
  '/donations/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json({ data: await blood.deleteDonation(req.user!, String(req.params.id)) });
  }),
);

bloodBankRouter.get(
  '/requests',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { items, ...meta } = await blood.listRequests(req.user!, req.query);
    res.json({ data: items, meta });
  }),
);

bloodBankRouter.post(
  '/requests',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.status(201).json({ data: await blood.createRequest(req.user!, req.body) });
  }),
);

bloodBankRouter.get(
  '/requests/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json({ data: await blood.getRequest(req.user!, String(req.params.id)) });
  }),
);

bloodBankRouter.post(
  '/requests/:id/respond',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json({ data: await blood.respond(req.user!, String(req.params.id), req.body) });
  }),
);

bloodBankRouter.put(
  '/requests/:id/status',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json({ data: await blood.setRequestStatus(req.user!, String(req.params.id), req.body) });
  }),
);

bloodBankRouter.delete(
  '/requests/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await blood.deleteRequest(req.user!, String(req.params.id));
    res.json({ data: { deleted: true } });
  }),
);
