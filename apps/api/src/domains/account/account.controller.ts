import type { Response } from 'express';
import {
  registerSchema,
  otpVerifySchema,
  changePasswordSchema,
  updateMyProfileSchema,
  createUserAddressSchema,
  subscribePlanSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  reportClientVersionSchema,
} from '@ibas/shared-types';
import type { AuthRequest } from '../../middleware/auth.js';
import * as accountService from './account.service.js';
import * as usersService from '../users/users.service.js';

export async function registerHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = registerSchema.parse(req.body);
  const result = await accountService.registerUser(dto);
  if (dto.app_version && dto.client_platform === 'mobile') {
    await usersService.reportClientVersion(String(result.user.id), dto.app_version, dto.client_platform);
  }
  res.status(201).json({ data: result });
}

export async function forgotPasswordHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = forgotPasswordSchema.parse(req.body);
  const data = await accountService.requestPasswordReset(dto);
  res.json({ data });
}

export async function resetPasswordHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = resetPasswordSchema.parse(req.body);
  const data = await accountService.resetPasswordWithOtp(dto);
  res.json({ data });
}

export async function resendOtpHandler(req: AuthRequest, res: Response): Promise<void> {
  const channel = req.body?.channel === 'phone' ? 'phone' : 'email';
  res.json({ data: await accountService.resendOtp(req.user!.id, channel) });
}

export async function verifyOtpHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = otpVerifySchema.parse(req.body);
  res.json({ data: await accountService.verifyOtp(req.user!.id, dto) });
}

export async function getSummaryHandler(req: AuthRequest, res: Response): Promise<void> {
  res.json({ data: await accountService.getAccountSummary(req.user!.id) });
}

export async function getProfileHandler(req: AuthRequest, res: Response): Promise<void> {
  res.json({ data: await accountService.getMyProfile(req.user!.id) });
}

export async function updateProfileHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = updateMyProfileSchema.parse(req.body);
  res.json({ data: await accountService.updateMyProfile(req.user!.id, dto) });
}

export async function changePasswordHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = changePasswordSchema.parse(req.body);
  res.json({ data: await accountService.changeMyPassword(req.user!.id, dto) });
}

export async function listAddressesHandler(req: AuthRequest, res: Response): Promise<void> {
  res.json({ data: await accountService.listMyAddresses(req.user!.id) });
}

export async function createAddressHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = createUserAddressSchema.parse(req.body);
  res.status(201).json({ data: await accountService.createMyAddress(req.user!.id, dto) });
}

export async function deleteAddressHandler(req: AuthRequest, res: Response): Promise<void> {
  res.json({ data: await accountService.deleteMyAddress(req.user!.id, String(req.params.id)) });
}

export async function listPlansHandler(_req: AuthRequest, res: Response): Promise<void> {
  res.json({ data: await accountService.listSubscriptionPlans() });
}

export async function getSubscriptionHandler(req: AuthRequest, res: Response): Promise<void> {
  res.json({ data: await accountService.getMySubscription(req.user!.id) });
}

export async function subscribeHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = subscribePlanSchema.parse(req.body);
  res.json({ data: await accountService.subscribeToPlan(req.user!.id, dto) });
}

export async function reportClientVersionHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = reportClientVersionSchema.parse(req.body);
  await usersService.reportClientVersion(req.user!.id, dto.app_version, dto.client_platform);
  res.json({ data: { ok: true } });
}
