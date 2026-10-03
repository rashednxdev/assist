import { Router, type Response } from 'express';
import { authenticate, type AuthRequest } from '../../middleware/auth.js';
import { asyncHandler } from '../../shared/asyncHandler.js';
import * as contacts from './contacts.service.js';
import * as verification from './verification.service.js';
import * as charges from './charges.service.js';

/** Contact directory: free for signed-in users who consent, set their posting and get verified; numbers need a package. */
export const contactsRouter = Router();

contactsRouter.use(authenticate);

contactsRouter.get(
  '/access',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json({ data: await contacts.getAccess(req.user!) });
  }),
);

contactsRouter.get(
  '/overview',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json({ data: await contacts.getOverview(req.user!, req.query) });
  }),
);

contactsRouter.get(
  '/departments',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json({ data: await contacts.listDepartments(req.user!) });
  }),
);

contactsRouter.put(
  '/me/consent',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json({ data: await contacts.setConsent(req.user!, req.body) });
  }),
);

contactsRouter.get(
  '/offices',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { items, ...meta } = await contacts.listOffices(req.user!, req.query);
    res.json({ data: items, meta });
  }),
);

contactsRouter.get(
  '/offices/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json({ data: await contacts.getOffice(req.user!, String(req.params.id)) });
  }),
);

contactsRouter.get(
  '/employees',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { items, ...meta } = await contacts.listEmployees(req.user!, req.query);
    res.json({ data: items, meta });
  }),
);

contactsRouter.get(
  '/designations',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json({ data: await contacts.designationCounts(req.user!, req.query) });
  }),
);

contactsRouter.get(
  '/favorites',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json({ data: await contacts.listFavorites(req.user!) });
  }),
);

contactsRouter.post(
  '/favorites',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json({ data: await contacts.toggleFavorite(req.user!, req.body) });
  }),
);

contactsRouter.get(
  '/batchmates',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json({ data: await contacts.getMyBatch(req.user!) });
  }),
);

contactsRouter.get(
  '/batches',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json({ data: await contacts.listBatches(req.user!) });
  }),
);

contactsRouter.get(
  '/batches/:key/members',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json({ data: await contacts.getBatchMembers(req.user!, String(req.params.key)) });
  }),
);

contactsRouter.put(
  '/me/privacy',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json({ data: await contacts.setPrivacy(req.user!, req.body) });
  }),
);

contactsRouter.post(
  '/verification/code',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json({ data: await verification.regenerateCode(req.user!) });
  }),
);

contactsRouter.get(
  '/verify/given',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json({ data: await verification.listGiven(req.user!) });
  }),
);

contactsRouter.get(
  '/verify/:code',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json({ data: await verification.lookupCode(req.user!, String(req.params.code)) });
  }),
);

contactsRouter.post(
  '/verify',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json({ data: await verification.verifyCode(req.user!, req.body) });
  }),
);

contactsRouter.get(
  '/me/charges',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json({ data: await charges.myCharges(req.user!) });
  }),
);

contactsRouter.post(
  '/me/charges',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json({ data: await charges.addCharge(req.user!, req.body) });
  }),
);

contactsRouter.delete(
  '/me/charges/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json({ data: await charges.removeCharge(req.user!, String(req.params.id)) });
  }),
);

contactsRouter.post(
  '/me/charges/:id/handover',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json({ data: await charges.answerHandover(req.user!, String(req.params.id), req.body) });
  }),
);
