import { Router, type Response } from 'express';
import { authenticate, type AuthRequest } from '../../middleware/auth.js';
import { asyncHandler } from '../../shared/asyncHandler.js';
import { setNewPassword } from '../users/account-recovery.service.js';
import {
  resendOtpHandler,
  verifyOtpHandler,
  getSummaryHandler,
  getProfileHandler,
  updateProfileHandler,
  changePasswordHandler,
  listAddressesHandler,
  createAddressHandler,
  deleteAddressHandler,
  listPlansHandler,
  getSubscriptionHandler,
  subscribeHandler,
  reportClientVersionHandler,
} from './account.controller.js';

export const accountRouter = Router();

accountRouter.use(authenticate);

accountRouter.post('/verify/resend', asyncHandler(resendOtpHandler));
accountRouter.post('/verify', asyncHandler(verifyOtpHandler));
accountRouter.get('/summary', asyncHandler(getSummaryHandler));
accountRouter.get('/profile', asyncHandler(getProfileHandler));
accountRouter.patch('/profile', asyncHandler(updateProfileHandler));
accountRouter.post('/change-password', asyncHandler(changePasswordHandler));
accountRouter.post(
  '/set-new-password',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json({ data: await setNewPassword(req.user!.id, req.body) });
  }),
);
accountRouter.get('/addresses', asyncHandler(listAddressesHandler));
accountRouter.post('/addresses', asyncHandler(createAddressHandler));
accountRouter.delete('/addresses/:id', asyncHandler(deleteAddressHandler));
accountRouter.get('/subscription/plans', asyncHandler(listPlansHandler));
accountRouter.get('/subscription', asyncHandler(getSubscriptionHandler));
accountRouter.post('/subscription', asyncHandler(subscribeHandler));
accountRouter.post('/client-version', asyncHandler(reportClientVersionHandler));
