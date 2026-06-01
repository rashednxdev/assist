import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { asyncHandler } from '../../shared/asyncHandler.js';
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
} from './account.controller.js';

export const accountRouter = Router();

accountRouter.use(authenticate);

accountRouter.post('/verify/resend', asyncHandler(resendOtpHandler));
accountRouter.post('/verify', asyncHandler(verifyOtpHandler));
accountRouter.get('/summary', asyncHandler(getSummaryHandler));
accountRouter.get('/profile', asyncHandler(getProfileHandler));
accountRouter.patch('/profile', asyncHandler(updateProfileHandler));
accountRouter.post('/change-password', asyncHandler(changePasswordHandler));
accountRouter.get('/addresses', asyncHandler(listAddressesHandler));
accountRouter.post('/addresses', asyncHandler(createAddressHandler));
accountRouter.delete('/addresses/:id', asyncHandler(deleteAddressHandler));
accountRouter.get('/subscription/plans', asyncHandler(listPlansHandler));
accountRouter.get('/subscription', asyncHandler(getSubscriptionHandler));
accountRouter.post('/subscription', asyncHandler(subscribeHandler));
